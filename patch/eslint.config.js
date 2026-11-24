// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Apostrophes in on-screen text are fine in React Native.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
