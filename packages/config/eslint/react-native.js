const baseConfig = require('./base.js');

module.exports = {
  ...baseConfig,
  extends: [
    ...baseConfig.extends,
    'plugin:react-native/all',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: [...baseConfig.plugins, 'react-native'],
  rules: {
    ...baseConfig.rules,
    'react/react-in-jsx-scope': 'off',
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'warn',
    'react-native/no-inline-styles': 'off',
    'react-native/no-color-literals': 'off',
    'react-native/no-raw-text': 'off',
  },
  settings: {
    ...baseConfig.settings,
    react: {
      version: '18.3',
    },
  },
};