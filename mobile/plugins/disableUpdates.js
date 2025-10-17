// Plugin pour désactiver complètement les mises à jour Expo
const { withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

const withDisableUpdates = (config) => {
  // Configuration Android
  config = withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults;
    
    // Ajouter la configuration pour désactiver les mises à jour
    const disableUpdatesConfig = `
// Configuration pour désactiver les mises à jour Expo
android {
    defaultConfig {
        // Désactiver les mises à jour automatiques
        manifestPlaceholders = [
            "expo_updates_enabled": "false",
            "expo_updates_check_automatically": "NEVER"
        ]
    }
    
    // Désactiver les mises à jour OTA
    buildTypes {
        debug {
            buildConfigField "boolean", "EXPO_UPDATES_ENABLED", "false"
        }
        release {
            buildConfigField "boolean", "EXPO_UPDATES_ENABLED", "false"
        }
    }
}`;

    // Insérer la configuration si elle n'existe pas déjà
    if (!buildGradle.contents.includes('expo_updates_enabled')) {
      buildGradle.contents = buildGradle.contents.replace(
        /android\s*{/,
        disableUpdatesConfig
      );
    }
    
    return config;
  });

  // Configuration du manifeste Android
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    
    // Ajouter les métadonnées pour désactiver les mises à jour
    if (manifest.application && manifest.application[0]) {
      const application = manifest.application[0];
      
      if (!application['meta-data']) {
        application['meta-data'] = [];
      }
      
      // Ajouter les métadonnées pour désactiver les mises à jour
      const metaData = [
        {
          $: {
            'android:name': 'expo.modules.updates.ENABLED',
            'android:value': 'false'
          }
        },
        {
          $: {
            'android:name': 'expo.modules.updates.CHECK_AUTOMATICALLY',
            'android:value': 'NEVER'
          }
        }
      ];
      
      // Vérifier si les métadonnées n'existent pas déjà
      const existingMetaData = application['meta-data'] || [];
      metaData.forEach(newMeta => {
        const exists = existingMetaData.some(existing => 
          existing.$ && existing.$['android:name'] === newMeta.$['android:name']
        );
        if (!exists) {
          existingMetaData.push(newMeta);
        }
      });
      
      application['meta-data'] = existingMetaData;
    }
    
    return config;
  });

  return config;
};

module.exports = withDisableUpdates;
