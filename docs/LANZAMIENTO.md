# Preparación del lanzamiento

Para Android, seguir la [guía de publicación en Google Play](GOOGLE_PLAY.md),
con los pendientes de cuenta, firma, privacidad y pruebas de la tienda.

## Compilar

`npm ci`, `npm run check` y `npm run build:web` validan y exportan el código. La app necesita
las variables públicas de Supabase. `EXPO_PUBLIC_DEV_PREVIEW_UI` debe estar desactivada.
Las claves de Groq y service role nunca van al cliente.

- Linux: `npm run dist:linux` y `npm run dist:linux:deb`.
- Windows: ejecutar manualmente el workflow `Instaladores`; las variables de repositorio
  `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` son obligatorias. El instalador
  requiere validación en Windows y certificado si se quiere distribuir firmado.
- Android: configurar el proyecto Expo y las variables del entorno de EAS; usar el perfil
  `preview` para APK o `production` para AAB. No distribuir una firma de depuración.

Los workflows generan artefactos; no publican automáticamente en tiendas ni GitHub Releases.

## Backend

1. Verificar destino y acceso de despliegue a Supabase.
2. Ejecutar `npm run deploy:backend` con `NEBULA_SUPABASE_PROJECT_REF` definido.
3. Configurar las URL de retorno de Auth: `nebula://auth/callback` y
   `http://127.0.0.1:47913/auth/callback` para OAuth de escritorio.
4. Probar autenticación, correo, avatar, exportación y borrado con una cuenta desechable.
5. Activar IA desde Configuración y verificar propuestas con Groq sin ejecutar acciones no deseadas.
6. Validar Realtime con dos cuentas y permisos de presencia privados.
7. Google Calendar: en el proyecto de Google Cloud del cliente OAuth que usa Supabase, activar
   la Google Calendar API y añadir el permiso `calendar.readonly` a la pantalla de consentimiento
   (en modo «Prueba», las cuentas deben estar entre los usuarios de prueba).

Las migraciones locales nuevas deben aplicarse antes de instalar el cliente nuevo. Se añadió
`profiles.timezone_confirmed` y pantallas que consultan diario, integraciones y salas.

## Validación que requiere equipos o servicios externos

- Flujos con dos cuentas reales y entrega de correos.
- Permisos y dictado en Android; restricciones de batería del fabricante.
- Capturas de pantallas con sesión real y revisión a 390/1280 px.
- Instalación, firma, actualización y desinstalación en Windows.
- Firma de Android y revisión del APK/AAB de producción.
- Push social: requiere configurar Expo/FCM; las notificaciones locales son independientes.
- Widgets nativos y actualizaciones automáticas: siguen pendientes de implementación y validación.

No confundir exportar JavaScript nativo con compilar un APK, ni empaquetar con publicar.

## Metadatos propuestos

Nombre: Nebula. Categoría: Productividad. Idioma inicial: español.
Descripción: Organiza tus hábitos, tareas, metas y agenda. Concéntrate, revisa tu progreso y
comparte retos con amigos. La planificación funciona sin IA; el asistente es opcional.

Antes de publicar, completar responsable y contacto de privacidad, capturas de tienda,
iconos finales, clasificación de contenido, requisitos de datos y política de backups.
