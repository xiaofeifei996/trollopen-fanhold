#import <UIKit/UIKit.h>
#import <substrate.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <stdarg.h>
#import "AxsFanHoldConfig.h"
#import "AxsFanHoldPrivate.h"
#import "AxsFanHoldShortcutRunner.h"

// TrollOpen 扇形菜单：让“快捷指令”条目按住不松手即可运行。
//
// 根因（TrollOpenJB.dylib 2.0.1 手势状态机，两个架构分片一致）：
//   -[TOJBClass041 TOJBMETHOD081:] 里
//     · Began  记录起点
//     · Changed 算手指到起点距离，> 4.0pt 才把 trackingGestureActive 置 1
//       并展开菜单；距离 <= 4pt 直接 return
//   也就是说菜单本身要靠“移动”才展开，而选中条目后必须“松手”(Ended) 才执行。
//   “按住不动”在这套状态机里没有任何对应分支。
//
// 做法：手势进行期间用一个高频定时器跟踪手指位置。
//   手指静止满 holdDuration，且菜单已展开、指尖下是快捷指令条目 → 立即执行。
//   手指一动就把静止计时清零，完全不影响原有拖动选择。

static NSString *const kAxsFanHoldGestureClassName = @"TOJBClass041";
static NSString *const kAxsFanHoldGestureCallback = @"TOJBMETHOD081:";

static const long long AxsFanHoldItemKindShortcut = 2;
static const CGFloat AxsFanHoldMoveTolerance = 2.0;   // 判定“手指在动”的位移阈值
static const NSTimeInterval AxsFanHoldTickInterval = 0.05;

#pragma mark - 日志

static void axs_fanhold_log(NSString *format, ...) {
    if (![[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_isDebugLogEnabled]) return;
    va_list args;
    va_start(args, format);
    NSString *message = [[NSString alloc] initWithFormat:format arguments:args];
    va_end(args);

    NSString *path = @"/var/mobile/Library/Logs/AxsFanHold.log";
    NSFileManager *fm = [NSFileManager defaultManager];
    [fm createDirectoryAtPath:[path stringByDeletingLastPathComponent]
  withIntermediateDirectories:YES attributes:nil error:nil];

    NSDictionary *attrs = [fm attributesOfItemAtPath:path error:nil];
    if (attrs && [attrs fileSize] > 256 * 1024) {
        [fm removeItemAtPath:path error:nil];
    }

    NSString *line = [NSString stringWithFormat:@"%@ %@\n",
                      [NSDate date], message];
    NSData *data = [line dataUsingEncoding:NSUTF8StringEncoding];
    if (![fm fileExistsAtPath:path]) {
        [data writeToFile:path atomically:YES];
        return;
    }
    NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:path];
    [handle seekToEndOfFile];
    [handle writeData:data];
    [handle closeFile];
}

#pragma mark - 取值辅助

static id axs_fanhold_send(id object, const char *selectorName) {
    if (!object) return nil;
    SEL sel = sel_registerName(selectorName);
    if (![object respondsToSelector:sel]) return nil;
    return ((id (*)(id, SEL))objc_msgSend)(object, sel);
}

static BOOL axs_fanhold_readBool(id object, const char *selectorName) {
    if (!object) return NO;
    SEL sel = sel_registerName(selectorName);
    if (![object respondsToSelector:sel]) return NO;
    return ((BOOL (*)(id, SEL))objc_msgSend)(object, sel) != NO;
}

static long long axs_fanhold_readLongLong(id object, const char *selectorName) {
    if (!object) return -1;
    SEL sel = sel_registerName(selectorName);
    if (![object respondsToSelector:sel]) return -1;
    return ((long long (*)(id, SEL))objc_msgSend)(object, sel);
}

static double axs_fanhold_readDouble(id object, const char *selectorName) {
    if (!object) return 0;
    SEL sel = sel_registerName(selectorName);
    if (![object respondsToSelector:sel]) return 0;
    return ((double (*)(id, SEL))objc_msgSend)(object, sel);
}

static void axs_fanhold_writeObject(id object, const char *selectorName, id value) {
    if (!object) return;
    SEL sel = sel_registerName(selectorName);
    if (![object respondsToSelector:sel]) return;
    ((void (*)(id, SEL, id))objc_msgSend)(object, sel, value);
}

