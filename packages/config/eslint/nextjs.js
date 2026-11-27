const baseConfig = require('./base.js');

module.exports = {
  ...baseConfig,
  extends: [
    ...baseConfig.extends,
    'plugin:@next/next/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: [...baseConfig.plugins, '@next/next', 'jsx-a11y'],
  rules: {
    ...baseConfig.rules,
    'react/react-in-jsx-scope': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',
  },
};