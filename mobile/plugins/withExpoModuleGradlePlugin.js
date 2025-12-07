const { withSettingsGradle } = require('@expo/config-plugins');

/**
 * Plugin pour corriger la résolution du plugin expo-module-gradle-plugin
 * qui n'est pas trouvé lors du build EAS
 */
const withExpoModuleGradlePlugin = (config) => {
  return withSettingsGradle(config, (config) => {
    const settingsGradle = config.modResults;
    let contents = settingsGradle.contents;

    // S'assurer que le plugin Expo est inclus dans pluginManagement
    if (!contents.includes('expo-modules-autolinking') || !contents.includes('expo-gradle-plugin')) {
      // Si pluginManagement n'existe pas, l'ajouter
      if (!contents.includes('pluginManagement')) {
        const pluginManagementBlock = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    
    // Inclure le plugin Expo Gradle
    def expoModulesAutolinkingPath = file("\${rootDir}/../node_modules/expo-modules-autolinking")
    if (expoModulesAutolinkingPath.exists()) {
        includeBuild("\${rootDir}/../node_modules/expo-modules-autolinking/android/expo-gradle-plugin")
    }
}

`;
        contents = pluginManagementBlock + contents;
      } else {
        // Si pluginManagement existe, ajouter l'inclusion du plugin
        if (!contents.includes('expo-modules-autolinking')) {
          // Trouver le bloc pluginManagement et ajouter l'inclusion
          contents = contents.replace(
            /(pluginManagement\s*\{[^}]*repositories[^}]*\})/s,
            `$1
    
    // Inclure le plugin Expo Gradle
    def expoModulesAutolinkingPath = file("\\\${rootDir}/../node_modules/expo-modules-autolinking")
    if (expoModulesAutolinkingPath.exists()) {
        includeBuild("\\\${rootDir}/../node_modules/expo-modules-autolinking/android/expo-gradle-plugin")
    }`
          );
        }
      }

      settingsGradle.contents = contents;
    }

    return config;
  });
};

module.exports = withExpoModuleGradlePlugin;

