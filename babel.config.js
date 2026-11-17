// Babel: preset de Expo + importación de iconos de lucide por archivo (ver scripts/babel/lucide-imports.js).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [require.resolve('./scripts/babel/lucide-imports.js')],
  };
};
