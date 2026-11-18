# Publicar Nebula en Google Play

Preparación revisada el 17 de noviembre de 2026. Esta guía no acredita que se haya
generado un AAB firmado, desplegado el backend o publicado la aplicación.

## Estado del proyecto

- Identificador Android: `app.nebula.productividad` en `app.json`.
- Versión visible: `1.0.0`.
- `eas.json` ya incluye `production` con `buildType: app-bundle`, incremento
  automático de versión interna y entorno `production`.
- Falta vincular el proyecto a la cuenta Expo que lo administrará: `app.json`
  todavía no contiene `extra.eas.projectId`.
- `npm run apk` genera por defecto un APK con firma de depuración. Para la tienda,
  generar el AAB de producción con credenciales de distribución.
- `docs/PRIVACIDAD.md` sigue siendo un borrador con datos del responsable pendientes.
- Existe borrado de cuenta en Configuración mediante la función `account-delete`;
  debe probarse en el backend real. Falta acreditar una URL pública que permita
  solicitar el borrado sin tener que instalar la aplicación.

## Cuenta y ficha

Crear o usar una cuenta en [Play Console](https://play.google.com/console/). El
registro cuesta 25 USD una sola vez y requiere verificar la identidad. Las cuentas
personales nuevas tienen requisitos adicionales; las creadas después del
13 de noviembre de 2023 necesitan una prueba cerrada con al menos 12 participantes
inscritos continuamente durante 14 días antes de solicitar acceso a producción.
La prueba interna no sustituye esa prueba cerrada.

Crear la aplicación con nombre Nebula, idioma español y categoría Productividad.
Decidir con el propietario si será gratuita o de pago y los países de distribución.
Preparar:

- Correo público de soporte y datos del responsable.
- URL pública de la política de privacidad completa y URL de solicitud de borrado.
- Icono de tienda, imagen destacada y capturas actuales en Android sin datos personales.
- Formularios de seguridad de datos, anuncios, público objetivo y clasificación.
- Instrucciones y una cuenta de revisión para acceder a las funciones con sesión.

Descripción breve propuesta:

> Organiza tareas, hábitos y metas, planifica tu agenda y comparte retos.

Descripción ampliada propuesta:

> Nebula reúne tus tareas, hábitos, metas y agenda en un solo lugar. Organiza tu
> día, dedica tiempo a concentrarte y consulta tu progreso. Comparte retos con
> amigos y utiliza el asistente opcional para ayudarte a planificar.

Revisar estas descripciones contra la versión final que se vaya a distribuir.

## Preparar y generar el AAB

Desde la raíz del proyecto:

```sh
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

Vincular al proyecto correcto, conservando `app.nebula.productividad`. Configurar
en el entorno `production` del panel de Expo `EXPO_PUBLIC_SUPABASE_URL` y
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. No definir `EXPO_PUBLIC_DEV_PREVIEW_UI`; las claves
privadas de Supabase y del proveedor de IA pertenecen al servidor.

```sh
npm run check
npx eas-cli@latest build --platform android --profile production
```

Si es la primera distribución, configurar la clave de carga de Android en Expo y
conservar una copia segura. Si la app ya existe en Play, usar sus credenciales de
carga vigentes. Descargar el `.aab` desde la compilación completada.

Comprobar en el artefacto y en Play Console el nivel API objetivo vigente,
los permisos y la compatibilidad de bibliotecas nativas. Probar la versión instalada
desde Google Play: registro, entrada y OAuth, recuperación de contraseña,
sincronización, calendario, dictado, notificaciones, exportación y borrado de cuenta.
Verificar también las funciones sociales con dos cuentas y los controles para
reportar o bloquear usuarios/contenido que correspondan a la interacción disponible.

## Subir y solicitar publicación

Crear una versión en **Pruebas internas** y cargar manualmente el AAB firmado.
Activar/configurar Play App Signing siguiendo el asistente de la consola.
Resolver los errores de procesamiento y revisar el informe previo al lanzamiento.
Después completar la prueba cerrada cuando corresponda, solicitar acceso a
producción y preparar el lanzamiento para revisión de Google.

Para automatizar envíos posteriores con Expo Submit, configurar una cuenta de
servicio de Google con acceso a la aplicación. Su JSON es un secreto y no debe
guardarse en el repositorio. Subir a un canal de pruebas y publicar en producción
son pasos distintos.

## Referencias oficiales

- [Registro en Play Console y cuota](https://support.google.com/googleplay/android-developer/answer/6112435?hl=es).
- [Pruebas para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465?hl=es).
- [Requisitos de borrado de cuenta](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es).
- [Crear una compilación con Expo](https://docs.expo.dev/build/setup/).
- [Enviar a Google Play con Expo](https://docs.expo.dev/submit/android/).
- [Nivel API objetivo de Google Play](https://support.google.com/googleplay/android-developer/answer/11926878?hl=es).
