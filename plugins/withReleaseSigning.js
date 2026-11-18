// Firma el APK de release con la clave propia de Nebula en vez de la clave de depuración pública
// (con esa clave Play Protect desconfía de la app y cualquiera podría firmar un «update» falso).
// La clave vive fuera del repo; Gradle la lee de ~/.gradle/gradle.properties:
//   NEBULA_UPLOAD_STORE_FILE, NEBULA_UPLOAD_KEY_ALIAS, NEBULA_UPLOAD_STORE_PASSWORD, NEBULA_UPLOAD_KEY_PASSWORD
// Sin esas propiedades, el build de release falla (nunca se publica un APK con la clave de depuración).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// nebula-release-signing';

const RELEASE_CONFIG = `
        release { ${MARK}
            if (project.hasProperty('NEBULA_UPLOAD_STORE_FILE')) {
                storeFile file(NEBULA_UPLOAD_STORE_FILE)
                storePassword NEBULA_UPLOAD_STORE_PASSWORD
                keyAlias NEBULA_UPLOAD_KEY_ALIAS
                keyPassword NEBULA_UPLOAD_KEY_PASSWORD
            }
        }`;

const GUARD = `
gradle.taskGraph.whenReady { graph -> ${MARK}
    if (graph.allTasks.any { it.name.toLowerCase().contains('release') } && !project.hasProperty('NEBULA_UPLOAD_STORE_FILE')) {
        throw new GradleException('Falta la clave de firma de Nebula (NEBULA_UPLOAD_STORE_FILE en ~/.gradle/gradle.properties).')
    }
}
`;

function applySigning(gradle) {
  if (gradle.includes(MARK)) return gradle;
  const withConfig = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_CONFIG}`);
  // Solo el bloque buildTypes.release: debug sigue con la clave de depuración.
  const withRelease = withConfig.replace(
    /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release',
  );
  if (withRelease === withConfig || withConfig === gradle) {
    throw new Error('withReleaseSigning: build.gradle no tiene la forma esperada; revisa el plugin.');
  }
  return withRelease + GUARD;
}

module.exports = (config) =>
  withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = applySigning(mod.modResults.contents);
    return mod;
  });
module.exports.applySigning = applySigning;
