const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ajouter le support pour les alias de chemins
config.resolver.alias = {
    '@': './src',
};

module.exports = config;

