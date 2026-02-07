const fs = require('fs');
const path = require('path');

// ✅ Charger les variables d'environnement depuis .env si disponible
// Pour le build local, créer un fichier .env avec les variables EXPO_PUBLIC_*
try {
    // Essayer de charger dotenv si disponible (npm install dotenv)
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
    // dotenv n'est pas installé ou .env n'existe pas, utiliser les variables système
    console.log('ℹ️  Variables d\'environnement: Utilisation des variables système (ou définies dans eas.json pour EAS Build)');
}

// Vérifier si google-services.json existe
const googleServicesPath = path.join(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

// Récupérer les variables d'environnement (depuis .env, variables système, ou eas.json pour EAS)
const getEnvVar = (key, defaultValue = '') => {
    return process.env[key] || defaultValue;
};

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
            backgroundColor: "#1A237E"
        },
        assetBundlePatterns: [
            "assets/images/**/*",
            "assets/fonts/**/*",
            "assets/icons/**/*",
            "!assets/**/*.md",
            "!assets/**/*.txt",
            "!node_modules/**/*"
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
                backgroundColor: "#1A237E"
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
                        kotlinVersion: "1.9.25",
                        // ✅ OPTIMISATION TAILLE BUILD
                        enableProguardInReleaseBuilds: true,
                        enableShrinkResourcesInReleaseBuilds: true,
                        enableR8: true,
                        enableR8FullMode: true,
                        proguardMinifyEnabled: true,
                        packagingOptions: {
                            pickFirst: ['**/libc++_shared.so', '**/libfbjni.so']
                        }
                    }
                }
            ],
            // ✅ RETIRÉ: withExpoModuleGradlePlugin - redondant car settings.gradle gère déjà l'inclusion d'expo-modules-core/android
            // ✅ Ajout du plugin WebRTC personnalisé (remplace @config-plugins/react-native-webrtc qui requiert SDK 51)
            require('./plugins/withWebRTC'),
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
            },
            // ✅ Variables d'environnement chargées depuis .env ou variables système
            // Pour le build local, créer un fichier .env avec ces variables
            // Pour EAS Build, elles sont chargées depuis eas.json
            apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://api.yukpomnang.com'),
            wsUrl: getEnvVar('EXPO_PUBLIC_WS_URL', 'wss://api.yukpomnang.com'),
            shareUrl: getEnvVar('EXPO_PUBLIC_SHARE_URL', 'https://yukpomnang.com'),
            environment: getEnvVar('EXPO_PUBLIC_ENVIRONMENT', 'production'),
            googleMapsApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', 'AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ'),
            googleTranslateApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY', 'AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ')
        },
        autolinking: {
            exclude: [
                "expo-crypto"  // Exclure de l'autolinking Android mais garder pour Metro (polyfill crypto)
            ]
        },
        owner: "hernandezlele"
    }
};

