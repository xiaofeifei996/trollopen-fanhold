#pragma once

#import <UIKit/UIKit.h>

// 只声明实际用到的私有接口，名称与系统 / 第三方二进制一致，按约定保持原样。

// ---- WorkflowKit / VoiceShortcutClient（快捷指令）----
@interface WFSpringBoardWorkflowRunnerClient : NSObject
- (instancetype)initWithWorkflowIdentifier:(NSString *)identifier;
- (void)start;
@end

// ---- TrollOpen 扇形菜单（com.charlieleung.trollopenjb 2.0.1）----
// 类名取自 TrollOpenJB.dylib 的 __objc_classlist。
// 属性通过 KVC / objc_msgSend 读取，不依赖被混淆的 ivar 偏移。

// 扇形菜单视图本体：持有按钮、条目与当前高亮项。
@interface TOJBClass004 : UIView
@property (nonatomic, copy) NSArray *buttons;
@property (nonatomic, copy) NSArray *items;
@property (nonatomic, copy) NSArray *buttonFinalCenters;
@property (nonatomic, strong) id currentHighlightedItem;
@property (nonatomic, assign, getter=isFullyRevealed) BOOL fullyRevealed;
@property (nonatomic, assign) CGPoint startLocation;
@property (nonatomic, assign) double initialRadius;
@end

// 菜单条目模型。itemKind: 0=应用 1=内置动作 2=快捷指令 3=URL
@interface TOJBClass031 : NSObject
@property (nonatomic, assign) long long itemKind;
@property (nonatomic, copy) NSString *identifier;
@property (nonatomic, copy) NSString *displayName;
@property (nonatomic, copy) NSString *iconName;
@end

// 驱动扇形菜单的手势识别器；-TOJBMETHOD081: 是它的状态机回调。
@interface TOJBClass041 : UIGestureRecognizer
@end
