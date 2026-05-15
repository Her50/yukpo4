const fs = require('fs');
const path = require('path');

try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}

const getEnvVar = (k, d = '') => process.env[k] || d;

module.exports = {
  expo: {
    name: "Yukpo Restaurant",
    slug: "yukpo-restaurant",
    version: "1.0.0",
    scheme: "yukporestaurant",
    orientation: "portrait",
    icon: "../../mobile/assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "../../mobile/assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#dc2626"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yukpomnang.restaurant",
      infoPlist: {
        NSCameraUsageDescription: "Photos de plats et scan QR de table",
        NSPhotoLibraryUsageDescription: "Importer des photos de plats",
        NSLocationWhenInUseUsageDescription: "Trouver les restaurants à proximité"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "../../mobile/assets/adaptive-icon.png",
        backgroundColor: "#dc2626"
      },
      package: "com.yukpomnang.restaurant",
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
      "expo-image-picker"
    ],
    extra: {
      eas: { projectId: "TO-CREATE-VIA-EAS-INIT" },
      apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://yukpo-backend-376093909298.europe-west1.run.app'),
      appFlavor: 'restaurant'
    },
    owner: "hernandezlele"
  }
};
