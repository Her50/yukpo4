#!/usr/bin/env node
// Expo config plugin to remove unsupported 'enableBundleCompression' from android/app/build.gradle
const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

const PLUGIN_NAME = 'fix-react-gradle-enableBundleCompression';
const PLUGIN_VERSION = '1.0.0';

function removeEnableBundleCompression(contents) {
    // Remove lines like: enableBundleCompression = true OR enableBundleCompression true
    const pattern = /^\s*enableBundleCompression\s*(=\s*)?true\s*$/gm;
    return contents.replace(pattern, match => `// ${match}  // removed by ${PLUGIN_NAME}`);
}

const withFixReactGradle = (config) => {
    return withAppBuildGradle(config, (cfg) => {
        if (cfg.modResults.language === 'groovy') {
            cfg.modResults.contents = removeEnableBundleCompression(cfg.modResults.contents || '');
        }
        return cfg;
    });
};

module.exports = createRunOncePlugin(withFixReactGradle, PLUGIN_NAME, PLUGIN_VERSION);


