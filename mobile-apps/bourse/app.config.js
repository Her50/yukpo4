const fs = require('fs');
const path = require('path');

try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}

const getEnvVar = (k, d = '') => process.env[k] || d;

module.exports = {
  expo: {
    name: "Bourse du Livre",
    slug: "yukpo-bourse-livre",
    version: "1.0.0",
    scheme: "yukpobourse",
    orientation: "portrait",
    icon: "../../mobile/assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "../../mobile/assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#d97706"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yukpomnang.bourse",
      infoPlist: {
        NSCameraUsageDescription: "Scanner les programmes scolaires et pages de livres",
        NSPhotoLibraryUsageDescription: "Importer des photos de programmes scolaires"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "../../mobile/assets/adaptive-icon.png",
        backgroundColor: "#d97706"
      },
      package: "com.yukpomnang.bourse",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.INTERNET"
      ]
    },
    plugins: [
      "expo-asset",
      "expo-camera",
      "expo-image-picker",
      "expo-document-picker",
      "expo-file-system"
    ],
    extra: {
      eas: { projectId: "TO-CREATE-VIA-EAS-INIT" },
      apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://yukpo-backend-376093909298.europe-west1.run.app'),
      appFlavor: 'bourse'
    },
    owner: "hernandezlele"
  }
};
