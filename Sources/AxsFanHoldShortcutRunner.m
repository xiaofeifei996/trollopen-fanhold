#import "AxsFanHoldShortcutRunner.h"
#import "AxsFanHoldPrivate.h"

@implementation AxsFanHoldShortcutRunner

+ (BOOL)axs_fanhold_isShortcutsAvailable {
    return NSClassFromString(@"WFSpringBoardWorkflowRunnerClient") != nil;
}

+ (BOOL)axs_fanhold_runWorkflowIdentifier:(NSString *)identifier {
    if (identifier.length == 0) return NO;
    Class runner = NSClassFromString(@"WFSpringBoardWorkflowRunnerClient");
    if (!runner) return NO;

    id instance = [[runner alloc] initWithWorkflowIdentifier:identifier];
    if (!instance) return NO;

    SEL start = NSSelectorFromString(@"start");
    if (![instance respondsToSelector:start]) return NO;

    // 私有 API，按 IMP 调用，避免 ARC 下 performSelector 的警告。
    typedef void (*AxsFanHoldStartFn)(id, SEL);
    AxsFanHoldStartFn fn = (AxsFanHoldStartFn)[instance methodForSelector:start];
    if (!fn) return NO;
    fn(instance, start);
    return YES;
}

@end
