#import <UIKit/UIKit.h>
#import <substrate.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import "AxsFanHoldConfig.h"
#import "AxsFanHoldPrivate.h"
#import "AxsFanHoldShortcutRunner.h"

// TrollOpen 扇形菜单：让“快捷指令”条目按住不松手即可运行。
//
// 真机实测（Frida，iOS 16.4 / arm64）确认：
//  · 菜单视图 TOJBClass004，手势识别器 TOJBClass041，
//    回调 -TOJBMETHOD081: 状态序列 1(Began) → 2(Changed) → 3(Ended)。
//  · trackingGestureActive 恒为 1；fullyRevealed 恒为 0；两者都不能当判据。
//  · items 是 NSDictionary 数组（键 type/identifier/title/icon/stateful），
//    type: 0=应用 1=内置动作 2=快捷指令 3=URL。
//  · 手指停住时手势不再回调，高亮项也停止更新。
//
// 做法：监听 setCurrentHighlightedItem:，记住“最近一次高亮的快捷指令条目”。
// 若持续 holdDuration 没有新的高亮更新（说明手指停在该项上没动），
// 就把手势状态强制置为 Ended —— 剩下交给 TrollOpen 自己的松手执行逻辑，
// 与正常松手走完全相同的代码路径，既不会重复执行也不需要猜它怎么运行快捷指令。

static NSString *const kAxsFanHoldMenuClassName = @"TOJBClass004";
static NSString *const kAxsFanHoldGestureClassName = @"TOJBClass041";
static NSString *const kAxsFanHoldGestureCallback = @"TOJBMETHOD081:";

static const NSInteger AxsFanHoldItemTypeShortcut = 2;
static const NSTimeInterval AxsFanHoldTickInterval = 0.05;

#pragma mark - 状态

static __weak UIGestureRecognizer *axs_fanhold_active_gesture = nil;
static __weak id axs_fanhold_pending_item = nil;
static NSTimeInterval axs_fanhold_pending_since = 0;
static BOOL axs_fanhold_fired = NO;
static NSTimer *axs_fanhold_timer = nil;

#pragma mark - 条目判定

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

static BOOL axs_fanhold_looks_like_workflow_identifier(NSString *identifier) {
    if (identifier.length != 36) return NO;
    static const NSUInteger dashes[] = {8, 13, 18, 23};
    for (NSUInteger i = 0; i < 4; i++) {
        if ([identifier characterAtIndex:dashes[i]] != '-') return NO;
    }
    return YES;
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

static BOOL axs_fanhold_item_is_shortcut(id item) {
    if (!item) return NO;
    if (axs_fanhold_item_type(item) == AxsFanHoldItemTypeShortcut) return YES;
    NSString *identifier = axs_fanhold_item_identifier(item);
    return identifier && axs_fanhold_looks_like_workflow_identifier(identifier);
}

#pragma mark - 强制结束手势

static void axs_fanhold_end_gesture(UIGestureRecognizer *gesture) {
    if (!gesture) return;
    SEL sel = sel_registerName("setState:");
    if (![gesture respondsToSelector:sel]) return;
    ((void (*)(id, SEL, long long))objc_msgSend)(
        gesture, sel, UIGestureRecognizerStateEnded);
}

#pragma mark - 计时

static void axs_fanhold_clear_pending(void) {
    axs_fanhold_pending_item = nil;
    axs_fanhold_pending_since = 0;
}

static void axs_fanhold_stop_timer(void) {
    [axs_fanhold_timer invalidate];
    axs_fanhold_timer = nil;
}

static void axs_fanhold_tick(void) {
    if (axs_fanhold_fired) { axs_fanhold_stop_timer(); return; }

    UIGestureRecognizer *gesture = axs_fanhold_active_gesture;
    if (!gesture) { axs_fanhold_stop_timer(); return; }

    UIGestureRecognizerState state = gesture.state;
    if (state != UIGestureRecognizerStateBegan && state != UIGestureRecognizerStateChanged) {
        axs_fanhold_stop_timer();
        axs_fanhold_clear_pending();
        return;
    }

    if (![[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_isEnabled]) return;

    id item = axs_fanhold_pending_item;
    if (!item || !axs_fanhold_item_is_shortcut(item)) return;

    NSTimeInterval still = [NSDate timeIntervalSinceReferenceDate] - axs_fanhold_pending_since;
    if (still < [[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_holdDuration]) return;

    // 手指停在该快捷指令上够久了：直接结束手势，交给 TrollOpen 走松手执行。
    axs_fanhold_fired = YES;
    axs_fanhold_stop_timer();

    UIImpactFeedbackGenerator *feedback =
        [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
    [feedback prepare];
    [feedback impactOccurred];

    axs_fanhold_end_gesture(gesture);
}

@interface AxsFanHoldTicker : NSObject
+ (instancetype)shared;
- (void)axs_fanhold_tick;
@end

@implementation AxsFanHoldTicker
+ (instancetype)shared {
    static AxsFanHoldTicker *instance;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ instance = [[self alloc] init]; });
    return instance;
}
- (void)axs_fanhold_tick { axs_fanhold_tick(); }
@end

static void axs_fanhold_start_timer(void) {
    if (axs_fanhold_timer) return;
    axs_fanhold_timer = [NSTimer timerWithTimeInterval:AxsFanHoldTickInterval
                                                target:[AxsFanHoldTicker shared]
                                              selector:@selector(axs_fanhold_tick)
                                              userInfo:nil
                                               repeats:YES];
    [[NSRunLoop mainRunLoop] addTimer:axs_fanhold_timer forMode:NSRunLoopCommonModes];
}

#pragma mark - hook

static void (*axs_fanhold_orig_set_highlight)(id, SEL, id);

static void axs_fanhold_replaced_set_highlight(id self, SEL _cmd, id item) {
    if (axs_fanhold_orig_set_highlight) axs_fanhold_orig_set_highlight(self, _cmd, item);

    if (axs_fanhold_fired) return;

    if (item && axs_fanhold_item_is_shortcut(item)) {
        axs_fanhold_pending_item = item;
        axs_fanhold_pending_since = [NSDate timeIntervalSinceReferenceDate];
        axs_fanhold_start_timer();
    } else if (item == nil) {
        // 高亮被清空：手已经离开该项。
        axs_fanhold_clear_pending();
    } else {
        // 滑到别的条目上，重新计时对象。
        axs_fanhold_pending_item = nil;
    }
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

    if (state == UIGestureRecognizerStateBegan) {
        axs_fanhold_active_gesture = gesture;
        axs_fanhold_fired = NO;
        axs_fanhold_clear_pending();
    } else if (state == UIGestureRecognizerStateEnded ||
               state == UIGestureRecognizerStateCancelled ||
               state == UIGestureRecognizerStateFailed) {
        axs_fanhold_stop_timer();
        axs_fanhold_clear_pending();
        if (axs_fanhold_active_gesture == gesture) axs_fanhold_active_gesture = nil;
        axs_fanhold_fired = NO;
    }

    if (axs_fanhold_orig_gesture_update) axs_fanhold_orig_gesture_update(self, _cmd, gestureRecognizer);
}

static void axs_fanhold_install_hooks(void) {
    Class menuClass = NSClassFromString(kAxsFanHoldMenuClassName);
    if (menuClass) {
        MSHookMessageEx(menuClass, sel_registerName("setCurrentHighlightedItem:"),
                        (IMP)axs_fanhold_replaced_set_highlight,
                        (IMP *)&axs_fanhold_orig_set_highlight);
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
