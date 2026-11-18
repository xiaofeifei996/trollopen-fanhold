#pragma once

#import <Preferences/PSTableCell.h>
#import <Preferences/PSSpecifier.h>
#include <math.h>

@protocol AxsFanHoldSliderCellHandler <NSObject>
- (double)axs_fanhold_sliderValueForSpecifier:(PSSpecifier *)specifier;
- (void)axs_fanhold_setSliderValue:(double)value specifier:(PSSpecifier *)specifier;
@end

@interface AxsFanHoldSliderCell : PSTableCell
@property (nonatomic, weak) id<AxsFanHoldSliderCellHandler> handler;
- (void)axs_fanhold_reloadState;
@end
