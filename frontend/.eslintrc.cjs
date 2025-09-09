
module.exports = {
  extends: [
    'airbnb',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react', '@typescript-eslint'],
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  rules: {}
};
  