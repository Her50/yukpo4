// Plugin de configuration WebRTC compatible Expo 53
const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

/**
 * Plugin pour configurer react-native-webrtc avec Expo 53
 */
const withWebRTC = (config) => {
  // Configuration Android
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    // Ajouter usesCleartextTraffic pour WebRTC
    if (!mainApplication.$) {
      mainApplication.$ = {};
    }
    mainApplication.$['android:usesCleartextTraffic'] = 'true';

    return config;
  });

  // Configuration iOS
  config = withInfoPlist(config, (config) => {
    config.modResults.NSCameraUsageDescription = 
      config.modResults.NSCameraUsageDescription || 
      "Yukpomnang a besoin d'accéder à votre caméra pour les appels vidéo.";
    
    config.modResults.NSMicrophoneUsageDescription = 
      config.modResults.NSMicrophoneUsageDescription || 
      "Yukpomnang a besoin d'accéder à votre microphone pour les appels audio et vidéo.";

    return config;
  });

  return config;
};

module.exports = withWebRTC;