static CGPoint axs_fanhold_location_in(id gesture, UIView *view) {
    if (!view) return CGPointZero;
    return ((CGPoint (*)(id, SEL, id))objc_msgSend)(gesture,
                                                    sel_registerName("locationInView:"), view);
}

#pragma mark - 找扇形菜单视图

/// 一个视图是不是扇形菜单：同时具备 buttonFinalCenters 与 currentHighlightedItem。
static BOOL axs_fanhold_is_menu_view(id view) {
    if (![view isKindOfClass:[UIView class]]) return NO;
    return [view respondsToSelector:sel_registerName("buttonFinalCenters")] &&
           [view respondsToSelector:sel_registerName("currentHighlightedItem")] &&
           [view respondsToSelector:sel_registerName("items")];
}

static id axs_fanhold_search_subtree(id view, int depth) {
    if (!view || depth < 0) return nil;
    if (axs_fanhold_is_menu_view(view)) return view;
    id subviews = axs_fanhold_send(view, "subviews");
    if (![subviews isKindOfClass:[NSArray class]]) return nil;
    for (id sub in subviews) {
        id found = axs_fanhold_search_subtree(sub, depth - 1);
        if (found) return found;
    }
    return nil;
}

/// 先沿 superview 向上找，再向下搜子树，最后搜整个窗口。
static id axs_fanhold_find_menu_view(id gesture) {
    id view = axs_fanhold_send(gesture, "view");
    if (!view) return nil;

    for (int depth = 0; depth < 12 && view; depth++) {
        if (axs_fanhold_is_menu_view(view)) return view;
        view = axs_fanhold_send(view, "superview");
    }

    id start = axs_fanhold_send(gesture, "view");
    id found = axs_fanhold_search_subtree(start, 6);
    if (found) return found;

    id window = axs_fanhold_send(start, "window");
    return axs_fanhold_search_subtree(window, 8);
}

#pragma mark - 命中条目

static BOOL axs_fanhold_looks_like_workflow_identifier(NSString *identifier) {
    if (identifier.length != 36) return NO;
    static const NSUInteger dashes[] = {8, 13, 18, 23};
    for (NSUInteger i = 0; i < 4; i++) {
        if ([identifier characterAtIndex:dashes[i]] != '-') return NO;
    }
    return YES;
}

static BOOL axs_fanhold_item_is_shortcut(id item) {
    if (!item) return NO;
    if (axs_fanhold_readLongLong(item, "itemKind") == AxsFanHoldItemKindShortcut) return YES;
    // itemKind 未写入时用 identifier 形态兜底。
    id identifier = axs_fanhold_send(item, "identifier");
    return [identifier isKindOfClass:[NSString class]] &&
           axs_fanhold_looks_like_workflow_identifier(identifier);
}

/// 指尖下的条目：优先 TrollOpen 维护的高亮项，为空时按按钮中心点就近匹配。
static id axs_fanhold_item_at_point(id menu, CGPoint location) {
    id highlighted = axs_fanhold_send(menu, "currentHighlightedItem");
    if (highlighted) return highlighted;

    id items = axs_fanhold_send(menu, "items");
    id centers = axs_fanhold_send(menu, "buttonFinalCenters");
    if (![items isKindOfClass:[NSArray class]] || [items count] == 0) return nil;
    if (![centers isKindOfClass:[NSArray class]] || [centers count] != [items count]) return nil;

    double iconSize = axs_fanhold_readDouble(menu, "iconSize");
    if (iconSize <= 0) iconSize = 44.0;
    double limit = iconSize * 0.5 + 10.0;

    NSInteger bestIndex = NSNotFound;
    double bestDistance = limit * limit;
    NSUInteger count = [centers count];
    for (NSUInteger i = 0; i < count; i++) {
        id raw = centers[i];
        if (![raw isKindOfClass:[NSValue class]]) continue;
        CGPoint center = [raw CGPointValue];
        double dx = location.x - center.x;
        double dy = location.y - center.y;
        double distance = dx * dx + dy * dy;
        if (distance <= bestDistance) {
            bestDistance = distance;
            bestIndex = (NSInteger)i;
        }
    }
    if (bestIndex == NSNotFound) return nil;
    return items[bestIndex];
}

#pragma mark - 执行

