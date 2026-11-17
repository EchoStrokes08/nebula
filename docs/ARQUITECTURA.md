# Nebula — Arquitectura

Documento vivo. Las decisiones de producto están en `PLAN_DESARROLLO.md` §16; aquí se recogen
las técnicas (ADR).

## 1. Vista general

```
┌──────────────────────────── App (Expo / React Native / web) ────────────────────────────┐
│ src/app/            Rutas Expo Router: pantallas finas, sin lógica de negocio           │
│ src/features/<m>/   Hooks de datos (TanStack Query), formularios, vistas compuestas     │
│ src/components/     UI reutilizable, sin acceso a datos                                 │
│ src/design/         Tokens, tipografía, tema, fondos espaciales, movimiento             │
│ src/domain/         Lógica pura y probada (hábitos, planificación, retos, mensajes…)    │
│ src/data/           Cliente Supabase, repositorios, tipos de BD, cola offline           │
│ src/lib/            Fechas/zonas, entorno, errores, utilidades                          │
└───────────────┬─────────────────────────────────────────────────────────────────────────┘
                │ HTTPS (anon key + JWT de usuario)          ▲ Realtime (websocket)
┌───────────────▼─────────────────────── Supabase ──────────┴─────────────────────────────┐
│ Auth (email, OAuth opcional)                                                            │
│ Postgres: tablas con RLS, funciones SQL `security definer` (puntuación, transiciones)   │
│ Edge Functions (Deno): ai-assist, challenge-close, push-dispatch, account-delete        │
│ Storage: avatars (RLS por carpeta de usuario)                                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Flujo de una acción: pantalla → hook de feature (`useMutation`) → repositorio (`src/data`) →
Supabase. La UI se actualiza de forma optimista cuando la acción es reversible (registrar un
hábito) e invalida las consultas afectadas al confirmar.

## 1.1. Plataformas

| | Android | Escritorio (Windows / Linux) |
|---|---|---|
| Runtime | React Native (Hermes, nueva arquitectura) | Export web de Expo en Electron (Chromium) |
| Navegación principal | Barra inferior | Barra lateral (≥ 900 px); barra inferior si la ventana es estrecha |
| Sesión | `expo-secure-store` | `safeStorage` de Electron (DPAPI en Windows, libsecret/kwallet en Linux) vía preload |
| Notificaciones | `expo-notifications` (canales) | `Notification` del proceso principal; bandeja para seguir activo |
| Segundo plano | Marcas de tiempo + notificación programada | Proceso principal activo en la bandeja |
| Háptica | `expo-haptics` | No aplica (no-op) |
| Voz | Reconocimiento del SO | Transcripción en servidor (si se configura) |
| OAuth (Google) | Custom Tabs (`expo-web-browser`) → `nebula://auth/callback` | Navegador del sistema → `http://127.0.0.1:47913/auth/callback` (loopback, RFC 8252) |
| Entrada | Táctil | Teclado, ratón, atajos, menú contextual |
| Distribución | APK/AAB | AppImage, .deb, instalador NSIS |

Seguridad de Electron: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
preload que expone solo `window.nebulaDesktop` (almacenamiento seguro, notificaciones,
bandeja), CSP estricta, apertura de enlaces externos en el navegador del sistema y bloqueo de
navegación fuera de la app.

## 2. Módulos

| Módulo | Dominio (`src/domain`) | Datos (`src/data`, SQL) | UI (`src/features`, `src/app`) |
|---|---|---|---|
| Cuenta | — | `profiles`, `user_preferences`, Auth | `(auth)`, `(onboarding)`, perfil, ajustes |
| Hábitos | evaluación de periodos, constancia, recuperación, adaptación | `habits`, `habit_targets`, `habit_logs` | pestaña Hábitos, detalle, editor |
| Tareas/metas | dependencias (DAG), simulador | `tasks`, `subtasks`, `goals`, `milestones`, `dependencies` | listas, detalle, proyecto |
| Agenda | conflictos, huecos, planificador, Día viable, temporizador | `calendar_events`, `availability`, `focus_sessions` | pestaña Agenda, enfoque |
| Estadísticas | agregaciones puras sobre registros | vistas/funciones SQL de agregados | Perfil → estadísticas |
| Social | — (puntuación autoritativa en SQL) | `friendships`, `circles`, `challenges`… | pestaña Retos |
| Motivación | biblioteca + motor contextual | `notifications`, preferencias | Hoy, enfoque, notificaciones |
| IA | parser determinista, validación de acciones | Edge Function `ai-assist` | asistente, captura |

## 3. Estado

- **Servidor:** TanStack Query. Claves jerárquicas por módulo (`['habits', userId, ...]`).
  La caché se persiste (AsyncStorage) para lectura sin conexión.
