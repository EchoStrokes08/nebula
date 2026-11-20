// R8 se quedaba sin Metaspace (512 MB por defecto de la plantilla) al minificar el release con
// Firebase y el widget. Como `android/` se regenera en cada prebuild, el ajuste vive aquí.
const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS = '-Xmx3072m -XX:MaxMetaspaceSize=1024m';

module.exports = (config) =>
  withGradleProperties(config, (c) => {
    const props = c.modResults.filter((p) => !(p.type === 'property' && p.key === 'org.gradle.jvmargs'));
    props.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    c.modResults = props;
    return c;
  });
