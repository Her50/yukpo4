const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Résoudre le problème crypto avec axios dans Expo
config.resolver.alias = {
    crypto: 'react-native-crypto',
    stream: 'readable-stream',
    buffer: '@craftzdog/react-native-buffer',
    '@assets': './assets',
};

module.exports = config;