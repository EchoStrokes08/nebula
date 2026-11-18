# Firma del APK de Android

Desde la 1.2.4 el APK de release se firma con la clave propia de Nebula, no con la clave de
depuración pública de Android (con esa clave Play Protect desconfía de la app y cualquiera podría
firmar una «actualización» falsa).

- Keystore: `~/.local/share/nebula-firma/nebula-release.jks` (fuera del repo, alias `nebula`).
- Contraseñas y ruta: `~/.gradle/gradle.properties` (`NEBULA_UPLOAD_*`).
- `plugins/withReleaseSigning.js` lo aplica en cada `expo prebuild`; un build de release sin esas
  propiedades falla a propósito.
- Huella SHA-256 del certificado:
  `24:AF:A6:EB:AE:E6:5E:9E:51:95:3C:C9:15:6B:B3:43:59:20:25:44:93:22:D2:9C:16:B1:29:3B:C6:57:30:74`

**Haz copia de seguridad del `.jks` y de la contraseña** (gestor de contraseñas o disco externo).
Si se pierde, ninguna versión futura podrá instalarse encima de la actual: habría que desinstalar
otra vez en todos los móviles.

## Cambio de clave (1.2.3 → 1.2.4)

Android no deja actualizar una app con otra firma: quien tenga la 1.2.3 o anterior debe
desinstalar Nebula una vez e instalar la 1.2.4 desde la web. Los datos sincronizados se recuperan
al iniciar sesión; lo que no se hubiera sincronizado se pierde.

Ojo con los Xiaomi: si Nebula sigue en el «segundo espacio» o «security space» (otro usuario de
Android), el instalador sigue diciendo «conflicto con un paquete ya presente». `adb uninstall
app.nebula.productividad` la quita de todos los usuarios.

## Que Play Protect conozca la app

El aviso «App desconocida / Analizar la app» solo desaparece del todo si Google conoce el paquete
`app.nebula.productividad` con esta clave:

1. Cuenta de desarrollador en Play Console (pago único de 25 USD) → crear la app con ese paquete.
2. Subir un AAB (`cd android && ./gradlew bundleRelease`) a una pista de **prueba interna**. Con
   Play App Signing, elegir «usar mi clave» (la misma de arriba) para que el APK de la web siga
   pudiendo actualizarse encima del de Play.
3. Registrar el paquete y la huella en la verificación de desarrolladores de Android (Android
   Developer Console) cuando la pida Google para apps distribuidas fuera de Play.
