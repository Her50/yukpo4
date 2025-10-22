module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 'react-native-reanimated/plugin', // Désactivé temporairement pour le build
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
