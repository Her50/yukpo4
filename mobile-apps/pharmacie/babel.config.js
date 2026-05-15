module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@shared': '../../mobile/src',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
