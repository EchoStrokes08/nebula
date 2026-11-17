# Nebula — Pruebas

Estrategia resumida en `PLAN_DESARROLLO.md` §12. Aquí están los comandos, qué cubre cada capa y la
última evidencia registrada.

## Comandos

| Comando | Qué ejecuta |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (TypeScript estricto) |
| `npm run lint` | ESLint (config de Expo) |
| `npm test` | Jest proyecto `app`: dominio, componentes, adaptadores de plataforma |
| `npm run test:db` | Jest proyecto `db`: migraciones reales en PGlite, RLS como distintos usuarios |
| `npm run test:desktop` | `node --test desktop/*.test.cjs`: estado de ventana, enlaces `nebula://`, autoinicio, atajos, bloqueo de secretos en Metro |
| `npm run check` | Todo lo anterior |
| `npm run e2e:build` | Build real (`dist/`) y build de vista previa sin servidor (`.e2e/preview/`) |
| `npm run e2e` | Playwright: accesibilidad, teclado, capturas, autenticación, resiliencia y flujos con cuentas |
| `npm run e2e:shots` | Regenera `docs/screenshots/` (390, 1280 y 1920 px) |
| `node scripts/scan-bundle.cjs [dir]` | Busca secretos en un build (se ejecuta en `build:desktop`) |
| `node scripts/test-groq.mjs` | Llamada real al proveedor de IA sin aplicar acciones |

## Capas

1. **Dominio** (`src/domain/**`): funciones puras con tablas de casos, DST (Europe/Madrid,
   America/Bogota), umbrales de datos. Incluye hábitos (7 tipos, rachas, recomendaciones
   adaptativas), planificación, temporizador, estadísticas, motivación, notificaciones (silencio,
   tope, ruta al tocar), diario inteligente.
2. **Componentes** (`src/components/components.test.tsx` y otros): roles, etiquetas, estados
   deshabilitados/ocupados, acciones de accesibilidad.
3. **Base de datos** (`supabase/tests/`): RLS de todas las tablas, `search_path` en funciones
   privilegiadas, permisos de PUBLIC, puntuación y cierre de retos, «no puedo escribir progreso
   ajeno», ciclos de dependencias, cascada de borrado de cuenta.
4. **Escritorio** (`desktop/*.test.cjs` + sonda): además de los tests unitarios, el AppImage se
   arranca en modo headless con una sonda (`NEBULA_PROBE`) que comprueba el puente expuesto, la
   ausencia de Node en el renderer, el rechazo de ajustes inválidos y la mini-ventana.
5. **E2E web** (`e2e/`, base también del escritorio):
   - `a11y.spec.ts`: axe WCAG 2.1 A/AA en 28 pantallas (vista previa).
   - `keyboard.spec.ts`: Ctrl+1…5, Ctrl+K, Esc, recorrido con Tab y foco visible.
   - `visual.spec.ts`: capturas en tres tamaños, sin errores de página.
   - `auth.spec.ts`: guardas sin sesión, validación del registro, axe y capturas de acceso.
   - `resilience.spec.ts`: sesión caducada, sin conexión, conexión lenta sin doble envío.
   - `flows.spec.ts`: hábito → registro → persistencia → estadística; tarea y meta; reto 1 vs. 1
     con dos cuentas. **Necesita** `E2E_EMAIL_A`, `E2E_PASSWORD_A` (y `_B` para el duelo); sin
     ellas se omite e indica el motivo.

## Evidencia (2026-11-17)

- `npm run check`: 58 suites, **252 tests** de app y BD en verde; **9/9** de escritorio.
- `npx playwright test`: **122 pasados**, 5 omitidos (3 flujos sin credenciales, el catálogo solo
  existe en desarrollo, la caducidad de sesión sin `.env`); `npm run e2e -- e2e/resilience.spec.ts`:
  3/3 con `.env`.
- axe: 0 infracciones serias o críticas en 32 rutas.
- Escaneo de secretos: limpio en `dist/`, `.e2e/preview/` y `.desktop-app/`.
- AppImage `release/Nebula-1.0.0.AppImage` probado empaquetado con la sonda.
- Groq real: respuesta con acciones válidas.

## Pendiente de verificación manual

- Flujos con dos cuentas reales (B-07) y reto grupal.
- Android en el Xiaomi: TalkBack, escala de fuente 200 %, notificaciones programadas, temporizador
  en segundo plano, Maestro (B-03).
- Instalador de Windows (B-05) y `.deb` (mantenedor).
