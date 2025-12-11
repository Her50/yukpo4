module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@contexts': './src/contexts',
            '@utils': './src/utils',
            '@theme': './src/theme',
          },
        },
      ],
      // ✅ CRITIQUE: react-native-reanimated/plugin DOIT être en dernier dans la liste
      // C'est une exigence de react-native-reanimated pour fonctionner correctement
      // ⚠️ NOTE: Les composants utilisant Animated native avec useNativeDriver: true
      // doivent être migrés vers Reanimated ou utiliser useNativeDriver: false
      'react-native-reanimated/plugin',
    ],
    // ✅ CORRECTION: Configuration UTF-8 sans plugin externe
    // env: {
    //   production: {
    //     plugins: [
    //       ['transform-remove-console', { exclude: ['error', 'warn'] }],
    //     ],
    //   },
    // },
  };
};
