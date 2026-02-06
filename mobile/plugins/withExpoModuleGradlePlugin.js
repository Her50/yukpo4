const { withSettingsGradle } = require('@expo/config-plugins');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Plugin pour corriger la résolution du plugin expo-module-gradle-plugin
 * qui n'est pas trouvé lors du build EAS
 * 
 * Résout le chemin du plugin via expo-modules-autolinking dans Node.js (pendant prebuild)
 * et injecte le chemin résolu directement dans settings.gradle
 */
const withExpoModuleGradlePlugin = (config) => {
  return withSettingsGradle(config, (config) => {
    const settingsGradle = config.modResults;
    let contents = settingsGradle.contents;

    // ✅ CORRIGÉ: Résoudre le chemin dans Node.js (pendant prebuild) et injecter dans Gradle
    let pluginSourceDir = null;
    try {
      const projectRoot = config.modRequest.projectRoot || process.cwd();
      
      // Appeler expo-modules-autolinking pour obtenir le JSON avec les plugins
      const command = `node --no-warnings --eval "require(require.resolve('expo-modules-autolinking', { paths: [require.resolve('expo/package.json')] }))(process.argv.slice(1))" react-native-config --json --platform android`;
      
      const output = execSync(command, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const json = JSON.parse(output);
      
      // Chercher le plugin expo-module-gradle-plugin dans les modules
      for (const module of json.modules || []) {
        for (const plugin of module.plugins || []) {
          if (plugin.id === 'expo-module-gradle-plugin') {
            pluginSourceDir = plugin.sourceDir;
            console.log(`✅ [withExpoModuleGradlePlugin] Found expo-module-gradle-plugin at: ${pluginSourceDir}`);
            break;
          }
        }
        if (pluginSourceDir) break;
      }
    } catch (error) {
      console.warn(`⚠️  [withExpoModuleGradlePlugin] Could not resolve expo-module-gradle-plugin: ${error.message}`);
    }

    // S'assurer que le plugin Expo est inclus dans pluginManagement
    // Vérifier si expo-modules-core/android est déjà inclus (inclusion manuelle)
    const hasManualInclusion = contents.includes('expo-modules-core/android') || contents.includes('expoModulesAndroidPath');
    if (!hasManualInclusion && !contents.includes('expo-module-gradle-plugin') && !contents.includes('expo-gradle-plugin')) {
      let pluginIncludeCode = '';
      
      if (pluginSourceDir) {
        // Convertir le chemin absolu en chemin relatif depuis rootDir
        // Le chemin sourceDir est déjà absolu, on doit le rendre relatif à rootDir/..
        const relativePath = path.relative(path.join(config.modRequest.projectRoot, 'android', '..'), pluginSourceDir).replace(/\\/g, '/');
        pluginIncludeCode = `    // ✅ CRITIQUE: Inclure expo-module-gradle-plugin AVANT que les modules ne soient évalués
    // Chemin résolu dynamiquement via expo-modules-autolinking pendant prebuild
    def expoGradlePluginPath = new File(rootDir, "../${relativePath}")
    if (expoGradlePluginPath.exists()) {
        includeBuild(expoGradlePluginPath.toString())
        println "✅ [withExpoModuleGradlePlugin] Included expo-module-gradle-plugin from: \${expoGradlePluginPath}"
    } else {
        println "⚠️  [withExpoModuleGradlePlugin] Plugin path does not exist: \${expoGradlePluginPath}"
    }`;
      } else {
        pluginIncludeCode = `    // ⚠️  Note: expo-module-gradle-plugin will be included via useExpoModules()
    // (Could not resolve plugin path during prebuild)`;
      }
      
      // Si pluginManagement n'existe pas, l'ajouter
      if (!contents.includes('pluginManagement')) {
        const pluginManagementBlock = `pluginManagement {
    includeBuild(new File(["node", "--print", "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().toString())
${pluginIncludeCode}
}

`;
        contents = pluginManagementBlock + contents;
      } else {
        // Si pluginManagement existe, ajouter l'inclusion du plugin
        // Trouver le bloc pluginManagement et ajouter l'inclusion AVANT la fermeture
        const regex = /(pluginManagement\s*\{[^}]*?)(\n\})/s;
        if (regex.test(contents)) {
          contents = contents.replace(regex, `$1${pluginIncludeCode}$2`);
        } else {
          // Fallback: ajouter avant la fermeture du bloc
          contents = contents.replace(
            /(pluginManagement\s*\{)/,
            `$1${pluginIncludeCode}`
          );
        }
      }

      settingsGradle.contents = contents;
    }

    return config;
  });
};

module.exports = withExpoModuleGradlePlugin;
