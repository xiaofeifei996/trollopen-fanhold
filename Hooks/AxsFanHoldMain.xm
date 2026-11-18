#import <UIKit/UIKit.h>
#import <substrate.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <unistd.h>
#import "AxsFanHoldConfig.h"
#import "AxsFanHoldPrivate.h"
#import "AxsFanHoldShortcutRunner.h"

// TrollOpen 扇形菜单：让“快捷指令”条目按住不松手即可运行。
//
// 真机实测（Frida，iOS 16.4 / arm64）确认的事实：
//  · 菜单视图是 TOJBClass004，父链 TOJBClass004 > TOJBR0 > TOJBW0。
//  · 手势识别器 TOJBClass041 的回调 -TOJBMETHOD081: 确实被调用，
//    状态序列 1(Began) → 2(Changed) → 3(Ended)。
//  · trackingGestureActive 自 Began 起恒为 1，不能用于判断手指是否移动。
//  · fullyRevealed 实测恒为 0，同样不能作为“菜单已展开”的判据。
//  · 手势的 view 父链里没有菜单，菜单实例要在 didMoveToSuperview 时捕获。
//  · items 是 NSDictionary 数组，键为 type/identifier/title/icon/stateful。
//    type: 0=应用 1=内置动作 2=快捷指令 3=URL
//
// 做法：手势期间轮询指尖位置，静止满 holdDuration 且指尖下是 type==2 的条目，
// 就按点击流程运行该快捷指令。手指一动就重新计时，不影响原有拖动选择。

static NSString *const kAxsFanHoldMenuClassName = @"TOJBClass004";
static NSString *const kAxsFanHoldGestureClassName = @"TOJBClass041";
static NSString *const kAxsFanHoldGestureCallback = @"TOJBMETHOD081:";

static const NSInteger AxsFanHoldItemTypeShortcut = 2;
static const CGFloat AxsFanHoldMoveTolerance = 3.0;
static const NSTimeInterval AxsFanHoldTickInterval = 0.05;

#pragma mark - 菜单实例捕获

static __weak UIView *axs_fanhold_current_menu = nil;

static BOOL axs_fanhold_is_menu_view(id view) {
    if (![view isKindOfClass:[UIView class]]) return NO;
    return [view respondsToSelector:@selector(buttonFinalCenters)] &&
           [view respondsToSelector:@selector(items)] &&
           [view respondsToSelector:@selector(currentHighlightedItem)];
}

static id axs_fanhold_search_subtree(id view, int depth) {
    if (!view || depth < 0) return nil;
    if (axs_fanhold_is_menu_view(view)) return view;
    NSArray *subviews = nil;
    if ([view respondsToSelector:@selector(subviews)]) subviews = [view subviews];
    if (![subviews isKindOfClass:[NSArray class]]) return nil;
    for (id sub in subviews) {
        id found = axs_fanhold_search_subtree(sub, depth - 1);
        if (found) return found;
    }
    return nil;
}

static UIView *axs_fanhold_resolve_menu(UIGestureRecognizer *gesture) {
    UIView *menu = axs_fanhold_current_menu;
    if (menu && axs_fanhold_is_menu_view(menu) && menu.superview) return menu;

    UIView *found = axs_fanhold_search_subtree(gesture.view.window, 10);
    if (found) axs_fanhold_current_menu = found;
    return found;
}

#pragma mark - 条目判定

/// 条目是 NSDictionary（键 type/identifier/title/icon）；兼容对象形式的 itemKind。
static NSInteger axs_fanhold_item_type(id item) {
    if (!item) return -1;
    if ([item isKindOfClass:[NSDictionary class]]) {
        id value = ((NSDictionary *)item)[@"type"];
        return [value isKindOfClass:[NSNumber class]] ? [value integerValue] : -1;
    }
    if ([item respondsToSelector:@selector(itemKind)]) {
        return (NSInteger)((long long (*)(id, SEL))objc_msgSend)(
            item, sel_registerName("itemKind"));
    }
    return -1;
}

static NSString *axs_fanhold_item_identifier(id item) {
    if (!item) return nil;
    if ([item isKindOfClass:[NSDictionary class]]) {
        id value = ((NSDictionary *)item)[@"identifier"];
        return [value isKindOfClass:[NSString class]] ? value : nil;
    }
    SEL sel = sel_registerName("identifier");
    if (![item respondsToSelector:sel]) return nil;
    id value = ((id (*)(id, SEL))objc_msgSend)(item, sel);
    return [value isKindOfClass:[NSString class]] ? value : nil;
}

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
    if (axs_fanhold_item_type(item) == AxsFanHoldItemTypeShortcut) return YES;
    // type 缺失时用 identifier 形态兜底。
    NSString *identifier = axs_fanhold_item_identifier(item);
    return identifier && axs_fanhold_looks_like_workflow_identifier(identifier);
}

