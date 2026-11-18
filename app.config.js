// Permite publicar la versión web bajo un subdirectorio (GitHub Pages: /nebula) sin afectar
// a Android ni al escritorio: EXPO_BASE_URL=/nebula npx expo export --platform web
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
});