- **Local:** Zustand para estado de cliente que no pertenece al servidor (temporizador activo,
  borradores, preferencias de UI). El temporizador persiste sus marcas de tiempo.
- **Sesión:** Supabase Auth; almacenamiento en SecureStore (nativo) o localStorage (web).

## 4. Fechas y zonas horarias

- Los instantes se guardan en `timestamptz` (UTC).
- Cada registro de hábito guarda también `day_key` (`date` local del usuario en el momento del
  registro) y `tz`. Las rachas y periodos se calculan sobre `day_key`, por lo que un viaje no
  reescribe el pasado.
- Los retos definen su propia zona (`challenges.tz`); sus límites diarios se evalúan en esa zona.
- Utilidades en `src/lib/dates.ts` (con `@date-fns/tz`).

## 5. Seguridad

- RLS activado en todas las tablas; políticas por propietario y, en tablas sociales, por
  pertenencia (participante/miembro) mediante funciones `security definer` con
  `set search_path = ''`.
- El cliente solo tiene `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (públicas
  por diseño). La `service_role` y las claves de IA solo existen como secretos de Edge Functions.
- Escrituras sensibles (resultado de retos, transición de estado, borrado de cuenta) solo vía
  funciones del servidor; las tablas correspondientes no tienen políticas de `update` para
  `authenticated`.

## 6. Pruebas

Ver `PRUEBAS.md`. Dos proyectos Jest: `app` (jest-expo, dominio y componentes) y `db`
(Node + PGlite ejecutando `supabase/migrations/*.sql` sobre un esquema `auth` simulado).

## 7. Versiones instaladas (2026-11-16)

| Paquete | Versión |
|---|---|
| expo | ~58.0.25 |
| react-native | 0.88.1 |
| react | 19.3.0 |
| expo-router | ~58.0.31 |
| react-native-reanimated | 4.7.1 (+ react-native-worklets 0.13.0) |
| react-native-svg | 15.16.0 |
| @supabase/supabase-js | ^2.119.0 |
| @tanstack/react-query | ^5.107.1 |
| zustand | ^5.1.0 |
| zod | ^4.6.7 |
| date-fns / @date-fns/tz | ^4.4.0 / ^1.5.0 |
| lucide-react-native | ^1.73.0 |
| jest-expo / @testing-library/react-native | ~58.0.14 / ^14.1.0 |
| @electric-sql/pglite | ^0.5.16 (solo pruebas) |
| typescript | ~6.0.3 |

## 8. Registro de decisiones (ADR)

| ADR | Decisión | Alternativas | Motivo |
|---|---|---|---|
| ADR-001 | Expo SDK 58 + Expo Router con rutas en `src/app/` | RN CLI; React Navigation manual | Recomendación del prompt; CNG y EAS; convención actual de Expo |
| ADR-002 | Supabase (Postgres + RLS) como backend | Firebase; backend propio | Requerido; SQL permite reglas de puntuación transaccionales |
| ADR-003 | Lógica de dominio pura en `src/domain` | Lógica en componentes | Testeable, reutilizable en Edge Functions (Deno importa TS) |
| ADR-004 | Puntuación de retos en SQL `security definer` | Cálculo en cliente | Integridad: el cliente no decide resultados |
| ADR-005 | PGlite para pruebas de BD | Docker + `supabase start` | Docker no disponible; PGlite ejecuta Postgres real (WASM) |
| ADR-006 | Gráficos y fondos con `react-native-svg` | victory-native/Skia | Menos dependencias nativas, control estético total |
| ADR-007 | Inter como tipografía | Manrope | Cifras tabulares y legibilidad en tamaños pequeños; Manrope queda descartada para no mezclar familias |
| ADR-008 | Iconos `lucide-react-native` | SF Symbols/Material | Lineales, consistentes en todas las plataformas |
| ADR-009 | El build web (react-native-web) es la UI de escritorio y el objetivo de E2E | Solo nativo | Una UI para Android y PC; Playwright sin emulador |
| ADR-011 | **Plataformas: Android + Windows + Linux.** Escritorio con Electron sobre el export web de Expo | Tauri (sin Rust; WebKitGTK en Linux difiere de WebView2), React Native Windows (sin Linux), Flutter (reescritura) | Mismo Chromium en Windows y Linux; compilable y verificable aquí; APIs nativas de notificación, bandeja, `safeStorage` y atajos |
| ADR-012 | Capa `src/platform/` con archivos `.native.ts` / `.web.ts` y puente `window.nebulaDesktop` (preload) | `Platform.OS` disperso | Aísla diferencias de plataforma; las features no conocen la plataforma |
| ADR-010 | Sin monedas/XP/niveles; constancia como métrica principal | Gamificación | Requisito explícito |
