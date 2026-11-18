#pragma once

#import <Foundation/Foundation.h>

@interface AxsFanHoldConfig : NSObject
+ (instancetype)axs_fanhold_shared;
- (BOOL)axs_fanhold_isEnabled;
/// 长按时长（秒），默认 0.4，范围 0.1–2.0。
- (NSTimeInterval)axs_fanhold_holdDuration;
/// 是否写调试日志到 /var/mobile/Library/Logs/AxsFanHold.log。
- (BOOL)axs_fanhold_isDebugLogEnabled;
- (id)axs_fanhold_valueForKey:(NSString *)key defaultValue:(id)defaultValue;
- (void)axs_fanhold_reload;
@end
