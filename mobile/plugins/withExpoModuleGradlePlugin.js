const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin pour corriger la résolution du plugin expo-module-gradle-plugin
 * qui n'est pas trouvé lors du build EAS
 */
const withExpoModuleGradlePlugin = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const settingsGradlePath = path.join(config.modRequest.platformProjectRoot, 'settings.gradle');

      if (fs.existsSync(settingsGradlePath)) {
        let settingsGradle = fs.readFileSync(settingsGradlePath, 'utf8');

        // S'assurer que pluginManagement inclut le plugin Expo
        if (!settingsGradle.includes('expo-modules-autolinking') || !settingsGradle.includes('expo-gradle-plugin')) {
          // Ajouter ou modifier le bloc pluginManagement
          if (!settingsGradle.includes('pluginManagement')) {
            const pluginManagementBlock = `
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

// Inclure le plugin Expo Gradle
def expoModulesAutolinkingPath = file("\${rootDir}/../node_modules/expo-modules-autolinking")
if (expoModulesAutolinkingPath.exists()) {
    includeBuild("\${rootDir}/../node_modules/expo-modules-autolinking/android/expo-gradle-plugin")
}

`;
            settingsGradle = pluginManagementBlock + settingsGradle;
          } else {
            // Ajouter l'inclusion après pluginManagement
            if (!settingsGradle.includes('expo-modules-autolinking')) {
              settingsGradle = settingsGradle.replace(
                /pluginManagement\s*\{[^}]*\}/,
                (match) => {
                  return match + `

// Inclure le plugin Expo Gradle
def expoModulesAutolinkingPath = file("\${rootDir}/../node_modules/expo-modules-autolinking")
if (expoModulesAutolinkingPath.exists()) {
    includeBuild("\${rootDir}/../node_modules/expo-modules-autolinking/android/expo-gradle-plugin")
}
`;
                }
              );
            }
          }

          fs.writeFileSync(settingsGradlePath, settingsGradle, 'utf8');
        }
      }

      return config;
    },
  ]);
};

module.exports = withExpoModuleGradlePlugin;

