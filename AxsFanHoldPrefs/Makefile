include ../AxsFanHoldBuild.mk
include $(THEOS)/makefiles/common.mk

BUNDLE_NAME = AxsFanHoldPrefs
AxsFanHoldPrefs_FILES = $(wildcard *.m)
AxsFanHoldPrefs_CFLAGS = -fobjc-arc -I../Sources
AxsFanHoldPrefs_FRAMEWORKS = UIKit Foundation CoreFoundation
AxsFanHoldPrefs_PRIVATE_FRAMEWORKS = Preferences
AxsFanHoldPrefs_INSTALL_PATH = /Library/PreferenceBundles

include $(THEOS_MAKE_PATH)/bundle.mk
