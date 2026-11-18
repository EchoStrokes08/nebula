// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['.desktop-app/**', 'dist/*', 'release/*', 'expo-env.d.ts', '.expo/*', '.e2e/**', '.pages-dist/**', 'test-results/**', 'playwright-report/**'],
  },
  {
    // Proceso principal de Electron y configuración: entorno Node.
    files: ['desktop/**/*.cjs', 'scripts/**/*.cjs', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
