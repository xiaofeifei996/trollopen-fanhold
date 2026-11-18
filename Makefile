DEBUG = 0
FINALPACKAGE = 1

ARCHS = arm64 arm64e

# Share the SDK and deployment targets with the PreferenceBundle.
include AxsFanHoldBuild.mk
include $(THEOS)/makefiles/common.mk

TWEAK_NAME = AxsFanHold
AxsFanHold_FILES = $(wildcard Hooks/*.xm Sources/*.m)
AxsFanHold_CFLAGS = -fobjc-arc -I./Headers -I./Sources
AxsFanHold_FRAMEWORKS = UIKit Foundation CoreFoundation
AxsFanHold_LIBRARIES = substrate

include $(THEOS_MAKE_PATH)/tweak.mk

SUBPROJECTS += AxsFanHoldPrefs
include $(THEOS_MAKE_PATH)/aggregate.mk
