const fs = require('fs');
const path = require('path');

// Permite publicar la versión web bajo un subdirectorio (GitHub Pages: /nebula) sin afectar
// a Android ni al escritorio: EXPO_BASE_URL=/nebula npx expo export --platform web
// Push (FCM): solo si existe google-services.json (fuera de Git); sin él la app compila sin push.
const googleServices = path.join(__dirname, 'google-services.json');

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, ...(fs.existsSync(googleServices) ? { googleServicesFile: './google-services.json' } : {}) },
  experiments: { ...config.experiments, ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
});
