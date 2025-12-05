const { withSettingsGradle } = require('@expo/config-plugins');

/**
 * Plugin pour corriger la résolution du plugin expo-module-gradle-plugin
 * qui n'est pas trouvé lors du build EAS
 */
const withExpoModuleGradlePlugin = (config) => {
  return withSettingsGradle(config, (config) => {
    const settingsGradle = config.modResults;
    
    // Vérifier si le pluginManagement existe déjà
    if (!settingsGradle.contents.includes('pluginManagement')) {
      // Ajouter pluginManagement au début du fichier
      const pluginManagementBlock = `
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    
    // Inclure le plugin Expo Gradle
    def expoModulesAutolinkingPath = file("${'$'}{rootDir}/../node_modules/expo-modules-autolinking")
    if (expoModulesAutolinkingPath.exists()) {
        includeBuild("${'$'}{rootDir}/../node_modules/expo-modules-autolinking/android/expo-gradle-plugin")
    }
}

`;
      settingsGradle.contents = pluginManagementBlock + settingsGradle.contents;
    } else {
      // Si pluginManagement existe, s'assurer que le plugin Expo est inclus
      if (!settingsGradle.contents.includes('expo-modules-autolinking')) {
        // Ajouter l'inclusion du plugin dans le bloc pluginManagement existant
        settingsGradle.contents = settingsGradle.contents.replace(
          /pluginManagement\s*\{/,
          `pluginManagement {
    // Inclure le plugin Expo Gradle
    def expoModulesAutolinkingPath = file("\${rootDir}/../node_modules/expo-modules-autolinking")
    if (expoModulesAutolinkingPath.exists()) {
        includeBuild("\${rootDir}/../node_modules/expo-modules-autolinking/android/expo-gradle-plugin")
    }`
        );
      }
    }
    
    return config;
  });
};

module.exports = withExpoModuleGradlePlugin;

