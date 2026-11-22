// Empaquetado JavaScript del APK más rápido:
// - Se usa scripts/expo-embed.cjs en vez de llamar a @expo/cli directamente: así se reutiliza la caché
//   de Metro entre compilaciones (el plugin de React Native fuerza --reset-cache).
// - Hermes compila sin mapa de código fuente (-output-source-map): no hay servicio de errores que lo use
//   y generarlo y combinarlo costaba ~10 s por APK. El bytecode sigue optimizado (-O).
// `android/` se regenera en cada prebuild, por eso el cambio vive aquí.
const { withAppBuildGradle } = require('expo/config-plugins');

const CLI_LINE = /^(\s*)cliFile = new File\(.*@expo\/cli.*$/m;

function useEmbedWrapper(gradle) {
  if (gradle.includes('scripts/expo-embed.cjs')) return gradle;
  if (!CLI_LINE.test(gradle)) throw new Error('withFastBundle: no se encontró la línea cliFile en android/app/build.gradle');
  return gradle.replace(CLI_LINE, '$1cliFile = new File(projectRoot, "scripts/expo-embed.cjs")\n$1hermesFlags = ["-O"]');
}

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    c.modResults.contents = useEmbedWrapper(c.modResults.contents);
    return c;
  });
module.exports.useEmbedWrapper = useEmbedWrapper;