/// 指尖下的条目：优先高亮项，取不到时按按钮中心点就近匹配。
static id axs_fanhold_item_at_point(UIView *menu, CGPoint location) {
    id highlighted = [menu respondsToSelector:@selector(currentHighlightedItem)]
                   ? [menu valueForKey:@"currentHighlightedItem"] : nil;
    if (highlighted) return highlighted;

    NSArray *items = [menu valueForKey:@"items"];
    NSArray *centers = [menu valueForKey:@"buttonFinalCenters"];
    if (![items isKindOfClass:[NSArray class]] || items.count == 0) return nil;
    if (![centers isKindOfClass:[NSArray class]] || centers.count != items.count) return nil;

    double iconSize = 0;
    if ([menu respondsToSelector:@selector(iconSize)]) {
        iconSize = [[menu valueForKey:@"iconSize"] doubleValue];
    }
    if (iconSize <= 0) iconSize = 44.0;
    double limit = iconSize * 0.5 + 10.0;

    NSInteger bestIndex = NSNotFound;
    double bestDistance = limit * limit;
    for (NSUInteger i = 0; i < centers.count; i++) {
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

static void axs_fanhold_run_item(UIView *menu, id item) {
    NSString *identifier = axs_fanhold_item_identifier(item);
    if (identifier.length == 0) return;

    UIImpactFeedbackGenerator *feedback =
        [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
    [feedback prepare];
    [feedback impactOccurred];

    // 只清空高亮，避免松手时 TrollOpen 再执行一次同一项。
    // 不要隐藏窗口或菜单：TrollOpen 复用同一个窗口，隐藏后第二次呼出就再也看不见。
    // 菜单本身会在手指抬起时由 TrollOpen 自己的 Ended 分支收起。
    if ([menu respondsToSelector:@selector(setCurrentHighlightedItem:)]) {
        ((void (*)(id, SEL, id))objc_msgSend)(menu,
            sel_registerName("setCurrentHighlightedItem:"), nil);
    }

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        [AxsFanHoldShortcutRunner axs_fanhold_runWorkflowIdentifier:identifier];
    });
}

#pragma mark - 静止监视器

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
    self.lastLocation = CGPointMake(-CGFLOAT_MAX, -CGFLOAT_MAX);
    self.stillSince = [NSDate timeIntervalSinceReferenceDate];

    self.timer = [NSTimer timerWithTimeInterval:AxsFanHoldTickInterval
                                         target:self
                                       selector:@selector(axs_fanhold_tick)
                                       userInfo:nil
                                        repeats:YES];
    // CommonModes：拖动期间 RunLoop 处于 tracking 模式也能继续走。
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

    UIGestureRecognizerState state = gesture.state;
    if (state != UIGestureRecognizerStateBegan && state != UIGestureRecognizerStateChanged) {
        [self axs_fanhold_stop];
        return;
    }

    if (![[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_isEnabled]) {
        [self axs_fanhold_stop];
        return;
    }

    UIView *menu = axs_fanhold_resolve_menu(gesture);
    NSTimeInterval now = [NSDate timeIntervalSinceReferenceDate];
    if (!menu) {
        self.stillSince = now;
        self.lastLocation = CGPointMake(-CGFLOAT_MAX, -CGFLOAT_MAX);
        return;
    }

    CGPoint location = [gesture locationInView:menu];
    CGFloat dx = location.x - self.lastLocation.x;
    CGFloat dy = location.y - self.lastLocation.y;
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
    if (!axs_fanhold_item_is_shortcut(item)) return;

    self.fired = YES;
    [self axs_fanhold_stop];
    axs_fanhold_run_item(menu, item);
}

@end

#pragma mark - hook

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

    // 已经触发过：松手前清掉高亮，防止 TrollOpen 再执行一次。
    if (state == UIGestureRecognizerStateEnded ||
        state == UIGestureRecognizerStateCancelled ||
        state == UIGestureRecognizerStateFailed) {
        AxsFanHoldWatcher *watcher = [watchers objectForKey:gesture];
        if (watcher.fired) {
            UIView *menu = axs_fanhold_current_menu;
            if (menu && [menu respondsToSelector:@selector(setCurrentHighlightedItem:)]) {
                ((void (*)(id, SEL, id))objc_msgSend)(menu,
                    sel_registerName("setCurrentHighlightedItem:"), nil);
            }
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
            [[watchers objectForKey:gesture] axs_fanhold_stop];
            [watchers removeObjectForKey:gesture];
            break;
        }
        default:
            break;
    }
}

static void (*axs_fanhold_orig_menu_did_move)(id, SEL);

static void axs_fanhold_replaced_menu_did_move(id self, SEL _cmd) {
    if (axs_fanhold_orig_menu_did_move) axs_fanhold_orig_menu_did_move(self, _cmd);
    if (![self isKindOfClass:[UIView class]]) return;

    UIView *menu = (UIView *)self;
    axs_fanhold_current_menu = menu;

    // 自愈：旧版本隐藏过共享窗口，会导至第二次呼出菜单不可见。
    UIWindow *window = menu.window;
    if (window) {
        if (window.hidden) window.hidden = NO;
        if (window.alpha < 1.0) window.alpha = 1.0;
    }
    if (menu.hidden) menu.hidden = NO;
    if (menu.alpha < 1.0) menu.alpha = 1.0;
}

static void axs_fanhold_install_hooks(void) {
    Class menuClass = NSClassFromString(kAxsFanHoldMenuClassName);
    if (menuClass) {
        MSHookMessageEx(menuClass, @selector(didMoveToSuperview),
                        (IMP)axs_fanhold_replaced_menu_did_move,
                        (IMP *)&axs_fanhold_orig_menu_did_move);
    }

    Class gestureClass = NSClassFromString(kAxsFanHoldGestureClassName);
    if (gestureClass) {
        MSHookMessageEx(gestureClass, NSSelectorFromString(kAxsFanHoldGestureCallback),
                        (IMP)axs_fanhold_replaced_gesture_update,
                        (IMP *)&axs_fanhold_orig_gesture_update);
    }
}

static void axs_fanhold_install_with_retry(int remaining) {
    BOOL menuReady = NSClassFromString(kAxsFanHoldMenuClassName) != nil;
    BOOL gestureReady = NSClassFromString(kAxsFanHoldGestureClassName) != nil;
    if (menuReady && gestureReady) {
        axs_fanhold_install_hooks();
        return;
    }
    if (remaining <= 0) return;
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
