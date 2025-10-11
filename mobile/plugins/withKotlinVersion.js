const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Plugin pour NE PAS forcer de version Kotlin - laisser Expo choisir
 * La version sera déterminée automatiquement par React Native
 */
const withKotlinVersion = (config) => {
    // Ne rien faire - laisser Expo et React Native gérer la version Kotlin automatiquement
    return config;
};

module.exports = withKotlinVersion;

