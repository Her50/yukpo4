const fs = require('fs');
const path = require('path');

// Vérifier si google-services.json existe
const googleServicesPath = path.join(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

module.exports = {
    expo: {
        name: "Yukpo",
        slug: "yukpomnang-mobile",
        version: "1.0.0",
        scheme: "yukpomnang",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "light",
        splash: {
            image: "./assets/splash.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        assetBundlePatterns: [
            "**/*"
        ],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.yukpomnang.mobile",
            associatedDomains: [
                "applinks:yukpomnang.com",
                "applinks:www.yukpomnang.com"
            ],
            infoPlist: {
                CFBundleURLTypes: [
                    {
                        CFBundleURLSchemes: [
                            "yukpomnang"
                        ]
                    }
                ],
                NSCameraUsageDescription: "Cette app utilise la caméra pour l'édition vidéo en réalité augmentée",
                NSMicrophoneUsageDescription: "Cette app utilise le microphone pour enregistrer l'audio des vidéos AR immersives",
                NSLocationWhenInUseUsageDescription: "Cette app utilise la localisation pour améliorer l'expérience AR"
            }
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#ffffff"
            },
            package: "com.yukpomnang.mobile",
            // Ajouter googleServicesFile seulement si le fichier existe
            ...(hasGoogleServices && { googleServicesFile: "./google-services.json" }),
            permissions: [
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.ACCESS_COARSE_LOCATION",
                "android.permission.CAMERA",
                "android.permission.RECORD_AUDIO",
                "android.permission.WRITE_EXTERNAL_STORAGE",
                "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.INTERNET"
            ],
            usesFeatures: [
                {
                    name: "android.hardware.camera.ar",
                    required: false
                }
            ],
            intentFilters: [
                {
                    action: "VIEW",
                    autoVerify: true,
                    data: [
                        {
                            scheme: "https",
                            host: "yukpomnang.com",
                            pathPrefix: "/product"
                        },
                        {
                            scheme: "https",
                            host: "yukpomnang.com",
                            pathPrefix: "/service"
                        },
                        {
                            scheme: "yukpomnang"
                        }
                    ],
                    category: [
                        "BROWSABLE",
                        "DEFAULT"
                    ]
                }
            ],
            config: {
                encoding: "UTF-8",
                googleMaps: {
                    apiKey: "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
                }
            },
            "meta-data": [
                {
                    name: "com.google.ar.core",
                    value: "required"
                }
            ]
        },
        web: {
            favicon: "./assets/favicon.png"
        },
        plugins: [
            [
                "expo-build-properties",
                {
                    android: {
                        compileSdkVersion: 35,
                        targetSdkVersion: 35,
                        buildToolsVersion: "35.0.0",
                        minSdkVersion: 24,
                        kotlinVersion: "2.0.0"
                    }
                }
            ],
            "./plugins/withExpoModuleGradlePlugin",
            "expo-asset",
            "expo-localization",
            "expo-location",
            "expo-camera",
            "expo-barcode-scanner",
            "expo-image-picker",
            "expo-document-picker",
            "expo-file-system",
            "expo-notifications",
            [
                "sentry-expo",
                {
                    organization: "yukpo",
                    project: "mobile-app"
                }
            ]
        ],
        extra: {
            eas: {
                projectId: "944bbf0d-5541-4e56-ba75-87ffc4c5e51f"
            },
            sentryDsn: "",
            observability: {
                fpsSampleInterval: 6000,
                fpsWarningThreshold: 45,
                fpsWarningDebounce: 2,
                traceSampleRate: 0.2
            }
        },
        owner: "hernandezlele"
    }
};

