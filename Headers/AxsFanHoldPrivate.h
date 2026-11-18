#pragma once

#import <UIKit/UIKit.h>

// 只声明实际用到的私有接口，名称与系统 / 第三方二进制一致，按约定保持原样。

// ---- WorkflowKit / VoiceShortcutClient（快捷指令）----
@interface WFSpringBoardWorkflowRunnerClient : NSObject
- (instancetype)initWithWorkflowIdentifier:(NSString *)identifier;
- (void)start;
@end

// ---- TrollOpen 扇形菜单（com.charlieleung.trollopenjb 2.0.1，真机实测确认）----
//
// 运行时实测结论（Frida，iOS 16.4 / arm64）：
//  · 扇形菜单视图是 TOJBClass004，父链 TOJBClass004 > TOJBR0 > TOJBW0。
//  · 手势识别器 TOJBClass041 挂在 TOJBW0 的子视图上，
//    其回调 -TOJBMETHOD081: 确实被调用，序列为 state 1(Began) → 2(Changed) → 3(Ended)。
//  · trackingGestureActive 实测自 Began 起恒为 1，不能用来判断“手指是否移动”。
//  · 菜单持有 items(48) / buttonFinalCenters(48) / iconSize(38)，
//    currentHighlightedItem 随指尖更新；执行条目的是 TOJBMETHOD043:/044:。
@interface TOJBClass004 : UIView
@property (nonatomic, copy) NSArray *buttons;
@property (nonatomic, copy) NSArray *items;
@property (nonatomic, copy) NSArray *buttonFinalCenters;
@property (nonatomic, strong) id currentHighlightedItem;
@property (nonatomic, assign, getter=isFullyRevealed) BOOL fullyRevealed;
@property (nonatomic, assign) CGPoint startLocation;
@property (nonatomic, assign) double initialRadius;
@property (nonatomic, assign) double iconSize;
@end

// 菜单条目模型。itemKind: 0=应用 1=内置动作 2=快捷指令 3=URL
@interface TOJBClass031 : NSObject
@property (nonatomic, assign) long long itemKind;
@property (nonatomic, copy) NSString *identifier;
@property (nonatomic, copy) NSString *displayName;
@property (nonatomic, copy) NSString *iconName;
@end

// 驱动扇形菜单的手势识别器。
@interface TOJBClass041 : UIGestureRecognizer
@property (nonatomic, assign) BOOL trackingGestureActive;
@end
