const fs = require('fs');
const path = require('path');

try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}

const getEnvVar = (k, d = '') => process.env[k] || d;

module.exports = {
  expo: {
    name: "Yukpo Pharmacie",
    slug: "yukpo-pharmacie",
    version: "1.0.0",
    scheme: "yukpopharmacie",
    orientation: "portrait",
    icon: "../../mobile/assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "../../mobile/assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#059669"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yukpomnang.pharmacie",
      infoPlist: {
        NSCameraUsageDescription: "Scanner les ordonnances et codes-barres médicaments",
        NSPhotoLibraryUsageDescription: "Importer une ordonnance depuis vos photos",
        NSLocationWhenInUseUsageDescription: "Trouver les pharmacies à proximité"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "../../mobile/assets/adaptive-icon.png",
        backgroundColor: "#059669"
      },
      package: "com.yukpomnang.pharmacie",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.INTERNET"
      ]
    },
    plugins: [
      "expo-asset",
      "expo-camera",
      "expo-location",
      "expo-barcode-scanner",
      "expo-image-picker",
      "expo-document-picker"
    ],
    extra: {
      eas: { projectId: "TO-CREATE-VIA-EAS-INIT" },
      apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://yukpo-backend-376093909298.europe-west1.run.app'),
      appFlavor: 'pharmacie'
    },
    owner: "hernandezlele"
  }
};
