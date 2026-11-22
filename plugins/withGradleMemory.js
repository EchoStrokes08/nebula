// Ajustes de Gradle para compilar el APK más rápido y sin quedarse sin memoria. Como `android/` se
// regenera en cada prebuild, viven aquí.
// - R8 se quedaba sin Metaspace (512 MB por defecto de la plantilla) al minificar el release con
//   Firebase y el widget.
// - La caché de compilación reutiliza tareas ya hechas aunque `android/` se regenere desde cero.
// - Las imágenes ya están optimizadas: recomprimir PNG en cada release solo añade tiempo.
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  'org.gradle.jvmargs': '-Xmx3072m -XX:MaxMetaspaceSize=1024m',
  'org.gradle.caching': 'true',
  'org.gradle.parallel': 'true',
  'android.enablePngCrunchInReleaseBuilds': 'false',
};

module.exports = (config) =>
  withGradleProperties(config, (c) => {
    const props = c.modResults.filter((p) => !(p.type === 'property' && p.key in PROPS));
    for (const [key, value] of Object.entries(PROPS)) props.push({ type: 'property', key, value });
    c.modResults = props;
    return c;
  });