static void axs_fanhold_dismiss_menu(id menu) {
    id window = axs_fanhold_send(menu, "window");
    if (!window) {
        ((void (*)(id, SEL, BOOL))objc_msgSend)(menu, sel_registerName("setHidden:"), YES);
        return;
    }
    [UIView animateWithDuration:0.18 animations:^{
        ((void (*)(id, SEL, double))objc_msgSend)(window, sel_registerName("setAlpha:"), 0.0);
    } completion:^(BOOL finished) {
        ((void (*)(id, SEL, BOOL))objc_msgSend)(window, sel_registerName("setHidden:"), YES);
        ((void (*)(id, SEL, double))objc_msgSend)(window, sel_registerName("setAlpha:"), 1.0);
    }];
}

static void axs_fanhold_run_item(id menu, id item) {
    id identifier = axs_fanhold_send(item, "identifier");
    if (![identifier isKindOfClass:[NSString class]] || [identifier length] == 0) return;

    axs_fanhold_log(@"fire: %@", identifier);

    UIImpactFeedbackGenerator *feedback =
        [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
    [feedback prepare];
    [feedback impactOccurred];

    // 清掉高亮，避免 TrollOpen 在 Ended 分支里再执行一次同一项。
    axs_fanhold_writeObject(menu, "setCurrentHighlightedItem:", nil);
    axs_fanhold_dismiss_menu(menu);

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.15 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        if (![AxsFanHoldShortcutRunner axs_fanhold_runWorkflowIdentifier:identifier]) {
            axs_fanhold_log(@"run failed: %@", identifier);
        }
    });
}

#pragma mark - 按住监视器

@interface AxsFanHoldWatcher : NSObject
@property (nonatomic, weak) UIGestureRecognizer *gesture;
@property (nonatomic, strong) NSTimer *timer;
@property (nonatomic, assign) CGPoint lastLocation;
@property (nonatomic, assign) NSTimeInterval stillSince;
@property (nonatomic, assign) BOOL fired;
- (void)axs_fanhold_start;
- (void)axs_fanhold_stop;
@end

@implementation AxsFanHoldWatcher

- (void)axs_fanhold_start {
    [self axs_fanhold_stop];
    self.fired = NO;
    self.stillSince = [NSDate timeIntervalSinceReferenceDate];
    self.lastLocation = CGPointMake(-CGFLOAT_MAX, -CGFLOAT_MAX);

    self.timer = [NSTimer timerWithTimeInterval:AxsFanHoldTickInterval
                                         target:self
                                       selector:@selector(axs_fanhold_tick)
                                       userInfo:nil
                                        repeats:YES];
    // CommonModes：拖动过程中 RunLoop 处于 tracking 模式也能继续走。
    [[NSRunLoop mainRunLoop] addTimer:self.timer forMode:NSRunLoopCommonModes];
}

- (void)axs_fanhold_stop {
    [self.timer invalidate];
    self.timer = nil;
}

- (void)axs_fanhold_tick {
    if (self.fired) { [self axs_fanhold_stop]; return; }

    UIGestureRecognizer *gesture = self.gesture;
    if (!gesture) { [self axs_fanhold_stop]; return; }

    long long state = axs_fanhold_readLongLong(gesture, "state");
    if (state != UIGestureRecognizerStateBegan && state != UIGestureRecognizerStateChanged) {
        [self axs_fanhold_stop];
        return;
    }

    if (![[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_isEnabled]) {
        [self axs_fanhold_stop];
        return;
    }

    id menu = axs_fanhold_find_menu_view(gesture);
    if (!menu) { self.stillSince = [NSDate timeIntervalSinceReferenceDate]; return; }

    if (!axs_fanhold_readBool(menu, "fullyRevealed")) {
        // 菜单还在展开，静止计时从零开始，避免动画期间误判。
        self.stillSince = [NSDate timeIntervalSinceReferenceDate];
        return;
    }

    CGPoint location = axs_fanhold_location_in(gesture, menu);
    CGFloat dx = location.x - self.lastLocation.x;
    CGFloat dy = location.y - self.lastLocation.y;
    NSTimeInterval now = [NSDate timeIntervalSinceReferenceDate];

    if (dx * dx + dy * dy > AxsFanHoldMoveTolerance * AxsFanHoldMoveTolerance) {
        self.lastLocation = location;
        self.stillSince = now;
        return;
    }
    self.lastLocation = location;

    if (now - self.stillSince < [[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_holdDuration]) {
        return;
    }

    id item = axs_fanhold_item_at_point(menu, location);
    if (!axs_fanhold_item_is_shortcut(item)) {
        // 指尖下不是快捷指令：保持静止计时，一旦移到快捷指令上即可触发。
        return;
    }

    self.fired = YES;
    [self axs_fanhold_stop];
    axs_fanhold_run_item(menu, item);
}

@end

#pragma mark - 状态机 hook

static NSMapTable<UIGestureRecognizer *, AxsFanHoldWatcher *> *axs_fanhold_watchers(void) {
    static NSMapTable *table;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ table = [NSMapTable weakToStrongObjectsMapTable]; });
    return table;
}

