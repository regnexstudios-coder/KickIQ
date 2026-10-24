const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', 'supabase/functions/**', '.expo/*'],
  },
  {
    files: ['jest.setup.js', 'jest.config.js'],
    languageOptions: { globals: { jest: 'readonly', require: 'readonly', module: 'writable' } },
  },
  {
    rules: {
      'import/no-unresolved': 'off',
    },
  },
]);
