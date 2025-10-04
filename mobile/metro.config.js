const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuration pour les packages natifs
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configuration pour les assets
config.resolver.assetExts.push(
  'lottie',
  'ttf',
  'otf',
  'woff',
  'woff2'
);

module.exports = config;