static void (*axs_fanhold_orig_gesture_update)(id, SEL, id);

static void axs_fanhold_replaced_gesture_update(id self, SEL _cmd, id gestureRecognizer) {
    if (![gestureRecognizer isKindOfClass:[UIGestureRecognizer class]]) {
        if (axs_fanhold_orig_gesture_update) {
            axs_fanhold_orig_gesture_update(self, _cmd, gestureRecognizer);
        }
        return;
    }

    UIGestureRecognizer *gesture = (UIGestureRecognizer *)gestureRecognizer;
    UIGestureRecognizerState state = gesture.state;
    NSMapTable *watchers = axs_fanhold_watchers();

    // Ended 前先清掉高亮，防止已经长按触发过的条目被再执行一次。
    if (state == UIGestureRecognizerStateEnded ||
        state == UIGestureRecognizerStateCancelled ||
        state == UIGestureRecognizerStateFailed) {
        AxsFanHoldWatcher *watcher = [watchers objectForKey:gesture];
        if (watcher.fired) {
            id menu = axs_fanhold_find_menu_view(gesture);
            if (menu) axs_fanhold_writeObject(menu, "setCurrentHighlightedItem:", nil);
        }
    }

    if (axs_fanhold_orig_gesture_update) axs_fanhold_orig_gesture_update(self, _cmd, gestureRecognizer);

    switch (state) {
        case UIGestureRecognizerStateBegan: {
            AxsFanHoldWatcher *watcher = [watchers objectForKey:gesture];
            if (!watcher) {
                watcher = [[AxsFanHoldWatcher alloc] init];
                watcher.gesture = gesture;
                [watchers setObject:watcher forKey:gesture];
            }
            [watcher axs_fanhold_start];
            break;
        }
        case UIGestureRecognizerStateEnded:
        case UIGestureRecognizerStateCancelled:
        case UIGestureRecognizerStateFailed: {
            AxsFanHoldWatcher *watcher = [watchers objectForKey:gesture];
            [watcher axs_fanhold_stop];
            [watchers removeObjectForKey:gesture];
            break;
        }
        default:
            break;
    }
}

#pragma mark - 安装

static void axs_fanhold_install_hooks(void) {
    Class gestureClass = NSClassFromString(kAxsFanHoldGestureClassName);
    if (!gestureClass) return;

    SEL callback = NSSelectorFromString(kAxsFanHoldGestureCallback);
    if (![gestureClass instancesRespondToSelector:callback]) {
        axs_fanhold_log(@"gesture class found but callback missing");
        return;
    }

    MSHookMessageEx(gestureClass, callback,
                    (IMP)axs_fanhold_replaced_gesture_update,
                    (IMP *)&axs_fanhold_orig_gesture_update);
    axs_fanhold_log(@"hooked %@ %@", kAxsFanHoldGestureClassName, kAxsFanHoldGestureCallback);
}

static void axs_fanhold_install_with_retry(int remaining) {
    if (NSClassFromString(kAxsFanHoldGestureClassName)) {
        axs_fanhold_install_hooks();
        return;
    }
    if (remaining <= 0) {
        axs_fanhold_log(@"gave up waiting for %@", kAxsFanHoldGestureClassName);
        return;
    }
    // TrollOpenJB.dylib 与本插件同进程，但加载顺序不保证。
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        axs_fanhold_install_with_retry(remaining - 1);
    });
}

%ctor {
    @autoreleasepool {
        [AxsFanHoldConfig axs_fanhold_shared];
        dispatch_async(dispatch_get_main_queue(), ^{
            axs_fanhold_install_with_retry(15);
        });
    }
}
