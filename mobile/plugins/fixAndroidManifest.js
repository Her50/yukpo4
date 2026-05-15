const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withFixAndroidManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (manifest.application && manifest.application.length > 0) {
      const application = manifest.application[0];
      
      // Accéder aux attributs de l'élément application
      if (application.$) {
        const attrs = application.$;
        
        // S'assurer que android:appComponentFactory est défini avec la valeur AndroidX
        // et que tools:replace est présent pour résoudre les conflits
        if (!attrs['android:appComponentFactory']) {
          attrs['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
        }
        
        // S'assurer que tools:replace contient android:appComponentFactory si nécessaire
        if (attrs['android:appComponentFactory']) {
          if (!attrs['tools:replace']) {
            attrs['tools:replace'] = 'android:appComponentFactory';
          } else if (!attrs['tools:replace'].includes('android:appComponentFactory')) {
            attrs['tools:replace'] = attrs['tools:replace'] + ',android:appComponentFactory';
          }
        }
      }
    }

    return config;
  });
};

