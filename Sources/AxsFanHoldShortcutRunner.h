#pragma once

#import <Foundation/Foundation.h>

/// 运行一条“快捷指令”（Shortcuts / Workflow）。
/// 优先用 VoiceShortcutClient 直接按 workflow UUID 运行，
/// 这样即使扇形菜单按钮本身不响应也能打开。
@interface AxsFanHoldShortcutRunner : NSObject

+ (BOOL)axs_fanhold_runWorkflowIdentifier:(NSString *)identifier;
+ (BOOL)axs_fanhold_isShortcutsAvailable;

@end
