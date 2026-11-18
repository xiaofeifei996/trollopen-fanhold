#import "AxsFanHoldConfig.h"
#import "AxsFanHoldPreferences.h"

@interface AxsFanHoldConfig ()
@property (atomic, copy) NSDictionary *snapshot;
@property (nonatomic, strong) dispatch_queue_t reloadQueue;
@end

static void axs_fanhold_preferencesDidChange(CFNotificationCenterRef center, void *observer,
                                          CFStringRef name, const void *object, CFDictionaryRef info) {
    AxsFanHoldConfig *config = (__bridge AxsFanHoldConfig *)observer;
    dispatch_async(config.reloadQueue, ^{
        [config axs_fanhold_reload];
    });
}

@implementation AxsFanHoldConfig

+ (instancetype)axs_fanhold_shared {
    static AxsFanHoldConfig *instance;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[self alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _reloadQueue = dispatch_queue_create("com.axs.fanhold.preferences", DISPATCH_QUEUE_SERIAL);
        [self axs_fanhold_reload];
        CFNotificationCenterAddObserver(CFNotificationCenterGetDarwinNotifyCenter(),
            (__bridge const void *)self, axs_fanhold_preferencesDidChange,
            (__bridge CFStringRef)AxsFanHoldPreferencesChanged, NULL,
            CFNotificationSuspensionBehaviorDeliverImmediately);
        // Close the window between the first read and observer registration.
        dispatch_async(_reloadQueue, ^{ [self axs_fanhold_reload]; });
    }
    return self;
}

- (void)axs_fanhold_reload {
    self.snapshot = axs_fanhold_readPreferences();
    dispatch_async(dispatch_get_main_queue(), ^{
        [[NSNotificationCenter defaultCenter] postNotificationName:AxsFanHoldPreferencesChanged object:self];
    });
}

- (id)axs_fanhold_valueForKey:(NSString *)key defaultValue:(id)defaultValue {
    return self.snapshot[key] ?: defaultValue;
}

- (BOOL)axs_fanhold_isEnabled {
    id value = [self axs_fanhold_valueForKey:@"enabled" defaultValue:@(YES)];
    return [value isKindOfClass:[NSNumber class]] ? [value boolValue] : YES;
}

- (NSTimeInterval)axs_fanhold_holdDuration {
    id value = [self axs_fanhold_valueForKey:@"holdDuration" defaultValue:nil];
    if ([value isKindOfClass:[NSNumber class]]) {
        double seconds = [value doubleValue];
        if (seconds >= 0.1 && seconds <= 2.0) return seconds;
    }
    return 0.4;
}

- (BOOL)axs_fanhold_isDebugLogEnabled {
    id value = [self axs_fanhold_valueForKey:@"debugLog" defaultValue:@(NO)];
    return [value isKindOfClass:[NSNumber class]] ? [value boolValue] : NO;
}

- (void)dealloc {
    CFNotificationCenterRemoveEveryObserver(CFNotificationCenterGetDarwinNotifyCenter(),
                                            (__bridge const void *)self);
}

@end
