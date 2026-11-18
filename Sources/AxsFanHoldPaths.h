#pragma once

#import <Foundation/Foundation.h>

#ifdef THEOS_PACKAGE_SCHEME_ROOTHIDE
#import <roothide.h>
#else
#import <rootless.h>
#endif

static inline NSString *axs_fanhold_resourcePath(NSString *rootfsPath) {
#ifdef THEOS_PACKAGE_SCHEME_ROOTHIDE
    return jbroot(rootfsPath);
#else
    return ROOT_PATH_NS_VAR(rootfsPath);
#endif
}

static inline NSString *axs_fanhold_preferencesPath(void) {
    NSString *path = @"/var/mobile/Library/Preferences/com.axs.fanhold.plist";
// Mobile user preferences are outside the jailbreak root on both RootHide
// and rootless setups; do not pass this path through jbroot/ROOT_PATH_NS.
    return path;
}
