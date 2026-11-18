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
// 运行时实测（Frida，iOS 16.4 / arm64）：
//  · 菜单视图是 TOJBClass004，父链 TOJBClass004 > TOJBR0 > TOJBW0。
//  · 手势识别器 TOJBClass041 的回调 -TOJBMETHOD081: 确实被调用，
//    状态序列 1(Began) → 2(Changed) → 3(Ended)。
//  · trackingGestureActive 自 Began 起恒为 1，不能用来判断手指是否移动。
//  · 手势的 view 父链里没有菜单，菜单实例要在 didMoveToSuperview 时捕获。
//  · items 是 NSDictionary 数组，键为 type/identifier/title/icon/stateful；
//    不是 TOJBClass031 对象，也没有 itemKind 方法。
//    实测样本：{ icon = "lock.rotation"; identifier = ToggleOrientation;
//                stateful = 1; title = 方向锁定; type = 1; }
//  · buttonFinalCenters 是与 items 等长的 NSValue(CGPoint) 数组。
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

// 驱动扇形菜单的手势识别器。
@interface TOJBClass041 : UIGestureRecognizer
@property (nonatomic, assign) BOOL trackingGestureActive;
@end
