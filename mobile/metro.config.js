const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ CORRECTION: Configuration simplifiée sans dépendance problématique
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;