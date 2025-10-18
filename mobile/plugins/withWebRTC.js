const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

/**
 * Config plugin personnalisé pour react-native-webrtc
 * Ajoute les permissions nécessaires pour Android et iOS
 */
const withWebRTC = (config, props = {}) => {
    const cameraPermission = props.cameraPermission || "Cette app a besoin d'accéder à votre caméra pour les appels vidéo.";
    const microphonePermission = props.microphonePermission || "Cette app a besoin d'accéder à votre microphone pour les appels audio et vidéo.";

    // Configuration Android
    config = withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults.manifest;

        // Ajouter les permissions Android pour WebRTC
        if (!androidManifest['uses-permission']) {
            androidManifest['uses-permission'] = [];
        }

        const permissions = [
            'android.permission.CAMERA',
            'android.permission.RECORD_AUDIO',
            'android.permission.MODIFY_AUDIO_SETTINGS',
            'android.permission.INTERNET',
            'android.permission.ACCESS_NETWORK_STATE',
            'android.permission.BLUETOOTH',
            'android.permission.BLUETOOTH_CONNECT',
            'android.permission.BLUETOOTH_ADMIN',
        ];

        permissions.forEach(permission => {
            if (!androidManifest['uses-permission'].find(p => p.$?.['android:name'] === permission)) {
                androidManifest['uses-permission'].push({
                    $: { 'android:name': permission }
                });
            }
        });

        // Ajouter les features nécessaires
        if (!androidManifest['uses-feature']) {
            androidManifest['uses-feature'] = [];
        }

        const features = [
            { name: 'android.hardware.camera', required: false },
            { name: 'android.hardware.camera.autofocus', required: false },
            { name: 'android.hardware.microphone', required: false },
        ];

        features.forEach(feature => {
            if (!androidManifest['uses-feature'].find(f => f.$?.['android:name'] === feature.name)) {
                androidManifest['uses-feature'].push({
                    $: {
                        'android:name': feature.name,
                        'android:required': feature.required.toString()
                    }
                });
            }
        });

        return config;
    });

    // Configuration iOS
    config = withInfoPlist(config, (config) => {
        config.modResults.NSCameraUsageDescription = cameraPermission;
        config.modResults.NSMicrophoneUsageDescription = microphonePermission;

        return config;
    });

    return config;
};

module.exports = withWebRTC;



