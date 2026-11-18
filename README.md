# Nebula

Productividad personal, inteligente y social: hábitos, tareas, metas, agenda, enfoque,
estadísticas y retos con amigos, con una identidad visual «Cosmic Minimalism».

**Plataformas:** Android y PC (Windows y Linux). Una sola base de código:
Expo / React Native para Android y su build web dentro de Electron para escritorio.

> Estado: núcleo implementado y ampliaciones locales de captura, asistente, diario,
> salas e integraciones. **El lanzamiento sigue pendiente de despliegue y validación real.**
> El progreso real está en
> [`docs/PLAN_DESARROLLO.md`](docs/PLAN_DESARROLLO.md).

## Requisitos

- Node.js 22+ y npm
- Un proyecto de [Supabase](https://supabase.com) (URL y clave `anon`)
- Android: un dispositivo o emulador y un *development build* (`npx expo run:android`) o EAS
- Escritorio: nada adicional (Electron se instala con las dependencias)

## Instalación

```bash
npm install
cp .env.example .env   # completa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Sin esas variables la app muestra una pantalla de «Configuración necesaria»: no finge
funcionar sin servidor. Para revisar solo la interfaz durante el desarrollo puedes definir
`EXPO_PUBLIC_DEV_PREVIEW_UI=1`; la app mostrará una etiqueta permanente de vista previa.

## Ejecución

| Objetivo | Comando |
|---|---|
| Servidor de desarrollo (Android / web) | `npm start` |
| Android | `npm run android` |
| Escritorio (compila el build web y abre Electron) | `npm run desktop` |
| AppImage de Linux | `npm run dist:linux` → `release/` |
| Instalar en este Linux (menú de aplicaciones, icono, `nebula://`) | `npm run install:linux` · quitar: `npm run uninstall:linux` |
| Instalador web de Windows (x64, se compila desde Linux con wine) | `npm run dist:win` → `release/nsis-web/` (el `.7z` va a la release `v<versión>`) |
| APK de Android independiente | `npm run apk` → `release/nebula.apk` |

## Generar el APK de Android

Requisitos: JDK 17+ y el Android SDK. El script usa `~/Android/jdk` y `~/Android/Sdk` salvo que
definas `JAVA_HOME` y `ANDROID_HOME`. Las variables `EXPO_PUBLIC_*` de `.env` se incrustan en el
APK, así que rellena `.env` antes.

```bash
npm install
npm run apk                          # prebuild + gradle assembleRelease → release/nebula.apk
adb install -r release/nebula.apk    # instalar en un móvil conectado por USB
```

Paso a paso (lo que hace `npm run apk`):

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
# resultado: android/app/build/outputs/apk/release/app-release.apk
```

Este APK lleva el código empaquetado (no necesita Metro ni el PC). Está firmado con la clave de
depuración: sirve para instalarlo directamente, no para Google Play. Para publicar, configura un
keystore propio en `android/app/build.gradle` o usa `eas build -p android`. Si ya tenías instalada
una versión firmada con otra clave, desinstálala antes (`adb uninstall app.nebula.productividad`).

## Calidad

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | TypeScript estricto |
| `npm run lint` | ESLint (configuración de Expo) |
| `npm test` | Pruebas de dominio y componentes (jest-expo) |
| `npm run test:db` | Migraciones SQL y RLS en Postgres real (PGlite, sin Docker) |
| `npm run check` | Todo lo anterior |
| `npm run e2e:build` y `npm run e2e` | E2E con Playwright: accesibilidad (axe), teclado, capturas, autenticación, resiliencia y flujos con cuentas (`E2E_EMAIL_*`) |
| `npm run e2e:shots` | Capturas a 390, 1280 y 1920 px en `docs/screenshots/` |
| `npm run desktop:shots` | Capturas desde Electron (alternativa) |

Detalle y evidencia en `docs/PRUEBAS.md`.

## Estructura

```
src/app/          Rutas (Expo Router)
src/components/   UI reutilizable
src/design/       Tokens, tema, fondo espacial
src/domain/       Lógica de negocio pura y probada
src/features/     Módulos (datos + vistas compuestas)
src/data/         Cliente Supabase, TanStack Query
src/platform/     Adaptadores Android / escritorio
src/lib/          Entorno, fechas, utilidades
desktop/          Proceso principal y preload de Electron
supabase/         Migraciones, Edge Functions y pruebas SQL
docs/             Plan, arquitectura, diseño, BD, reglas, IA, pruebas
```

## Documentación

- [Plan de desarrollo](docs/PLAN_DESARROLLO.md) — checklist vivo, fases, decisiones
- [Arquitectura](docs/ARQUITECTURA.md)
- [Asistente y configuración de Groq](docs/INTEGRACION_IA.md)
- [Base de datos y permisos](docs/BASE_DE_DATOS.md)
- [Preparación del lanzamiento](docs/LANZAMIENTO.md)
- [Privacidad (borrador)](docs/PRIVACIDAD.md)

## Seguridad

- El cliente solo contiene la URL y la clave `anon` de Supabase. La app rechaza arrancar si
  detecta una clave `service_role` en el cliente.
- Toda tabla tiene Row Level Security; la autorización se verifica en la base de datos.
- En escritorio, la sesión se cifra con el almacén del sistema (DPAPI / libsecret). Si no hay
  almacén disponible, la sesión se mantiene solo en memoria, nunca en texto plano.

## Funciones añadidas

- Captura rápida en español, con vista previa antes de guardar (`Ctrl+K` en escritorio).
- Configuración de perfil, privacidad, días activos, notificaciones, silencio y exportación.
- Caché por cuenta y cola duradera de registros y deshacer de hábitos sin conexión.
- Asistente de Groq en servidor: consentimiento, límite diario y confirmación por acción.
- Diario privado, revisión semanal y recomendaciones explicadas a partir de registros.
- Mapa de metas, importación manual ICS o calendario Android y salas con amigos.
- Bandeja y recuperación del tamaño de ventana en escritorio; accesos rápidos Android.

Para estas pantallas aplica primero las migraciones nuevas. Consulta `docs/LANZAMIENTO.md`
para despliegue, limitaciones comprobadas y validaciones todavía pendientes.
