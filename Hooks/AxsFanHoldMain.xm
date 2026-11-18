#import <UIKit/UIKit.h>
#import <substrate.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import "AxsFanHoldConfig.h"
#import "AxsFanHoldPrivate.h"
#import "AxsFanHoldShortcutRunner.h"

// TrollOpen 扇形菜单：让“快捷指令”条目按住不松手即可运行。
//
// 根因（TrollOpenJB.dylib 2.0.1 手势状态机）：
//   -[TOJBClass041 TOJBMETHOD081:] 在 Changed 状态下计算手指相对起点的位移，
//   位移 > 4pt 才把 trackingGestureActive 置 1 进入“拖动选择”；
//   按住不动位移为 0，原逻辑直接返回，菜单既不收起也不执行任何条目。
//
// 做法：按下时（Began）启动一个定时器，到点后确认
//   · 手势仍在进行、手指没有移动（trackingGestureActive == NO）
//   · 菜单已完全展开
//   · 当前高亮项是快捷指令（itemKind == 2）
// 成立就按点击流程执行该条目。手指一动就放弃，交还 TrollOpen 的拖动选择。

static NSString *const kAxsFanHoldMenuClassName = @"TOJBClass004";
static NSString *const kAxsFanHoldGestureClassName = @"TOJBClass041";
static NSString *const kAxsFanHoldGestureCallback = @"TOJBMETHOD081:";

static const long long AxsFanHoldItemKindShortcut = 2;

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

static long long axs_fanhold_gesture_state(id gesture) {
    return axs_fanhold_readLongLong(gesture, "state");
}

/// 从手势识别器往上找扇形菜单视图。
static id axs_fanhold_find_menu_view(id gesture) {
    id view = axs_fanhold_send(gesture, "view");
    Class menuClass = NSClassFromString(kAxsFanHoldMenuClassName);
    for (int depth = 0; depth < 10 && view; depth++) {
        if (menuClass && [view isKindOfClass:menuClass]) return view;
        view = axs_fanhold_send(view, "superview");
    }
    return nil;
}

#pragma mark - 执行条目

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
    NSString *identifier = axs_fanhold_send(item, "identifier");
    if (![identifier isKindOfClass:[NSString class]] || identifier.length == 0) return;

    UIImpactFeedbackGenerator *feedback =
        [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
    [feedback prepare];
    [feedback impactOccurred];

    axs_fanhold_dismiss_menu(menu);

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.15 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        [AxsFanHoldShortcutRunner axs_fanhold_runWorkflowIdentifier:identifier];
    });
}

#pragma mark - 长按计时

// 每个手势识别器实例一个定时器，手势结束即取消。
static NSMapTable<UIGestureRecognizer *, NSTimer *> *axs_fanhold_timers(void) {
    static NSMapTable *table;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ table = [NSMapTable weakToStrongObjectsMapTable]; });
    return table;
}

static void axs_fanhold_cancel_timer(UIGestureRecognizer *gesture) {
    if (!gesture) return;
    NSMapTable *timers = axs_fanhold_timers();
    NSTimer *timer = [timers objectForKey:gesture];
    if (timer) {
        [timer invalidate];
        [timers removeObjectForKey:gesture];
    }
}

@interface AxsFanHoldTimerTarget : NSObject
@property (nonatomic, weak) UIGestureRecognizer *gesture;
- (void)axs_fanhold_fire;
@end

@implementation AxsFanHoldTimerTarget
- (void)axs_fanhold_fire {
    UIGestureRecognizer *gesture = self.gesture;
    if (!gesture) return;
    if (![[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_isEnabled]) return;

    // 手势必须仍在进行中。
    long long state = axs_fanhold_gesture_state(gesture);
    if (state != UIGestureRecognizerStateBegan && state != UIGestureRecognizerStateChanged) return;

    // 手指移动过就交给 TrollOpen 的拖动选择。
    if (axs_fanhold_readBool(gesture, "trackingGestureActive")) return;

    id menu = axs_fanhold_find_menu_view(gesture);
    if (!menu) return;
    if (!axs_fanhold_readBool(menu, "fullyRevealed")) return;

    id item = axs_fanhold_send(menu, "currentHighlightedItem");
    if (!item) return;
    if (axs_fanhold_readLongLong(item, "itemKind") != AxsFanHoldItemKindShortcut) return;

    axs_fanhold_cancel_timer(gesture);
    axs_fanhold_run_item(menu, item);
}
@end

static void axs_fanhold_schedule_timer(UIGestureRecognizer *gesture) {
    axs_fanhold_cancel_timer(gesture);

    AxsFanHoldTimerTarget *target = [[AxsFanHoldTimerTarget alloc] init];
    target.gesture = gesture;
    NSTimeInterval delay = [[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_holdDuration];
    NSTimer *timer = [NSTimer timerWithTimeInterval:delay
                                             target:target
                                           selector:@selector(axs_fanhold_fire)
                                           userInfo:nil
                                            repeats:NO];
    [[NSRunLoop mainRunLoop] addTimer:timer forMode:NSRunLoopCommonModes];
    [axs_fanhold_timers() setObject:timer forKey:gesture];
}

#pragma mark - 状态机 hook

static void (*axs_fanhold_orig_gesture_update)(id, SEL, id);

static void axs_fanhold_replaced_gesture_update(id self, SEL _cmd, id gestureRecognizer) {
    // 先让 TrollOpen 处理，它负责展开菜单、更新高亮。
    if (axs_fanhold_orig_gesture_update) axs_fanhold_orig_gesture_update(self, _cmd, gestureRecognizer);

    if (![gestureRecognizer isKindOfClass:[UIGestureRecognizer class]]) return;
    UIGestureRecognizer *gesture = (UIGestureRecognizer *)gestureRecognizer;

    if (![[AxsFanHoldConfig axs_fanhold_shared] axs_fanhold_isEnabled]) {
        axs_fanhold_cancel_timer(gesture);
        return;
    }

    switch (gesture.state) {
        case UIGestureRecognizerStateBegan:
            axs_fanhold_schedule_timer(gesture);
            break;
        case UIGestureRecognizerStateEnded:
        case UIGestureRecognizerStateCancelled:
        case UIGestureRecognizerStateFailed:
            axs_fanhold_cancel_timer(gesture);
            break;
        default:
            break;
    }
}

#pragma mark - 安装

static void axs_fanhold_install_hooks(void) {
    Class gestureClass = NSClassFromString(kAxsFanHoldGestureClassName);
    if (!gestureClass) return;

    MSHookMessageEx(gestureClass, NSSelectorFromString(kAxsFanHoldGestureCallback),
                    (IMP)axs_fanhold_replaced_gesture_update,
                    (IMP *)&axs_fanhold_orig_gesture_update);
}

static void axs_fanhold_install_with_retry(int remaining) {
    if (NSClassFromString(kAxsFanHoldGestureClassName)) {
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
            axs_fanhold_install_with_retry(10);
        });
    }
}
