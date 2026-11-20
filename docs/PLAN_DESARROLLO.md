# Nebula — Plan de desarrollo

> Documento vivo. Es la fuente principal para controlar la implementación de Nebula.
> No se reescribe desde cero: se actualizan casillas, se añaden tareas y se registra el progreso.
>
> Fuentes: `Nebula.pdf` (visión original, 5 páginas, con dos maquetas «Con amigos», un panel
> de frases de referencia y un tablero de inspiración cromática) y el «Prompt maestro — Nebula»
> (requisitos ampliados). Cuando ambos difieren, la resolución está en §16 (Decisiones).

**Convenciones de estado**

| Marca | Significado |
|---|---|
| `[ ]` | Pendiente |
| `[-]` | En desarrollo |
| `[x]` | Terminada **y verificada** contra su criterio de aceptación |
| `[!]` | Bloqueada (la explicación va en la propia tarea y en §15) |

**Prioridad:** `P0` imprescindible para el MVP · `P1` deseable en el MVP · `P2` versión completa · `P3` posterior/opcional.
**Complejidad:** `S` (< ½ día) · `M` (½–2 días) · `L` (2–5 días) · `XL` (> 5 días; debe dividirse).
**Alcance:** `MVP` o `AVZ` (versión avanzada), según §17.

Formato de cada tarea importante:

```
- [ ] Fxx-nnn — Descripción concreta. `P0` `M` `MVP`
  - Resultado: qué existe al terminar.
  - Depende de: tareas previas.
  - Aceptación: condición comprobable.
  - Verificación: cómo se comprueba (test, comando, revisión visual…).
```

---

## 1. Resumen y visión del proyecto

Nebula es una aplicación de productividad personal, inteligente y social para **Android** y
**PC (Windows y Linux)**, con una única base de código (ver D-12). iOS y macOS quedan fuera del
alcance de destino (el código no los impide, pero no se configuran, prueban ni publican). Reúne hábitos, tareas, metas, proyectos con
dependencias, agenda, sesiones de concentración, estadísticas, amistades, objetivos
cooperativos, competencias justas, motivación contextual e IA aplicada a la planificación.

Debe responder siempre a tres preguntas:

1. **¿Qué debería hacer hoy?** → panel Hoy, Día viable, planificación.
2. **¿Qué está impidiendo que avance?** → dependencias bloqueantes, fricción, sobrecarga, radar de distracciones.
3. **¿Cómo puedo mejorar, solo y acompañado?** → estadísticas, perfil de productividad, retos, pactos, metas compartidas.

Identidad: **Cosmic Minimalism** — oscuro, violeta, preciso, con el espacio como atmósfera
(estrellas discretas, nebulosas de baja opacidad, constelaciones como metáfora de conexión),
nunca como gamificación infantil. Navegación con palabras normales: **Hoy, Hábitos, Agenda,
Retos, Perfil** (PDF §6).

## 2. Objetivos

### 2.1. Objetivo general
Construir una aplicación real, persistente y segura que convierta intenciones en resultados
sostenibles, con un diseño premium coherente y una capa social con reglas justas y verificables.

### 2.2. Objetivos específicos
- OE-1. Gestión de hábitos de 7 tipos con historial íntegro y modo recuperación.
- OE-2. Tareas, metas y proyectos con dependencias acíclicas y bloqueos visibles.
- OE-3. Agenda (día/semana/mes), planificación sin solapamientos, Día viable y temporizador robusto en segundo plano.
- OE-4. Estadísticas calculadas exclusivamente a partir de registros reales.
- OE-5. Sistema social completo (amistades, círculos, cooperativos, 1 vs. 1, grupales, equipos, pactos) con puntuación autoritativa en servidor.
- OE-6. Motivación contextual (≥ 80 mensajes originales, 3 intensidades) y notificaciones con control total del usuario.
- OE-7. IA con acciones estructuradas, vista previa y autorización; planificación determinista que funciona sin IA.
- OE-8. Privacidad por defecto, RLS en todas las tablas, ningún secreto en el cliente.
- OE-9. Accesibilidad (contraste AA, lectores de pantalla, texto escalable, movimiento reducido).

## 3. Alcance funcional completo

| Área | Contenido | Fase |
|---|---|---|
| Fundamentos | Proyecto Expo + TS, navegación, temas, persistencia, pruebas | F01 |
| Diseño | Tokens, tipografía, fondos espaciales, componentes, animaciones | F02 |
| Cuentas | Registro, login, OAuth (si configurado), recuperación, verificación, sesiones, borrado de cuenta, onboarding, perfil | F03 |
| Hábitos | 7 tipos, registro, edición, deshacer, notas, pausa, archivo, historial, versión de objetivos, recuperación, adaptación | F04 |
| Tareas/metas/proyectos | CRUD, subtareas, etiquetas, recurrencia, filtros, búsqueda, metas medibles, hitos, dependencias (DAG), simulador | F05 |
| Agenda | Vistas día/semana/mes, línea temporal, bloques, recurrencia, conflictos, negociación, Día viable, temporizador | F06 |
| Estadísticas | KPIs, gráficos, mapa de consistencia, comparación de periodos, perfil de productividad, radar de distracciones, revisión de compromisos | F07 |
| Social | Amistades, bloqueo, visibilidad, círculos, cooperativos (colectiva/distribuida), 1 vs. 1, grupales, equilibrados, equipos, pactos, integridad | F08 |
| Motivación | Biblioteca ≥ 80 mensajes, 3 intensidades, motor contextual, notificaciones locales y push, horas de silencio, resumen semanal | F09 |
| IA | Capa de proveedor en servidor, asistente, acciones con vista previa, captura universal, sobrecarga, fricción, pérdida de constancia, resumen inteligente | F10 |
| Avanzado | Voz, diario, mapa de progreso (constelación), sesiones compartidas de enfoque, revisión semanal, integraciones (calendario, accesos rápidos, widgets), personalización | F11 |
| Calidad | Rendimiento, accesibilidad, seguridad, offline, pruebas E2E | F12 |
| Producción | Entornos, CI, builds EAS, documentación, lanzamiento | F13 |

**Fuera de alcance explícito:** monedas, XP, niveles, planetas coleccionables; lectura de
notificaciones de otras apps o supervisión de otras aplicaciones (el SO no lo permite sin
permisos especiales; el radar es de registro voluntario); inferencias psicológicas o médicas.

## 4. Requisitos

### 4.1. Funcionales (resumen trazable; el detalle está en las tareas)
- RF-01 Cuentas reales con email/contraseña; OAuth cuando haya credenciales; recuperación; verificación; cierre de sesión; borrado de cuenta y datos. → F03
- RF-02 Onboarding breve (≤ 8 pasos, todos salvo el primero omitibles). → F03
- RF-03 Hábitos binarios, duración, cantidad, frecuencia, acumulativos, reducción y flexibles. → F04
- RF-04 Registro, edición retroactiva, deshacer, notas, pausa, archivo, recuperación. → F04
- RF-05 Cambiar objetivo o frecuencia no altera el cálculo de periodos pasados (objetivos versionados). → F04
- RF-06 Tareas con prioridad, fecha límite, subtareas, etiquetas, notas, estados, recurrencia, recordatorios, orden manual, filtros, búsqueda, agrupación. → F05
- RF-07 Metas medibles con hitos, tareas/hábitos asociados, historial, visibilidad, participantes. → F05
- RF-08 Proyectos con dependencias sin ciclos y visualización de bloqueos. → F05
- RF-09 Simulador de metas con escenarios conservador/medio/exigente, separando cálculo y estimación. → F05
- RF-10 Calendario día/semana/mes respetando zona horaria; detección de conflictos; propuestas que el usuario acepta. → F06
- RF-11 Día viable: Completo, Esencial, Recuperación; nunca elimina compromisos. → F06
- RF-12 Temporizador Pomodoro/libre/largo con pausas y coherencia en segundo plano. → F06
- RF-13 Estadísticas y perfil de productividad solo con datos reales; radar de distracciones voluntario. → F07
- RF-14 Amistades con solicitudes, bloqueo y visibilidad; sin exponer emails. → F08
- RF-15 Círculos, cooperativos, 1 vs. 1, grupales, equilibrados, equipos y pactos con aceptación de reglas. → F08
- RF-16 Puntuación, cierre y desempate ejecutados en servidor. → F08
- RF-17 Mensajes motivacionales contextuales con 3 intensidades. → F09
- RF-18 Notificaciones por tipo, horas de silencio, límite de frecuencia. → F09
- RF-19 Asistente IA con acciones estructuradas y confirmación previa; desactivable. → F10
- RF-20 Captura universal en lenguaje natural y por voz, con confirmación. → F10/F11
- RF-21 Diario, revisión de compromisos, revisión semanal configurable, mapa de progreso, salas de enfoque. → F07/F11
- RF-22 Integraciones reales y declaradas (sin simular sincronizaciones). → F11

### 4.2. No funcionales
- RNF-01 Seguridad: RLS en el 100 % de tablas de usuario; funciones sensibles en servidor; ninguna clave privada en el bundle.
- RNF-02 Rendimiento: arranque en frío < 2,5 s en gama media (build de producción); listas virtualizadas; 60 fps en transiciones.
- RNF-03 Accesibilidad: contraste ≥ 4.5:1 en texto normal; objetivos táctiles ≥ 44 pt; `accessibilityLabel`/`Role` en controles; soporte de `reduceMotion` y escala de fuente.
- RNF-04 Fiabilidad: lectura offline de los datos en caché; registros de hábitos encolados sin conexión; estados de error recuperables.
- RNF-05 Mantenibilidad: TypeScript estricto, lógica de dominio pura y probada, sin duplicar lógica entre pantallas.
- RNF-06 Privacidad: mínimo de datos enviados a IA; visibilidad privada por defecto; borrado completo de cuenta.
- RNF-07 Internacionalización: textos en español centralizados (preparado para i18n); fechas con la zona horaria del perfil.
- RNF-08 Animaciones 150–350 ms, desactivables por la preferencia del sistema.
- RNF-09 **Plataformas objetivo:** Android 10+ (API 29+) y escritorio Windows 10/11 y Linux x64 (AppImage y .deb). Cada funcionalidad se valida en Android y en escritorio; cuando una capacidad no exista en una plataforma se documenta y se ofrece una alternativa (nunca un botón muerto).
- RNF-10 **Escritorio:** diseño adaptable (barra lateral en ventanas anchas, barra inferior en estrechas), uso completo con teclado y ratón (foco visible, hover, atajos), ventana redimensionable desde 400 px de ancho.

## 5. Propuesta tecnológica y justificación

| Capa | Elección | Justificación |
|---|---|---|
| App | **Expo SDK 58 + React Native 0.88 + TypeScript** | Android nativo y, mediante react-native-web, la misma UI para escritorio |
| Escritorio | **Electron** (+ electron-builder) envolviendo el build web de Expo | Chromium idéntico en Windows y Linux; compilable sin Rust; notificaciones, bandeja y atajos nativos (D-12) |
| Navegación | **Expo Router** | Rutas por archivos, deep links, pestañas y modales tipados |
| Animación | **Reanimated 4** | Animaciones en hilo de UI; `useReducedMotion` |
| Gráficos y fondos | **react-native-svg** + componentes propios | Ligero, controla la estética; evita depender de Skia para gráficos simples |
| Iconos | **lucide-react-native** | Iconografía lineal coherente, sin emojis |
| Tipografía | **Inter** (`@expo-google-fonts/inter`) | Excelente legibilidad en pantallas densas y cifras tabulares para estadísticas |
| Estado servidor | **TanStack Query 5** (+ persistencia) | Caché, invalidación, reintentos, offline |
| Estado local | **Zustand 5** | Temporizador, preferencias de UI, borradores |
| Backend | **Supabase**: Postgres, Auth, RLS, Realtime, Edge Functions (Deno) | Requerido por el prompt; RLS para autorización en BD |
| Fechas | **date-fns + date-fns-tz** (evaluar `Temporal` cuando sea estable en Hermes) | Zonas horarias explícitas |
| Validación | **zod** | Esquemas compartidos cliente/Edge Functions |
| Notificaciones | **expo-notifications** (locales) + Expo Push desde Edge Function | Recordatorios offline y avisos sociales |
| Pruebas unitarias/componentes | **jest-expo + @testing-library/react-native** | Estándar en Expo |
| Pruebas de BD | **PGlite** (Postgres en WASM) ejecutando las migraciones reales | No hay Docker en el entorno; permite probar SQL, restricciones y RLS |
| E2E | **Playwright** sobre el build web; **Maestro** para nativo cuando haya dispositivo | Flujos completos verificables aquí |
| Calidad | ESLint (config Expo), `tsc --noEmit`, Prettier | — |

Las versiones exactas se fijan al instalar y se registran en `docs/ARQUITECTURA.md`.

## 6. Arquitectura general prevista

```
app/                    Rutas Expo Router (pantallas finas)
  (auth)/               Bienvenida, login, registro, recuperación
  (onboarding)/         Pasos de personalización
  (tabs)/               hoy, habitos, agenda, retos, perfil
  ...                   Rutas modales y de detalle
src/
  design/               Tokens, tema, tipografía, fondos espaciales
  components/           Componentes UI reutilizables (sin lógica de negocio)
  domain/               Lógica pura y probada: hábitos, rachas/constancia, recuperación,
                        simulador, planificador, conflictos, Día viable, puntuación de retos,
                        motor de mensajes, parser de captura
  features/<módulo>/    Hooks de datos (TanStack Query), formularios, vistas compuestas
  data/                 Cliente Supabase, repositorios, tipos generados, cola offline
  lib/                  Utilidades (fechas/zonas, ids, errores)
supabase/
  migrations/           SQL versionado (esquema, RLS, funciones, triggers)
  functions/            Edge Functions: ai-assist, challenge-close, push-dispatch, account-delete
  tests/                Pruebas SQL/RLS ejecutadas con PGlite
desktop/                Proceso principal de Electron (ventana, bandeja, notificaciones,
                        almacenamiento seguro, deep links nebula://) y preload aislado
src/platform/           Adaptadores por plataforma (`.native.ts` / `.web.ts` + puente Electron):
                        almacenamiento de sesión, notificaciones, háptica, voz
docs/                   Documentación obligatoria
```

Principios: pantallas finas → hooks de feature → repositorio → Supabase; la lógica de negocio
vive en `src/domain` (pura, testeable) y, cuando debe ser autoritativa (puntuación social,
cierre de retos, permisos), en funciones SQL `security definer` / Edge Functions.
Detalle completo en `docs/ARQUITECTURA.md`.

## 7. Fases y orden de implementación

```
F00 → F01 → F02 ─┬→ F03 → F04 ─┬→ F05 ─┬→ F06 → F07 ─┐
                 │             │       │              ├→ F09 → F10 → F11 → F12 → F13
                 │             └───────┴→ F08 ────────┘
```

| Fase | Nombre | Hito |
|---|---|---|
| F00 | Análisis, investigación y planificación | — |
| F01 | Arquitectura técnica, configuración y estructura | H1 «Esqueleto navegable» |
| F02 | Identidad visual, sistema de diseño y componentes | H1 |
| F03 | Autenticación, onboarding y perfiles | H2 «Cuenta real» |
| F04 | Hábitos | H3 «Núcleo personal» |
| F05 | Tareas, metas, proyectos y dependencias | H3 |
| F06 | Agenda, planificación y concentración | H3 |
| F07 | Estadísticas, analíticas e historial | H3 |
| F08 | Amistades, retos, competencias y colaboración | H4 «Social» |
| F09 | Motivación contextual y notificaciones | **H5 «MVP»** |
| F10 | IA, planificación adaptable y automatizaciones | H6 «Inteligencia» |
| F11 | Funcionalidades avanzadas, integraciones y personalización | H7 «Versión completa» |
| F12 | Optimización visual, accesibilidad, seguridad y pruebas integrales | H7 |
| F13 | Producción, documentación y lanzamiento | H8 «Lanzamiento» |

Las tareas `AVZ` de F04–F09 pueden posponerse tras H5 sin bloquear el MVP.

## 8. Dependencias entre fases

| Fase | Depende de | Motivo |
|---|---|---|
| F01 | F00 | Plan y decisiones aprobados |
| F02 | F01 | Proyecto, rutas y tema configurados |
| F03 | F01, F02 | Cliente Supabase, esquema base, componentes de formulario |
| F04 | F03 | Datos por usuario con RLS |
| F05 | F03, F04 (asociación meta↔hábito) | — |
| F06 | F04, F05 | La agenda agrupa hábitos y tareas; el temporizador se asocia a ellos |
| F07 | F04–F06 | Las métricas se calculan desde sus registros |
| F08 | F03, F04, F06 | Retos puntúan registros de hábitos y sesiones de enfoque |
| F09 | F04–F08 | Mensajes contextuales usan eventos reales de todos los módulos |
| F10 | F05, F06, F09 | La IA propone acciones sobre entidades existentes y el planificador determinista |
| F11 | F06–F10 | Voz usa el parser de F10; salas usan Realtime y enfoque |
| F12 | Todas | Auditoría transversal |
| F13 | F12 | — |

## 9. Tareas y subtareas detalladas (checklist)

### FASE 00 — Análisis del documento, investigación del repositorio y planificación

- [x] F00-001 — Leer y analizar `Nebula.pdf` completo, incluidas sus imágenes. `P0` `S` `MVP`
  - Resultado: requisitos del PDF inventariados (§3, matriz F00-004).
  - Depende de: —
  - Aceptación: las 7 secciones del PDF y sus 4 imágenes están reflejadas en el plan.
  - Verificación: matriz de trazabilidad (§9 F00-004).
- [x] F00-002 — Inspeccionar el entorno y el repositorio. `P0` `S` `MVP`
  - Resultado: no existe proyecto previo; se crea `~/proyectos/nebula` (repo git nuevo). Herramientas: Node 26, npm, git; **sin Docker ni Supabase CLI**; registro npm accesible.
  - Aceptación: hallazgos registrados en §15 y §16.
  - Verificación: revisión de §15.
- [x] F00-003 — Crear este `docs/PLAN_DESARROLLO.md`. `P0` `M` `MVP`
  - Aceptación: contiene las 17 secciones obligatorias y fases F00–F13 en formato checklist.
  - Verificación: revisión del índice de este documento.
- [x] F00-004 — Matriz de trazabilidad PDF/prompt → tareas. `P0` `S` `MVP`
  - Resultado: tabla al final de esta fase.
  - Aceptación: cada funcionalidad del PDF y de las secciones 5–13 del prompt tiene al menos una tarea.
  - Verificación: revisión de la matriz.
- [x] F00-005 — Registrar contradicciones y decisiones iniciales (§16). `P0` `S` `MVP`
- [x] F00-006 — Validar el plan con el propietario del producto (presentación de resumen). `P1` `S` `MVP`
  - Verificación (2026-11-17): Resumen presentado al propietario al cerrar la sesión del 2026-11-17 (plan, ubicación, bloqueos B-01…B-07).
  - Aceptación: el usuario conoce el plan, la ubicación del proyecto y los bloqueos de credenciales.

**Matriz de trazabilidad (F00-004)**

| Origen | Funcionalidad | Tareas |
|---|---|---|
| PDF §1 | Concepto premium espacial, claridad estilo HelloHabit | F02-*, F04-*, F12-001 |
| PDF §2.01 / Prompt §12.1–12.4 | Planificación inteligente, huecos libres, replanificación, sobrecarga | F06-010…F06-014, F10-005…F10-010 |
| PDF §2.02 / §6.4 | Hábitos adaptativos, versión mínima | F04-020, F04-021 |
| PDF §2.03 / §9.4 | Radar de distracciones | F07-012, F07-013 |
| PDF §2.04 / §7.4 | Simulador de metas | F05-016, F05-017 |
| PDF §2.05 / §6.5 | Modo recuperación | F04-018, F04-019 |
| PDF §3 (maqueta «En equipo») | Objetivo cooperativo con contribuciones visibles | F08-012…F08-015 |
| PDF §3 (maqueta «Competencia») | Clasificación por % de objetivo personal | F08-016…F08-024 |
| PDF §3 Duelo / Metas compartidas / Equilibrados | 1 vs. 1, metas compartidas, retos equilibrados | F08-016, F08-012, F08-020 |
| PDF §4 / Prompt §11 | Frases fuertes, contextuales, en notificaciones y paneles | F09-001…F09-012 |
| PDF §5 | Calendario que negocia, metas dependientes, voz, perfil de productividad, pactos, predicción de abandono | F06-013, F05-011…F05-014, F11-001, F07-010, F08-027, F10-012 |
| PDF §6 | Paleta, estrellas, constelaciones, navegación Hoy/Hábitos/Agenda/Retos/Perfil | F02-001…F02-006, F01-006, F11-004 |
| PDF §7 | Priorización MVP / avanzada | §17 |
| Prompt §5 | Onboarding, autenticación, personalización | F03-* |
| Prompt §7.1 | Tareas completas | F05-001…F05-008 |
| Prompt §8.4 | Día viable | F06-015 |
| Prompt §8.5 | Temporizador | F06-016…F06-020 |
| Prompt §9 | Estadísticas, visualizaciones | F07-* |
| Prompt §10.1–10.9 | Social completo e integridad | F08-* |
| Prompt §12.5–12.8 | Fricción, constancia, resumen semanal, privacidad IA | F10-011…F10-016 |
| Prompt §13 | Captura universal, voz, revisión de compromisos, mapa, diario, salas, revisión semanal, integraciones | F10-004, F11-001…F11-012, F07-014 |
| Prompt §14 | 40 pantallas documentadas | F02-020, `docs/DISENO_UI_UX.md` |
| Prompt §16–19 | BD, seguridad, calidad, documentación | F01-*, F12-*, F13-* |

---

### FASE 01 — Arquitectura técnica, configuración y estructura

- [x] F01-001 — Redactar `docs/ARQUITECTURA.md` (módulos, flujo de datos, ADR iniciales). `P0` `S` `MVP`
  - Depende de: F00-005
  - Aceptación: describe capas, carpetas, estrategia offline, seguridad y decisiones ADR-001…ADR-008.
  - Verificación: revisión del documento.
- [x] F01-002 — Crear proyecto Expo (TypeScript estricto) con Expo Router. `P0` `S` `MVP`
  - Resultado: `package.json`, `app.json`, `tsconfig.json` (`strict: true`, alias `@/`).
  - Depende de: F01-001
  - Aceptación: `npx tsc --noEmit` sin errores; la app arranca en web.
  - Verificación: comando + captura de la web.
- [x] F01-003 — Instalar dependencias evaluadas (§5) y fijar versiones compatibles con el SDK (`npx expo install`). `P0` `S` `MVP`
  - Aceptación: `npx expo-doctor` sin errores críticos; versiones registradas en ARQUITECTURA.
  - Verificación: salida de `expo-doctor`.
- [x] F01-004 — Configurar ESLint, Prettier y scripts (`lint`, `typecheck`, `test`, `test:db`). `P0` `S` `MVP`
  - Aceptación: los cuatro scripts se ejecutan sin errores.
  - Nota: Prettier no se instaló (sin necesidad demostrada; ESLint de Expo cubre el estilo). Se reevaluará si aparecen diferencias de formato.
- [x] F01-005 — Estructura de carpetas (§6) y alias de importación. `P0` `S` `MVP`
- [x] F01-006 — Navegación: grupo `(tabs)` con Hoy, Hábitos, Agenda, Retos, Perfil; grupos `(auth)` y `(onboarding)`; guardas de sesión. `P0` `M` `MVP`
  - Depende de: F01-002
  - Aceptación: sin sesión → bienvenida; con sesión sin onboarding → onboarding; con todo → Hoy. Ninguna ruta apunta a pantallas inexistentes.
  - Verificación: test de la función de redirección + prueba manual en web.
  - Estado: completo. Rutas protegidas (`Stack.Protected`) por estado `config/preview/loading/auth/recovery/onboarding/app` (`gate.test.ts`); `/` redirige según el estado (`entryRoute.test.ts`); «Hoy» vive en `/hoy`. Verificado en escritorio: sin sesión, `/` → bienvenida.
- [x] F01-007 — Sistema de temas (tokens → `ThemeProvider`) — base para F02. `P0` `S` `MVP`
- [x] F01-008 — Cliente Supabase con almacenamiento de sesión seguro (SecureStore en nativo, localStorage en web) y variables `EXPO_PUBLIC_*` validadas. `P0` `S` `MVP`
  - Aceptación: sin variables configuradas la app muestra una pantalla de configuración clara (no falla en silencio); no hay claves privadas en el cliente.
  - Verificación: test de `env.ts`; búsqueda de `service_role` en `src/` = 0 resultados.
  - Nota: la cadena `service_role` solo aparece en `src/lib/env.ts`, en la comprobación que **rechaza** esa clave (test incluido); no hay ninguna clave en el cliente.
- [x] F01-009 — Migración inicial SQL: extensiones, esquema `public`, tabla `profiles`, `user_preferences`, trigger de alta de usuario, RLS. `P0` `M` `MVP`
  - Aceptación: la migración se aplica sin errores en PGlite; un usuario no puede leer el perfil privado de otro.
  - Verificación: `npm run test:db`.
- [x] F01-010 — Arnés de pruebas de BD con PGlite (esquema `auth` simulado, `auth.uid()` controlable, roles `authenticated`/`anon`). `P0` `M` `MVP`
  - Aceptación: los tests pueden actuar como usuarios distintos y comprobar RLS.
  - Verificación: test de humo RLS en verde.
- [x] F01-011 — Configurar TanStack Query (cliente, reintentos, `onlineManager`/`focusManager` de RN) y persistencia de caché. `P0` `S` `MVP`
  - Verificación (2026-11-17): `onlineManager` (NetInfo), `focusManager` (AppState) y caché persistida por cuenta en `src/data/offline/runtime.ts`; cola probada en `queue.test.ts`.
  - Estado: `QueryClient` creado; faltan `onlineManager`/`focusManager` y persistencia.
- [x] F01-012 — Utilidades de fecha con zona horaria del perfil (`dayKey`, inicio/fin de semana configurables). `P0` `S` `MVP`
  - Aceptación: tests con DST (Europe/Madrid, America/Bogota) en verde.
- [x] F01-013 — Pruebas iniciales: jest-expo + Testing Library funcionando; un test de componente y uno de dominio. `P0` `S` `MVP`
  - Estado: completo (`EmptyState.test.tsx`).
- [x] F01-014 — `.env.example`, `README.md` inicial, `.gitignore`. `P0` `S` `MVP`
- [x] F01-016 — Shell de escritorio Electron: carga el build web exportado, `contextIsolation` activo, sin `nodeIntegration`, preload mínimo, CSP, ventana con tamaño mínimo y estado recordado. `P0` `M` `MVP`
  - Verificación (2026-11-17): Tamaño/posición recordados (`state.cjs`), icono de ventana, instancia única. Sonda sobre el AppImage: puente de 9 claves, renderer sin Node.
  - Depende de: F01-002
  - Aceptación: `npm run desktop` abre Nebula en Linux; el renderer no tiene acceso a Node.
  - Verificación: arranque en Linux + test del preload (API expuesta limitada).
  - Estado: verificado en Linux — carga el export, CSP activa, renderer sin `require` ni Node, puente con 3 claves, `safeStorage` asíncrono con ida y vuelta correcta. Falta recordar tamaño/posición de la ventana.
- [x] F01-017 — Capa `src/platform/` con adaptadores: almacenamiento de sesión (SecureStore en Android, `safeStorage` de Electron en escritorio, localStorage solo en navegador de desarrollo), notificaciones, háptica (no-op en escritorio). `P0` `M` `MVP`
  - Verificación (2026-11-17): Notificaciones, háptica, voz (`src/platform/VoiceCapture.*`), calendario, OAuth y almacenamiento en `src/platform/`; búsqueda de imports de plataforma fuera de esa carpeta = 0.
  - Aceptación: ningún módulo de `features/` importa APIs específicas de plataforma directamente.
  - Verificación: tests de cada adaptador + búsqueda de imports prohibidos.
  - Estado: almacenamiento de sesión hecho y probado (Android/escritorio/navegador); faltan notificaciones y háptica.
- [x] F01-018 — Empaquetado: Linux (AppImage + .deb) con electron-builder; configuración de Windows (NSIS) lista; Android con `expo prebuild`/Gradle. `P1` `M` `MVP`
  - Verificación (2026-11-17): AppImage generado y probado empaquetado. Windows (NSIS) en CI `windows-latest`; el `.deb` se genera en CI si existe la variable `DEB_MAINTAINER` (dato del propietario).
  - Aceptación: se genera el AppImage en este entorno; Windows se compila en CI `windows-latest` (F13-002).
  - Estado: AppImage generado en `release/` (no lanzado todavía como paquete). El `.deb` necesita mantenedor y web del proyecto (pendiente del propietario). Windows pendiente de CI.
- [x] F01-015 — Verificar criterios de aceptación de F01 (typecheck, lint, test, test:db, arranque web y escritorio Linux). `P0` `S` `MVP`
  - Verificación (2026-11-17): 2026-11-17: `npm run check` (typecheck, lint, 252 tests app+BD, 9 de escritorio), build web y AppImage arrancado en Linux con sonda headless.

### FASE 02 — Identidad visual, sistema de diseño y componentes UI

- [x] F02-001 — Tokens de color (paleta §3.2 del prompt + estados, bordes, sombras, gráficos, deshabilitados). `P0` `S` `MVP`
  - Aceptación: todos los pares texto/fondo usados cumplen AA (≥ 4.5:1; ≥ 3:1 para texto grande e iconos).
  - Verificación: test automático de contraste sobre los tokens.
- [x] F02-002 — Escala tipográfica Inter (display → caption), cifras tabulares, soporte de escalado. `P0` `S` `MVP`
  - Verificación (2026-11-17): Escala en `tokens.ts`, `Text` con cifras tabulares y `maxFontSizeMultiplier=2`.
- [x] F02-003 — Espaciado (base 4), radios, elevaciones, sombras y gradientes como tokens. `P0` `S` `MVP`
  - Verificación (2026-11-17): Espaciado base 4, radios, elevaciones, sombras y gradientes en `tokens.ts`.
- [x] F02-004 — Fondo espacial `SpaceBackground`: gradiente, nebulosa abstracta de baja opacidad, campo de estrellas determinista (semilla), sin fotografías tras texto. `P0` `M` `MVP`
  - Aceptación: estático con movimiento reducido; coste de render bajo (SVG memoizado).
  - Verificación: revisión visual en web + test de que respeta `reduceMotion`.
- [x] F02-005 — Primitivas: `Text`, `Surface`/`Card`, `GlassPanel` (uso restringido), `Divider`, `Icon`. `P0` `S` `MVP`
  - Verificación (2026-11-17): `Text`, `Card`/`Surface`, `GlassPanel`, `Divider`, `Icon` (decorativo por defecto, con etiqueta si informa).
- [x] F02-006 — Botones (primario, secundario, fantasma, destructivo, icono) con estados pulsado/foco/deshabilitado/cargando y háptica. `P0` `S` `MVP`
  - Verificación (2026-11-17): Variantes primario/secundario/fantasma/destructivo con icono, foco visible, `aria-busy`/`aria-disabled`, háptica; tests en `components.test.tsx`.
- [x] F02-007 — Formularios: `TextField`, `TextArea`, `Select`, `SegmentedControl`, `Switch`, `Chip`, `Stepper`, selector de días, de hora, de color e icono; mensajes de error. `P0` `M` `MVP`
  - Verificación (2026-11-17): Añadidos `TextArea`, `Select`, `SegmentedControl`, `Switch`, `Stepper`; selectores de días/hora/color/icono en los editores.
- [x] F02-008 — Progreso: `ProgressBar`, `ProgressRing`, `ContributionBar` (multi-segmento para cooperativos). `P0` `S` `MVP`
  - Verificación (2026-11-17): `ProgressBar`, `ProgressRing` y `ContributionBar` accesibles y animados.
- [x] F02-009 — Gráficos SVG: líneas, barras, mapa de consistencia (heatmap), distribución por categoría; accesibles (resumen textual). `P1` `M` `MVP`
  - Verificación (2026-11-17): Barras, líneas, mapa anual y distribución con resumen textual.
- [x] F02-010 — Estados: `EmptyState`, `Skeleton`, `ErrorState` (con reintento), `OfflineBanner`, `PermissionState`. `P0` `S` `MVP`
  - Verificación (2026-11-17): `EmptyState`, `Skeleton`/`SkeletonList` (sustituye los «Cargando…»), `ErrorState`, `OfflineBanner`, `PermissionState`.
- [x] F02-011 — Superposiciones: `Modal`, `BottomSheet`, `ConfirmDialog`, `Toast` (con acción Deshacer), menú contextual. `P0` `M` `MVP`
  - Verificación (2026-11-17): `Sheet`, `ConfirmDialog` (sustituye el `confirm` del navegador en escritorio vía `ConfirmHost`), `UndoToast`, menú contextual (`useContextMenu`).
- [x] F02-012 — Navegación principal adaptable: barra inferior en Android y ventanas estrechas; barra lateral en escritorio ancho (≥ 900 px). Iconos lineales, etiquetas, indicador activo animado, áreas seguras, botón de creación rápida. `P0` `M` `MVP`
  - Verificación (2026-11-17): Indicador activo animado, botón de captura rápida (barra lateral y botón flotante en Android); barra lateral con semántica de navegación.
  - Estado: barra inferior (<900 px) y lateral (≥900 px) verificadas en capturas; faltan indicador animado y botón de creación rápida.
- [x] F02-019 — Escritorio: layout de columnas (lista + detalle en ≥ 1100 px), ancho máximo de contenido, estados hover y foco visible, atajos de teclado (`Ctrl+K` captura, `Ctrl+1…5` secciones, `Esc` cerrar modales), menú contextual con clic derecho, desplazamiento con rueda. `P0` `M` `MVP`
  - Verificación (2026-11-17): Columnas lista+detalle ≥ 1100 px (Hábitos, Tareas), Ctrl+K, Ctrl+1…5, Esc cierra diálogos y pantallas modales, clic derecho; E2E de teclado en verde.
  - Aceptación: todas las acciones del MVP se pueden realizar solo con teclado.
  - Verificación: E2E Playwright con teclado + revisión visual a 1280×800 y 1920×1080.
  - Estado: atajos Ctrl+1…5, hover y foco visible en la navegación; faltan columnas lista+detalle, Ctrl+K, Esc y menú contextual.
- [x] F02-013 — Componentes sociales: `Avatar`, `AvatarStack`, `LeaderboardRow`, `ParticipantChip`. `P0` `S` `MVP`
  - Verificación (2026-11-17): `Avatar`, `AvatarStack`, `LeaderboardRow` (usado en la clasificación), `ParticipantChip`.
- [x] F02-014 — Animaciones base (150–350 ms) con `useReducedMotion`: completar, entrada de lista, cambio de pestaña, progreso. `P0` `S` `MVP`
  - Verificación (2026-11-17): Progreso animado, pulso al completar, entrada escalonada de listas y transición de pantallas; todo desactivado con movimiento reducido.
- [x] F02-015 — Catálogo de componentes (ruta de desarrollo `/dev/catalogo`, solo en `__DEV__`). `P1` `S` `MVP`
  - Verificación (2026-11-17): `/dev/catalogo` (redirige fuera de `__DEV__`).
  - Aceptación: muestra todos los componentes en sus estados; no accesible en producción.
- [x] F02-016 — Tests de componentes (roles, etiquetas, estados deshabilitados). `P0` `S` `MVP`
  - Verificación (2026-11-17): `src/components/components.test.tsx` (roles, etiquetas, estados deshabilitados, acciones de accesibilidad).
- [x] F02-017 — Revisión visual del sistema (capturas a 390 px —Android— y a 1280 px —escritorio—). `P0` `S` `MVP`
  - Verificación (2026-11-17): 92 capturas a 390, 1280 y 1920 px en `docs/screenshots/` (`npm run e2e:shots`); corregido el título partido en cabeceras estrechas.
- [x] F02-018 — Pantalla splash e icono de app con la identidad. `P1` `S` `MVP`
  - Verificación (2026-11-17): Icono y splash originales (destello con órbita) generados desde `assets/src/mark.svg`.
- [x] F02-020 — Redactar `docs/DISENO_UI_UX.md` con las 40 pantallas. `P0` `M` `MVP`

### FASE 03 — Autenticación, onboarding y perfiles

- [x] F03-001 — Registro con email/contraseña (validación zod, política de contraseña, errores comprensibles). `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Cuentas QA confirmadas; registro validado en E2E; entrada real en escritorio (E2E) y en el Xiaomi.
  - Aceptación: crea un usuario real en Supabase y su fila `profiles`.
  - Verificación: test de integración contra Supabase (requiere credenciales) + test de formulario.
  - Estado: pantalla, validación (zod) y llamada real a Supabase hechas; registro con nombre, @usuario (comprobación en vivo vía RPC `is_handle_available`) y zona horaria. Falta verificar con una cuenta real en el móvil.
- [x] F03-002 — Inicio y cierre de sesión; sesión persistente y renovación automática; manejo de sesión expirada. `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Entrada, cierre de sesión y persistencia tras recargar verificados en escritorio (E2E) y Android; sesión caducada con aviso.
  - Estado: entrar, cerrar sesión (Perfil), sesión persistente cifrada y renovación automática. Falta verificación en dispositivo.
- [-] F03-003 — Recuperación de contraseña (email + pantalla de nueva contraseña vía deep link). `P0` `M` `MVP`
  - Estado: solicitud con mensaje neutro, enlace PKCE `nebula://auth/callback?next=recovery`, pantalla de nueva contraseña forzada. Pendiente: añadir `nebula://**` a Redirect URLs de Supabase (propietario) y registrar el protocolo `nebula://` en Electron.
- [-] F03-004 — Verificación de email (pantalla de «revisa tu correo», reenvío). `P1` `S` `MVP`
- [-] F03-005 — OAuth (Google/Apple) preparado; activo solo si el proveedor está configurado. `P2` `M` `AVZ`
  - Aceptación: si no está configurado, el botón no se muestra (no hay botones muertos).
  - Estado (2026-11-16): Google implementado para Android (Custom Tabs + `nebula://auth/callback`, PKCE) y escritorio (navegador del sistema + retorno loopback `http://127.0.0.1:47913/auth/callback`, RFC 8252; verificado: rechaza URLs ajenas a Supabase, responde y se cierra). El botón solo aparece si `external.google` está activo en `/auth/v1/settings`. Alta: el trigger toma `full_name`/`name` (migración `0006`, test); el onboarding añade el paso «@usuario» si es provisional. **Pendiente:** credenciales OAuth de Google configuradas en Supabase por el propietario y prueba real en ambos sistemas.
- [x] F03-006 — Bienvenida (presentación visual + propósito) — pantallas 1–2 del onboarding. `P0` `S` `MVP`
  - Verificación (2026-11-17): Bienvenida verificada en capturas y E2E (`auth.spec.ts`).
- [x] F03-007 — Onboarding: áreas de interés, objetivos iniciales, estilo motivacional, recordatorios opcionales, primer hábito o meta. Todos omitibles salvo el nombre. `P0` `L` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Onboarding real de 5 pasos recorrido por la E2E con cuentas nuevas hasta llegar a Hoy.
  - Aceptación: ≤ 8 pantallas; al terminar, se guardan preferencias y (si se eligió) el primer hábito; se llega a Hoy.
  - Estado: 5 pasos (intereses, objetivos, intensidad con frase de ejemplo, días y franjas, privacidad), todos omitibles; guarda en `user_preferences`/`profiles`. Los pasos «primer hábito/meta» y «recordatorios» se añaden en F04/F05 y F09, cuando existan esas entidades.
- [-] F03-008 — Personalización: nombre visible, avatar (subida a Storage con RLS), zona horaria (detectada y editable), días activos, horas de concentración, notificaciones, tono, privacidad. `P0` `M` `MVP`
- [-] F03-009 — Handle público único (`@usuario`) para búsqueda social; el email nunca es público. `P0` `S` `MVP`
- [-] F03-010 — Pantalla de Perfil y Configuración editable (todas las opciones de F03-008). `P0` `M` `MVP`
- [-] F03-011 — Eliminación de cuenta (Edge Function con service role, confirmación doble, borrado en cascada). `P0` `M` `MVP`
  - Aceptación: tras borrar, no queda ninguna fila del usuario; los retos compartidos conservan resultados anonimizados.
  - Verificación: test SQL de cascada + prueba manual.
- [-] F03-012 — Exportación de datos personales (JSON). `P2` `S` `AVZ`
- [x] F03-013 — Tests: formularios, guardas de navegación, RLS de perfiles/preferencias. `P0` `S` `MVP`
  - Verificación (2026-11-17): Validación, guardas, OAuth, sesión caducada (`session.test.ts`) y RLS de perfiles/preferencias en verde.

### FASE 04 — Gestión completa de hábitos

- [x] F04-001 — Esquema: `habits`, `habit_targets` (versionado con `valid_from`), `habit_logs`, `habit_schedules`; restricciones e índices; RLS. `P0` `M` `MVP`
  - Aceptación: cambiar el objetivo crea una nueva versión; los periodos pasados se evalúan con la versión vigente entonces.
  - Verificación: test SQL + test de dominio.
- [x] F04-002 — Dominio: evaluación de periodo para los 7 tipos (binario, duración, cantidad, frecuencia, acumulativo, reducción, flexible). `P0` `L` `MVP`
  - Aceptación: tabla de casos en `REGLAS_NEGOCIO.md` cubierta por tests.
- [x] F04-003 — Dominio: constancia (% de periodos cumplidos), racha actual/mejor sin falsificar; días de pausa excluidos. `P0` `M` `MVP`
- [x] F04-004 — Crear/editar hábito: nombre, descripción, categoría, icono, color, tipo, frecuencia, objetivo, unidad, inicio, días, horario sugerido, prioridad, recordatorios, meta asociada, privacidad. `P0` `L` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Creación verificada con cuenta real; ahora atómica (RPC `create_habit`, migración `20261118000700`).
- [-] F04-005 — Lista de hábitos (hoy / todos / pausados / archivados), orden manual. `P0` `M` `MVP`
- [x] F04-006 — Registro rápido desde la lista y desde Hoy (un toque binario; +/− o entrada numérica para cantidades). `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Marcar/desmarcar desde Hoy verificado en el Xiaomi y en E2E.
- [x] F04-007 — Deshacer (toast 5 s) y edición de registros anteriores con nota. `P0` `S` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): «Deshacer» del aviso verificado en el Xiaomi.
- [-] F04-008 — Detalle de hábito: progreso del periodo, calendario de consistencia, historial de registros, notas. `P0` `M` `MVP`
- [x] F04-009 — Estadísticas de hábito: tendencia, comparación de periodos, mejor franja horaria. `P1` `M` `MVP`
- [-] F04-010 — Pausar (con rango de fechas) y reanudar. `P0` `S` `MVP`
- [-] F04-011 — Archivar y recuperar. `P0` `S` `MVP`
- [-] F04-012 — Eliminar hábito (confirmación; borra registros). `P0` `S` `MVP`
- [-] F04-013 — Registros con origen (`manual`, `timer`, `integration`) y zona horaria del registro. `P0` `S` `MVP`
- [x] F04-014 — Cola offline de registros (idempotencia por `client_id`). `P1` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Xiaomi sin servidor: el registro queda «1 pendientes»; al volver la conexión se sincroniza y consta en la BD.
- [-] F04-015 — Animación de completado y actualización de progreso. `P0` `S` `MVP`
- [x] F04-016 — Tests de dominio (todos los tipos, cambios de objetivo, pausas, DST). `P0` `M` `MVP`
- [x] F04-017 — Tests RLS de hábitos y registros. `P0` `S` `MVP`
- [x] F04-018 — Dominio: detección de interrupción y propuesta de reinicio (objetivo mínimo). `P0` `S` `MVP`
- [-] F04-019 — UI de modo recuperación en Hoy y en el detalle. `P0` `S` `MVP`
- [x] F04-020 — Dominio: recomendaciones adaptativas (horario, duración, frecuencia, días, división, mínimo) con umbral de datos. `P2` `M` `AVZ`
  - Verificación (2026-11-17): `src/domain/habits/adaptive.ts`: objetivo realista, frecuencia, días, horario, división y mínimo, con umbral de 14/6 periodos; 7 tests.
- [x] F04-021 — UI de recomendaciones con vista previa y aplicar/descartar. `P2` `S` `AVZ`
  - Verificación (2026-11-17): Tarjeta en el detalle con vista previa, aplicar (versión de objetivo desde hoy) y descartar persistente; tests de aplicación.

### FASE 05 — Tareas, metas, proyectos y dependencias

- [x] F05-001 — Esquema: `tasks`, `subtasks`, `tags`, `task_tags`, recurrencia (RRULE simplificada); RLS. `P0` `M` `MVP`
- [x] F05-002 — Crear/editar/eliminar tareas (prioridad, fecha límite, duración estimada, notas, estado, etiquetas). `P0` `M` `MVP`
- [x] F05-003 — Subtareas con progreso. `P0` `S` `MVP`
- [x] F05-004 — Lista de tareas: pendientes/completadas, agrupación (fecha, prioridad, proyecto, etiqueta), filtros, búsqueda. `P0` `M` `MVP`
- [x] F05-005 — Reordenamiento manual (orden fraccional). `P1` `S` `MVP`
- [x] F05-006 — Tareas recurrentes (generación de la siguiente instancia al completar). `P1` `M` `MVP`
- [-] F05-007 — Recordatorios de tareas (notificación local). `P1` `S` `MVP`
- [x] F05-008 — Contador de aplazamientos (`postponed_count`) para detección de fricción. `P0` `S` `MVP`
- [x] F05-009 — Esquema: `goals`, `milestones`, `goal_links` (tareas/hábitos), `goal_progress_events`; indicador medible. `P0` `M` `MVP`
- [x] F05-010 — Metas: lista, crear, detalle (progreso acumulado, hitos, vinculados, historial, estado, visibilidad). `P0` `L` `MVP`
- [x] F05-011 — Proyectos con etapas y dependencias (`dependencies` con restricción anti-ciclo en servidor). `P0` `M` `MVP`
  - Aceptación: insertar una dependencia que crea un ciclo es rechazado por la BD.
  - Verificación: test SQL.
- [x] F05-012 — Dominio: orden topológico, elementos bloqueados y bloqueantes, ruta crítica. `P0` `S` `MVP`
- [x] F05-013 — Vista gráfica de dependencias (grafo por niveles) con resaltado de bloqueos. `P1` `M` `MVP`
- [x] F05-014 — Señalar en Hoy qué tarea desbloquea más trabajo. `P1` `S` `MVP`
- [x] F05-015 — Tests de dominio y RLS de tareas/metas/dependencias. `P0` `S` `MVP`
- [x] F05-016 — Dominio: simulador (cálculo determinista + escenarios conservador/medio/exigente; estimación estadística solo con historial suficiente y etiquetada como tal). `P2` `M` `AVZ`
- [x] F05-017 — Pantalla del simulador. `P2` `M` `AVZ`

### FASE 06 — Agenda, planificación y sesiones de concentración

- [x] F06-001 — Esquema: `calendar_events` (UTC + zona), recurrencia, categorías, `availability` (franjas disponibles por día). `P0` `M` `MVP`
- [x] F06-002 — Vista diaria con línea temporal y bloques (eventos, tareas con hora, hábitos con horario sugerido). `P0` `L` `MVP`
- [-] F06-003 — Vista semanal. `P0` `M` `MVP`
- [-] F06-004 — Vista mensual con indicadores de pendientes. `P1` `M` `MVP`
- [-] F06-005 — Crear/editar/eliminar evento; actividades recurrentes; recordatorios. `P0` `M` `MVP`
- [x] F06-006 — Filtros por categoría. `P1` `S` `MVP`
- [x] F06-007 — Programar una tarea en un bloque (time-blocking). `P1` `M` `MVP`
- [x] F06-010 — Dominio: detección de conflictos y huecos libres. `P0` `S` `MVP`
- [x] F06-011 — Dominio: planificador determinista (prioridad, fecha límite, duración, disponibilidad, descansos, dependencias, preferencias). `P1` `L` `MVP`
- [x] F06-012 — Pantalla de planificación diaria (propuesta → aceptar/ajustar). `P1` `M` `MVP`
- [x] F06-013 — Negociación de conflictos: al crear algo que choca, ofrecer mover/dividir/mantener; nunca reprogramar sin confirmación. `P1` `M` `MVP`
- [x] F06-014 — Detección de sobrecarga (estimado vs. disponible por día/semana). `P1` `S` `MVP`
- [x] F06-015 — Día viable (Completo / Esencial / Recuperación) sin eliminar compromisos. `P1` `M` `MVP`
- [x] F06-016 — Esquema `focus_sessions` (planificada, real, pausas, fin anticipado, vínculo). `P0` `S` `MVP`
- [x] F06-017 — Temporizador (Pomodoro, libre, largo, descansos) basado en marcas de tiempo; pausar/continuar/terminar. `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Xiaomi: 2 min → 01:59 a los 2,7 s y 01:48 a los 13,4 s; la sesión se recupera al volver.
  - Aceptación: al volver de segundo plano (Android) o al restaurar una ventana minimizada (escritorio) el tiempo restante es correcto; al cerrar la app se recupera la sesión activa.
  - Verificación: tests con relojes simulados.
- [x] F06-018 — Notificación al terminar el bloque (programada en Android; desde el proceso principal de Electron en escritorio, que sigue activo minimizado en la bandeja). `P0` `S` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Xiaomi con la app en segundo plano: llega «Bloque de enfoque terminado». Android la entrega con hasta ~45 s de retraso (alarma inexacta).
- [x] F06-019 — Asociar sesión a hábito/tarea y registrar automáticamente (origen `timer`). `P0` `S` `MVP`
- [x] F06-020 — Historial de sesiones. `P0` `S` `MVP`
- [x] F06-021 — Tests de dominio (conflictos, planificador, temporizador, zonas horarias). `P0` `M` `MVP`

### FASE 07 — Estadísticas, analíticas e historial

- [x] F07-001 — Funciones SQL/consultas agregadas (cumplimiento, foco, tareas completadas) por rango y zona. `P0` `M` `MVP`
- [x] F07-002 — Panel de estadísticas: % de cumplimiento, tiempo de foco, actividades terminadas, progreso de metas. `P0` `M` `MVP`
- [x] F07-003 — Evolución semanal/mensual y comparación con el periodo anterior. `P0` `M` `MVP`
- [x] F07-004 — Mapa de consistencia anual. `P1` `S` `MVP`
- [x] F07-005 — Distribución por categoría. `P1` `S` `MVP`
- [x] F07-006 — Estados vacíos honestos («necesitas X días de registros para ver esta tendencia»). `P0` `S` `MVP`
- [x] F07-010 — Perfil de productividad: horarios efectivos, hábitos constantes, más aplazadas, tiempo en prioridades, objetivos completados, resultados de retos. `P2` `M` `AVZ`
- [x] F07-012 — Radar de distracciones: registro voluntario (tipo, momento, duración, actividad, nota) durante o tras una sesión. `P1` `S` `MVP`
- [x] F07-013 — Patrones del radar con umbral mínimo de datos y lenguaje de estimación. `P2` `M` `AVZ`
- [x] F07-014 — Revisión de compromisos semanal (prometido / completado / reprogramado / abandonado / pendiente). `P2` `M` `AVZ`
- [x] F07-015 — Tests de agregaciones y de umbrales. `P0` `S` `MVP`

### FASE 08 — Amistades, retos, competencias y objetivos colaborativos

- [x] F08-001 — Esquema: `friend_requests`, `friendships` (par ordenado único), `blocks`; RLS. `P0` `M` `MVP`
- [x] F08-002 — Búsqueda por handle/nombre (excluye bloqueados, nunca expone email). `P0` `S` `MVP`
- [x] F08-003 — Enviar, aceptar, rechazar, cancelar solicitudes; eliminar amistad; bloquear/desbloquear. `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Solicitud por @usuario, aceptación y botón «Retar» verificados entre dos cuentas reales (E2E).
- [x] F08-004 — Perfil público autorizado según visibilidad (`private`, `friends`, `public`) por elemento. `P0` `M` `MVP`
- [-] F08-005 — Pantallas Amigos y Solicitudes. `P0` `M` `MVP`
- [x] F08-006 — Tests RLS: un no-amigo no ve datos `friends`; un bloqueado no puede enviar solicitudes. `P0` `S` `MVP`
- [-] F08-008 — Círculos: crear, editar, invitar, roles (propietario/admin/miembro), salir, historial. `P1` `M` `MVP`
- [x] F08-010 — Esquema de retos: `challenges` (tipo, métrica, unidad, inicio/fin con zona, reglas, condición de victoria, desempate, estado), `challenge_participants` (objetivo personal bloqueado, aceptación), `challenge_entries` (puntuables, origen), `challenge_results`. `P0` `L` `MVP`
- [x] F08-011 — Máquina de estados de reto (borrador → invitado → activo → cerrando → finalizado / cancelado) en servidor. `P0` `M` `MVP`
- [-] F08-012 — Objetivo cooperativo: modalidad colectiva y distribuida; invitaciones; aceptación. `P0` `M` `MVP`
- [-] F08-013 — Contribuciones desde registros de hábitos/sesiones vinculados (no edición directa de progreso). `P0` `M` `MVP`
- [-] F08-014 — Vista cooperativa (maqueta PDF «En equipo»: total, barra, contribución por persona). `P0` `M` `MVP`
- [-] F08-015 — Cierre del objetivo cooperativo (alcanzado / expirado). `P0` `S` `MVP`
- [x] F08-016 — Competencia 1 vs. 1: crear, invitar, aceptar condiciones, rechazar. `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Duelo creado por A, aceptado por B con su objetivo; arranca al momento (corregido en `20261118000800`).
- [-] F08-017 — Competencias grupales (modalidades: % de cumplimiento, constancia, sesiones válidas, progreso relativo, cantidad con unidad común). `P0` `L` `MVP`
- [x] F08-018 — Función SQL `challenge_standings()` autoritativa (posición, progreso, diferencia con el siguiente, tiempo restante). `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Clasificación real: A 30/60 min = 50 % (1.º), B 0/45 = 0 % (2.º), igual al cálculo manual.
- [x] F08-019 — Pantalla de clasificación (maqueta PDF «Competencia», nota explicativa de la métrica). `P0` `M` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Clasificación visible para ambos participantes en escritorio (E2E).
- [x] F08-020 — Retos equilibrados: objetivos personales fijados antes del inicio y bloqueados; % con tope configurable (por defecto 100 %); desempate definido. `P0` `M` `MVP`
- [x] F08-021 — Cierre automático y resultados (Edge Function programada / `pg_cron`), con tolerancia de registro tardío. `P0` `M` `MVP`
- [-] F08-022 — Pantalla de resultados e historial de retos. `P0` `S` `MVP`
- [x] F08-023 — Integridad: duplicados (idempotencia), retroactivos (ventana de gracia), fuera de plazo, límites de plausibilidad por unidad, concurrencia (transacciones), abandono e inactividad. `P0` `L` `MVP`
- [-] F08-024 — Distinción visual autodeclarado vs. temporizador; nunca «verificado externamente» sin prueba. `P0` `S` `MVP`
- [-] F08-025 — Equipos enfrentados (equipos, invitaciones, progreso colectivo, clasificación). `P2` `L` `AVZ`
- [-] F08-026 — Clasificaciones avanzadas (histórico entre amigos, filtros). `P2` `M` `AVZ`
- [-] F08-027 — Pactos de responsabilidad (objetivo, duración, reglas, revisiones, confirmación mutua, acción de apoyo, celebración). `P1` `M` `MVP`
- [-] F08-028 — Realtime para clasificaciones y cooperativos. `P1` `S` `MVP`
- [x] F08-029 — Tests SQL de puntuación, desempates, cierre y «no puedo modificar el progreso ajeno». `P0` `M` `MVP`

### FASE 09 — Motivación contextual y notificaciones

- [x] F09-001 — Biblioteca ≥ 80 mensajes originales en 12 categorías × 3 intensidades, con metadatos (categoría, intensidad, variables). `P0` `M` `MVP`
  - Aceptación: ≥ 80 mensajes; ninguno humilla, amenaza o culpa por descansar (lista de revisión en REGLAS_NEGOCIO).
  - Verificación: test que cuenta y valida estructura + revisión editorial.
- [x] F09-002 — Motor contextual: selecciona por evento real (sesión pendiente, tarea aplazada, meta cerca del plazo, reto por terminar, buena semana, interrupción) y evita repeticiones recientes. `P0` `M` `MVP`
  - Aceptación: nunca inserta datos no presentes en el contexto.
- [x] F09-003 — Mensaje en el panel Hoy y antes de una sesión de enfoque. `P0` `S` `MVP`
- [x] F09-004 — Intensidad configurable (Equilibrado/Exigente/Intenso, este último con confirmación). `P0` `S` `MVP`
- [x] F09-005 — Permisos de notificación con explicación previa; estado «sin permisos». `P0` `S` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): Tarjeta explicativa en Hoy y petición al empezar un enfoque; verificado en el Xiaomi (Android 16) hasta conceder el permiso.
- [-] F09-006 — Recordatorios locales de hábitos, tareas y eventos (programación y reprogramación al editar). Android: `expo-notifications` con canales. Escritorio: planificador en el proceso principal de Electron + `Notification` nativa (centro de notificaciones de Windows / libnotify en Linux); opción «iniciar con el sistema» y «minimizar a la bandeja» para que los recordatorios lleguen con la ventana cerrada. `P0` `M` `MVP`
- [-] F09-007 — Preferencias por tipo, horas de silencio y tope diario. `P0` `S` `MVP`
- [x] F09-008 — Tabla `notifications` + centro de notificaciones (leídas/no leídas, acciones). `P0` `M` `MVP`
- [!] F09-009 — Push social (invitaciones, inicio/fin de retos, cooperativos) vía Edge Function + Expo Push. `P1` `M` `MVP`
  - Verificación (2026-11-17): Con la app abierta (también minimizada en la bandeja) las notificaciones sociales se muestran como aviso del sistema vía Realtime, respetando preferencias y silencio. **Push con la app cerrada bloqueado: requiere proyecto EAS y credenciales FCM (B-04).**
- [x] F09-010 — Resumen semanal (no IA): datos reales de la semana. `P1` `S` `MVP`
  - Verificación (2026-11-17): Resumen semanal con datos reales frente a la semana anterior en la pantalla Revisión, a la que lleva la notificación semanal.
- [x] F09-011 — Tests del motor (selección, no repetición, horas de silencio). `P0` `S` `MVP`
  - Verificación (2026-11-17): `schedule.test.ts` (silencio, tope, tipos) y `motivation.test.ts` (selección, intensidad, no repetición).
- [!] F09-012 — **Hito H5: verificación de los 18 criterios del MVP (§17).** `P0` `M` `MVP`
  - Verificación (2026-11-17): **Bloqueado por B-07** (verificación con dos cuentas reales). Lo verificable sin cuentas está en verde.

### FASE 10 — Inteligencia artificial, planificación adaptable y automatizaciones

- [x] F10-001 — Redactar `docs/INTEGRACION_IA.md`. `P0` `S` `AVZ`
- [!] F10-002 — Edge Function `ai-assist` con interfaz de proveedor intercambiable; claves solo en servidor; límite de uso. `P0` `M` `AVZ`
  - Verificación (2026-11-17): Implementada y probada con proveedor simulado; **despliegue bloqueado por B-01**.
- [-] F10-003 — Esquema de acciones estructuradas (zod): crear hábito/tarea/meta/sesión/reto, dividir meta, mover bloques, estimar, priorizar. `P0` `M` `AVZ`
- [-] F10-004 — Captura universal: parser determinista en español (fechas relativas, horas, duraciones, frecuencias) + IA opcional; vista previa editable. `P1` `L` `MVP`
- [-] F10-005 — Pantalla del asistente: conversación + tarjetas de acción con vista previa y aplicar/descartar. `P1` `L` `AVZ`
- [x] F10-006 — Minimización de datos (contexto resumido, sin datos de amigos sin autorización). `P0` `S` `AVZ`
- [-] F10-007 — Interruptor global de IA y explicación de datos analizados. `P0` `S` `AVZ`
- [-] F10-008 — Replanificación con IA sobre el planificador determinista (la IA propone, las reglas validan). `P2` `M` `AVZ`
- [x] F10-009 — Funcionamiento degradado si el proveedor no está disponible. `P0` `S` `AVZ`
- [-] F10-010 — Sobrecarga con alternativas (aplazar, dividir, reducir). `P1` `S` `AVZ`
- [-] F10-011 — Detección de fricción (aplazamientos, abandonos) con sugerencias. `P2` `M` `AVZ`
- [-] F10-012 — Pérdida de constancia: heurística explicada (no «modelo predictivo»), umbral de datos. `P2` `M` `AVZ`
- [-] F10-013 — Resumen semanal inteligente (datos reales + redacción IA opcional). `P2` `M` `AVZ`
- [x] F10-014 — Tests: parser, validación de acciones, función con proveedor simulado. `P0` `M` `AVZ`
- [x] F10-015 — Prueba con proveedor real. **Clave Groq configurada localmente; prueba real bloqueada por la red restringida y el despliegue de Edge Functions pendiente.** `P1` `S` `AVZ`
  - Verificación (2026-11-17): 2026-11-17: `node scripts/test-groq.mjs` → respuesta real de Groq con acciones válidas (sin aplicar). El secreto en el servidor depende de B-01.

### FASE 11 — Funcionalidades avanzadas, integraciones y personalización

- [-] F11-001 — Captura por voz con confirmación. Android: reconocimiento del SO (evaluar `expo-speech-recognition`). Escritorio: Electron no incluye el servicio de dictado de Chrome; requiere transcripción en servidor (Edge Function + proveedor STT) o reconocimiento local; si no está configurado, el botón de micrófono no se muestra. `P2` `M` `AVZ`
- [-] F11-002 — Diario de productividad (reflexiones, dificultades, aprendizajes, logros, vínculos). `P2` `M` `AVZ`
- [x] F11-003 — Diario inteligente: patrones con consentimiento. `P3` `M` `AVZ`
  - Verificación (2026-11-17): Patrones locales con consentimiento explícito (`src/domain/journal/patterns.ts`), mínimo de 6 reflexiones y lenguaje de asociación.
- [-] F11-004 — Mapa de progreso tipo constelación (metas ↔ hábitos ↔ tareas ↔ dependencias), legible y accesible (vista lista alternativa). `P2` `L` `AVZ`
- [-] F11-005 — Salas de enfoque compartidas (Realtime presence, inicio sincronizado, privacidad). `P2` `L` `AVZ`
- [-] F11-006 — Revisión semanal guiada (día configurable). `P2` `M` `AVZ`
- [-] F11-007 — Calendarios externos: Android con `expo-calendar` (lectura con permiso); escritorio mediante importación/suscripción ICS o OAuth de Google/Microsoft (requiere credenciales). `P2` `M` `AVZ`
- [x] F11-008 — Accesos rápidos: atajos del icono en Android (`expo-quick-actions`); en escritorio, menú de la bandeja (iniciar enfoque, captura rápida) y atajo global configurable; deep links `nebula://` en ambas. `P3` `S` `AVZ`
  - Verificación (2026-11-17): Atajos de Android; en escritorio bandeja, atajo global configurable y enlaces `nebula://` validados (`links.test.cjs`).
- [-] F11-009 — Widget de Android (pantalla de inicio): widget «Hoy» con los hábitos del día, avance, racha y marcado con un toque (binarios y de frecuencia) por la cola duradera, también sin conexión; el día se recalcula en el widget con las reglas de la app (`src/domain/widget`). En escritorio no hay widgets equivalentes: se sustituye por la mini-ventana de enfoque «siempre visible». `P3` `L` `AVZ`
  - Verificación (2026-11-17): Escritorio hecho: mini-ventana de enfoque siempre visible (bandeja/botón «Mini-ventana»). **Pendiente: widget de Android** (módulo nativo + recompilación y dispositivo).
- [-] F11-010 — Arquitectura de integraciones (`integrations` + adaptadores), sin simular sincronizaciones. `P2` `M` `AVZ`
- [-] F11-011 — Personalización: semana inicia lunes/domingo, formato de hora, acento violeta alternativo dentro de la paleta. `P3` `S` `AVZ`
- [x] F11-012 — Sugerencias de horario por rendimiento (martes por la noche, PDF §2.02). `P2` `M` `AVZ`
  - Verificación (2026-11-17): Recomendación de franja horaria y combinación día+franja («martes por la noche») con umbral de 10 registros.

### FASE 12 — Optimización visual, accesibilidad, seguridad y pruebas integrales

- [x] F12-001 — Auditoría visual de las 40 pantallas (capturas, coherencia, espaciado). `P0` `M` `MVP`
  - Verificación (2026-11-17): Capturas de las 28 pantallas + 4 de acceso revisadas en hojas de contacto; correcciones aplicadas.
- [x] F12-002 — Auditoría de accesibilidad (lector de pantalla, escala de fuente 200 %, contraste, objetivos táctiles). `P0` `M` `MVP`
  - Verificación (2026-11-17): axe WCAG 2.1 A/AA sin infracciones serias ni críticas en 32 rutas (`e2e/a11y.spec.ts`, `auth.spec.ts`); teclado verificado. Falta la prueba con TalkBack en el dispositivo.
- [x] F12-003 — Rendimiento: perfilado de listas, memoización, tamaño de bundle, arranque. `P1` `M` `MVP`
  - Verificación (2026-11-17): Bundle común 4,1 → 2,0 MB (651 → 435 KB gzip) importando cada icono por separado; React Compiler activo; esqueletos en listas.
- [x] F12-004 — Revisión de seguridad: RLS de todas las tablas, funciones `security definer` con `search_path`, validación de entradas, secretos. `P0` `M` `MVP`
  - Verificación (2026-11-17): Tests de RLS en todas las tablas, `search_path` y permisos de PUBLIC; escaneo de secretos en el build (`scripts/scan-bundle.cjs`); Metro bloquea `.env.server.*` y `supabase/`.
- [x] F12-005 — Pruebas offline / conexión lenta / sesión expirada. `P0` `S` `MVP`
  - Verificación (2026-11-17): `e2e/resilience.spec.ts` (sesión caducada, sin conexión, conexión lenta sin doble envío) + aviso «tu sesión ha caducado»; cola offline probada.
- [x] F12-006 — E2E Playwright (web): registro → hábito → registro → estadística; tarea → meta; reto 1 vs. 1 con dos cuentas. `P0` `L` `MVP`
  - Verificación (2026-11-17, cuentas reales/Xiaomi): `e2e/flows.spec.ts` en verde con dos cuentas reales: hábito → registro → recarga → estadística; tarea y meta; amistad + duelo + clasificación.
  - Verificación (2026-11-17): Suite `e2e/flows.spec.ts` lista (hábito→registro→estadística, tarea→meta, 1 vs. 1); se omite sin `E2E_EMAIL_*`. **Pendiente de B-07.**
- [!] F12-007 — E2E en Android con Maestro (dispositivo Xiaomi Android 16 disponible por adb; SDK instalado). `P1` `M` `MVP`
  - Verificación (2026-11-17): **Bloqueado: el Xiaomi no está conectado por adb en esta sesión y Maestro no está instalado (B-03).**
- [x] F12-008 — E2E de escritorio con Playwright (`_electron`) sobre el build empaquetado en Linux. `P1` `M` `MVP`
  - Verificación (2026-11-17): Sonda Electron sobre el AppImage empaquetado (puente, aislamiento, mini-ventana, ajustes). Método: proceso principal instrumentado en lugar de `_electron`.
- [!] F12-009 — Prueba manual del instalador de Windows. **Bloqueada: no hay máquina Windows en este entorno; se cubre con CI y prueba manual del propietario.** `P1` `S` `MVP`

### FASE 13 — Preparación para producción, documentación y lanzamiento

- [-] F13-001 — Entornos (dev/staging/prod) y gestión de variables. `P0` `S` `MVP`
- [x] F13-002 — CI (typecheck, lint, test, test:db) + matriz de empaquetado de escritorio (`ubuntu-latest` → AppImage/.deb, `windows-latest` → instalador NSIS). `P0` `S` `MVP`
  - Verificación (2026-11-17): `quality.yml` con trabajo E2E (Playwright + axe) y `release.yml` con matriz Linux/Windows.
- [!] F13-008 — Actualizaciones automáticas de escritorio (electron-updater) y firma de código en Windows (requiere certificado; sin él, SmartScreen advierte). `P2` `M` `AVZ`
  - Verificación (2026-11-17): **Bloqueado: requiere servidor de publicación de versiones y certificado de firma de Windows.**
- [-] F13-003 — Proyecto Supabase remoto y despliegue de migraciones/funciones. Migraciones: `npm run db:push` (Supabase CLI vía pooler IPv4; la red local no tiene IPv6). Funciones: pendientes. `P0` `S` `MVP`
- [x] F13-004 — Build de Android firmado (APK/AAB) con EAS o Gradle local. Gradle local con clave propia desde 1.2.4 (`plugins/withReleaseSigning.js`, `docs/FIRMA_ANDROID.md`). `P1` `M` `MVP`
- [x] F13-005 — Documentación final (README, todos los `docs/`). `P0` `S` `MVP`
  - Verificación (2026-11-17): README, `docs/PRUEBAS.md` y este plan actualizados.
- [x] F13-006 — Política de privacidad y textos legales (borrador para revisión humana). `P1` `S` `MVP`
- [-] F13-007 — Lista de lanzamiento (iconos, capturas de tienda, metadatos). `P2` `S` `AVZ`

## 10. Prioridades y complejidad estimada

| Fase | Tareas | P0 | Complejidad global |
|---|---|---|---|
| F00 | 6 | 5 | S |
| F01 | 15 | 15 | M |
| F02 | 19 | 16 | L |
| F03 | 13 | 9 | L |
| F04 | 21 | 16 | XL |
| F05 | 17 | 10 | XL |
| F06 | 19 | 10 | XL |
| F07 | 11 | 5 | L |
| F08 | 27 | 21 | XL |
| F09 | 12 | 9 | L |
| F10 | 15 | 7 | XL |
| F11 | 12 | 0 | XL |
| F12 | 7 | 4 | L |
| F13 | 7 | 4 | M |

(Recuento orientativo al crear el plan; el estado real se calcula desde las casillas, §15.)

## 11. Criterios de aceptación verificables (por fase)

- **F01:** `npm run typecheck && npm run lint && npm test && npm run test:db` en verde; la app arranca en web y muestra las 5 pestañas tras las guardas.
- **F02:** test de contraste de tokens en verde; catálogo de componentes revisado en capturas a 375 px; todos los botones con estados.
- **F03:** con un proyecto Supabase configurado, un usuario se registra, cierra sesión, vuelve a entrar y ve sus preferencias.
- **F04:** los 7 tipos se evalúan según `REGLAS_NEGOCIO.md` (tests); cambiar un objetivo no altera periodos pasados; deshacer funciona.
- **F05:** la BD rechaza ciclos; la vista de proyecto muestra bloqueos correctos.
- **F06:** ninguna planificación automática genera solapamientos (tests); el temporizador es correcto tras segundo plano.
- **F07:** cada cifra mostrada se puede reconstruir con una consulta sobre registros reales.
- **F08:** dos cuentas reales completan un reto 1 vs. 1 y uno grupal; la clasificación coincide con el cálculo manual; un usuario no puede escribir progreso ajeno (test RLS).
- **F09:** ≥ 80 mensajes; las horas de silencio se respetan (tests).
- **F10:** ninguna acción de IA se aplica sin confirmación; la app funciona con la IA desactivada.
- **F12–F13:** auditorías documentadas; E2E en verde.

## 12. Estrategia de pruebas

Resumen (detalle en `docs/PRUEBAS.md`):

1. **Dominio (Jest):** funciones puras con tablas de casos; zonas horarias y DST.
2. **Componentes (Testing Library):** roles, etiquetas, estados, interacción.
3. **Base de datos (PGlite):** migraciones reales, restricciones, triggers, funciones de puntuación y RLS actuando como distintos usuarios.
4. **Integración:** repositorios contra Supabase real cuando haya credenciales (`SUPABASE_TEST_URL`), si no se omiten y se informa.
5. **E2E (Playwright sobre web):** flujos del MVP.
6. **Estáticas:** `tsc --noEmit`, ESLint.
7. **Visual:** capturas en web de cada pantalla nueva, revisadas en cada fase.

Regla: una tarea no se marca `[x]` sin su verificación ejecutada.

## 13. Riesgos técnicos

| ID | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-01 | Sin Docker ni credenciales Supabase: no se puede ejecutar Auth/Realtime reales | Alto | PGlite para SQL/RLS; cliente preparado; tareas dependientes marcadas `[!]` con explicación |
| R-02 | SDK de Expo muy reciente: incompatibilidades de librerías | Medio | `npx expo install`, `expo-doctor`, dependencias mínimas |
| R-03 | Temporizador en segundo plano (el SO suspende JS) | Medio | Cálculo por marcas de tiempo + notificación programada |
| R-04 | Zonas horarias en retos entre países | Alto | Periodos del reto en zona del reto; registros con instante UTC; tests DST |
| R-05 | Manipulación de registros en competencias | Alto | Puntuación en servidor, ventanas de gracia, límites de plausibilidad, origen del registro |
| R-06 | Alcance muy amplio | Alto | Hitos MVP/AVZ; tareas `XL` divididas |
| R-07 | Coste/latencia/privacidad de IA | Medio | Lógica determinista primero; minimización; interruptor |
| R-08 | Rendimiento de efectos visuales | Medio | SVG estático memoizado, sin blur en listas, movimiento reducido |
| R-09 | Tono motivacional percibido como dañino | Medio | Revisión editorial, intensidad elegida por el usuario, reglas de contenido |
| R-10 | Notificaciones push sin credenciales FCM | Medio | Locales primero; push preparado y marcado como bloqueado si falta |
| R-11 | Capacidades distintas entre Android y escritorio (háptica, voz, widgets, segundo plano) | Medio | Capa `src/platform/`; alternativa documentada por capacidad; tests por plataforma |
| R-12 | Seguridad de Electron (renderer con acceso a Node) | Alto | `contextIsolation`, `sandbox`, sin `nodeIntegration`, preload con API mínima, CSP, navegación externa bloqueada |
| R-13 | Windows no verificable en este entorno | Medio | CI `windows-latest`; prueba manual del propietario (F12-009) |
| R-14 | Interfaz pensada para móvil que se ve pobre en monitor grande | Alto | F02-019: layouts de columnas, ancho máximo, densidad adecuada, revisión visual a 1280 y 1920 px |
| R-15 | Recordatorios con la app de escritorio cerrada | Medio | Bandeja + inicio con el sistema (opcional); push web no aplica en Electron |

## 14. Entregables de cada fase

| Fase | Entregables |
|---|---|
| F00 | Este plan, matriz de trazabilidad, decisiones iniciales |
| F01 | Proyecto ejecutable, `ARQUITECTURA.md`, migración base, arneses de prueba, README inicial, `.env.example` |
| F02 | Sistema de diseño, componentes, catálogo, `DISENO_UI_UX.md`, capturas |
| F03 | Auth, onboarding, perfil, configuración, borrado de cuenta |
| F04 | Módulo de hábitos completo, `REGLAS_NEGOCIO.md` (hábitos) |
| F05 | Tareas, metas, proyectos con dependencias, simulador |
| F06 | Agenda, planificador, Día viable, temporizador |
| F07 | Estadísticas, perfil de productividad, radar |
| F08 | Social completo, `REGLAS_NEGOCIO.md` (retos), `BASE_DE_DATOS.md` actualizado |
| F09 | Biblioteca de mensajes, motor, notificaciones — **MVP** |
| F10 | `INTEGRACION_IA.md`, asistente, captura universal |
| F11 | Voz, diario, constelación, salas, revisión semanal, integraciones |
| F12 | Informes de auditoría, E2E, `PRUEBAS.md` final |
| F13 | CI, builds, documentación final |

## 15. Registro del progreso

### 15.1. Estado actual

Recuento a 2026-11-17 (tarde): 145 verificadas, 56 en desarrollo, 7 bloqueadas y 0 sin empezar. Todas las tareas tienen implementación; las 56 `[-]` están hechas en código pero falta verificarlas en el dispositivo o con flujos sociales más largos (grupal, cooperativo, pactos, salas), por eso no se marcan `[x]`. No equivale a porcentaje de esfuerzo.

Recuento por número de tareas (no por esfuerzo), actualizado en cada informe.

| Fecha | Completadas | En desarrollo | Bloqueadas | Pendientes | Total |
|---|---|---|---|---|---|
| 2026-11-16 (inicio) | 6 | 5 | 5 | 193 | 209 |
| 2026-11-16 (cierre F01 parcial) | 17 | 8 | 5 | 179 | 209 |
| 2026-11-16 (F03 en curso) | 21 | 18 | 4 | 166 | 209 |
| 2026-11-16 (F04 en curso) | 27 | 31 | 3 | 148 | 209 |
| 2026-11-17 (cierre de fases) | 133 | 68 | 7 | 0 | 208 |
| 2026-11-17 (cuentas reales y Xiaomi) | 145 | 56 | 7 | 0 | 208 |


### Ampliación local del 2026-11-16

Se implementaron captura en español con confirmación; configuración editable de perfil,
privacidad y notificaciones; caché por cuenta y cola duradera de registros/deshacer;
asistente de servidor con proveedor Groq, consentimiento y contador atómico; diario privado
y revisión semanal; mapa de metas; importación de calendarios con idempotencia; salas entre
amigos con reloj de servidor y presencia privada; suscripción a cambios sociales; accesos
rápidos Android; bandeja, tamaño de ventana y endurecimiento de IPC en Electron.

Las migraciones `20261118000100`–`20261118000600` están probadas localmente y deben aplicarse
antes del cliente nuevo. Se corrigió el acceso heredado de PUBLIC en funciones privilegiadas
(con excepción explícita de la consulta pública de disponibilidad de handle). Se preserva
UTC cuando el usuario lo eligió, y las notificaciones conservan hora civil durante DST.

Groq usa la clave proporcionada por el propietario, guardada con permisos 0600 fuera de Git.
Se verificó que no aparece en código ni en el bundle. El proveedor se probó con respuestas
simuladas; la prueba con el proveedor real no pudo completarse por la red restringida.

Hay workflows de calidad y empaquetado, perfiles EAS, documentación de IA, BD, privacidad
y lanzamiento. **No se declara terminado el proyecto completo**: faltan despliegue,
validación visual/E2E en equipos reales, push social, widget y actualizaciones automáticas,
y partes avanzadas todavía identificadas en las casillas. Los cambios implementados sin
verificación integral permanecen `[-]`. La evidencia de comandos está en `docs/PRUEBAS.md`.

### 15.2. Bitácora

| Fecha | Entrada |
|---|---|
| 2026-11-20 | Widget «Hoy» de Android (`react-native-android-widget`, entrada `index.ts` que registra el manejador en segundo plano; instantánea de hábitos y registros sin tokens; el toque usa la misma cola duradera y comprueba que la sesión sea de la misma cuenta). Instalado en el Xiaomi: arranca bien; falta probar el widget colocado en la pantalla de inicio. Comodines de racha descartados por D-05. **Push con Firebase (FCM):** migración `20261122000100_push_fcm` (tokens solo por RPC, trigger `notifications_push` → pg_net → función `push-dispatch`, que firma con la cuenta de servicio, respeta preferencias y silencio y borra tokens caducados); la app registra el token, abre Notificaciones al tocar y no duplica con la app abierta. Configuración: `google-services.json` en la raíz (fuera de Git) y `node scripts/configure-push.mjs`. |
| 2026-11-17 (tarde) | Pruebas con cuentas reales y en el Xiaomi. **Fallos reales corregidos:** (1) crear un hábito eran dos peticiones; si se cortaba la segunda quedaba un hábito sin objetivo que dejaba Hoy en blanco → RPC atómica + filtro defensivo; (2) un reto que empieza hoy no arrancaba hasta la tarea horaria y podía cancelarse antes de que el invitado respondiera → se activa al responder el último y solo se cancela al acabar el día; (3) sin límite de tiempo en las peticiones, una red que no responde dejaba la app en el splash → `fetch` con 15 s; (4) Android 13+ marcaba el permiso de notificaciones como denegado antes de preguntar → se trata como «sin decidir». Google OAuth en el móvil llega hasta el consentimiento; el retorno falla por la red del teléfono (B-03). |
| 2026-11-17 | **Cierre de fases.** Migraciones `20261118000100`–`0600` aplicadas en remoto; prueba real de Groq correcta. F02 completa (componentes, catálogo, columnas lista+detalle, menú contextual, diálogos propios, animaciones con movimiento reducido, icono y splash originales). Escritorio: enlaces `nebula://`, atajo global, mini-ventana de enfoque, autoinicio en Linux, clic en notificaciones; AppImage probado empaquetado. Recomendaciones adaptativas, diario inteligente, resumen semanal real, avisos sociales en tiempo real, aviso de sesión caducada. E2E con Playwright (122 + resiliencia) y axe sin infracciones graves en 32 rutas. Bundle web −50 % (iconos por archivo). **Fallo de seguridad corregido:** en desarrollo Metro empaquetaba `.env.server.local` (clave de Groq) por vigilar `*.local`; ahora está bloqueado y hay test de regresión. Trabajo hecho en paralelo por dos sesiones de Claude, coordinado; verificación conjunta: 252 tests de app+BD, 9 de escritorio. |
| 2026-11-16 | F00: PDF analizado (`~/Downloads/Nebula.pdf`; el prompt lo llama `Nebula(1).pdf`). No existía repositorio: se crea `~/proyectos/nebula` siguiendo la convención del workspace (`proyectos/`). Entorno: Node 26.13, npm, git 2.56; sin Docker ni Supabase CLI; registro npm accesible (Expo SDK 58, RN 0.88). |
| 2026-11-16 | F01 iniciada: plantilla Expo `blank-typescript`, dependencias base instaladas, tokens de diseño con test de contraste AA (15/15 en verde). |
| 2026-11-16 | **Cambio de alcance:** el propietario indica que las plataformas son Android y PC (Windows y Linux). Se añade D-12 (Electron), RNF-09/10, F01-016…018, F02-019, F12-008/009, F13-008, R-11…R-15, B-05; se ajustan F02-012, F06-018, F09-006, F11-001/007/008/009, F12-007, F13-002/004. Entorno: sin Rust, con Java y `adb`. |
| 2026-11-16 | Supabase: la conexión directa (`db.<ref>.supabase.co`) solo tiene IPv6 y esta red no lo tiene → se usa el pooler `aws-0-us-east-1.pooler.supabase.com:5432` (usuario `postgres.<ref>`). La BD estaba vacía; se aplicó `20261116000100_perfiles.sql` con `supabase db push` y consta en el historial remoto. Móvil Xiaomi (Android 16, arm64) autorizado por adb; la instalación de Expo Go fue rechazada por el sistema (requiere «Instalar vía USB»). |
| 2026-11-17 | F08: migraciones `20261117000400` (amistades, solicitudes, bloqueos, búsqueda sin email con privacidad, círculos con roles, notificaciones solo marcables como leídas; todo por funciones `security definer`), `…0500` (motor de retos: duelo, grupal, cooperativo colectivo/distribuido, equipos, pactos; puntuación y cierre en servidor; equilibrado con tope; sin retroactivos; desempates; `pg_cron` horario si existe, si no cierre al consultar) y `…0600` (unidad común). 14 tests de BD nuevos (39 en total). Errores reales encontrados por los tests y corregidos: columna ambigua en la política de círculos y conflicto de nombres PL/pgSQL. Pantallas: Retos (Competencia/En equipo/Pactos/Historial, invitaciones, campana), Amigos, Círculos y detalle, crear reto (todas las modalidades), detalle de reto (clasificación estilo maqueta del PDF, cooperativo con contribuciones, equipos, pactos con confirmación, revancha), Notificaciones. **Pendiente:** verificar los flujos con dos cuentas reales (requiere autorización para cuentas de prueba o un segundo usuario real). `db:push` ya no imprime la contraseña. 176 tests. |
| 2026-11-17 | F07: historial inmutable de tareas (`20261117000300`, test), dominio de estadísticas (cumplimiento diario, comparación de periodos, distribución, mejor franja, duración que mejor terminas, patrones del radar, revisión de compromisos; umbrales mínimos de datos), pantallas Estadísticas (indicadores con variación, evolución, mapa anual, distribución, perfil de productividad, radar, historial de sesiones) y Revisión de compromisos; menú en Perfil. Revisión en el móvil: corregido el fallo de zona horaria UTC de cuentas de Google (D-15), resaltado del día actual y puntos cortados en el gráfico de líneas. |
| 2026-11-17 | F06: migración `20261117000200` (eventos con recurrencia y origen, disponibilidad, sesiones de enfoque con plausibilidad de tiempo, radar de distracciones; 4 tests de BD). Dominio: intervalos/conflictos, planificador determinista (urgencia, prioridad, desbloqueos, dependencias, descansos, franjas preferidas), Día viable (completo/esencial/recuperación, nunca elimina), sobrecarga, negociación de conflictos (mover/dividir/mantener), temporizador por marcas de tiempo (Pomodoro/libre/larga, pausas, segundo plano, fin anticipado), expansión de eventos recurrentes con hora local estable en DST, columnas de solapes. Pantallas: Agenda (Día con línea de «ahora», Semana, Mes con marcadores, Tareas, filtro por categoría), editor de eventos con negociación real (dividir crea continuación dependiente), Planificar (propuesta con motivos, sobrecarga, aplazar seleccionadas), Disponibilidad, Enfoque (modos, vínculo hábito/tarea, keep-awake, registro automático con origen temporizador, radar). Notificaciones: adaptador Android (canales) y escritorio (programadas en el proceso principal de Electron). F09 adelantado: biblioteca de 90+ mensajes en 12 categorías × 3 intensidades con reglas editoriales comprobadas por test y motor contextual que no inventa datos; mensaje en Hoy y antes del enfoque. APK con todos los módulos nativos (red, keep-awake, imagen, calendario, voz, archivos, accesos rápidos) instalado y verificado en el Xiaomi (Hoy y Agenda). 152 tests. |
| 2026-11-17 | F04: edición de hábitos (tipo fijo, objetivo versionado desde hoy) y estadísticas por hábito (tendencia 8 semanas, comparación 4/4, día más constante con umbral). F05 completa salvo recordatorios (se programan en F09): migración `20261117000100` (tareas, subtareas, etiquetas, metas/proyectos, hitos, avance inmutable, dependencias acíclicas, `complete_task` transaccional) con 6 tests de BD; dominio (recurrencia, DAG con bloqueos/ruta crítica, progreso, simulador con cálculo vs. estimación); pantallas: Agenda con lista de tareas (búsqueda, filtros, 5 agrupaciones, orden manual), editor y detalle de tarea (subtareas, dependencias, aplazar), metas (lista, editor, detalle con hitos/avance/hábitos/grafo), simulador, accesos desde Hoy/Hábitos/Agenda; «lo que más desbloquea» en Hoy. PKCE seguro en Android (`expo-crypto`, aviso WebCrypto resuelto; test del adaptador). Creación de cuentas QA en Supabase **denegada por permisos** (pendiente de autorización del propietario). 98 tests de app + 20 de BD. |
| 2026-11-16 | Inicio de sesión y registro con Google (F03-005): `expo-web-browser` (nativo → recompilación del APK), adaptador `src/platform/oauth.*`, servidor de retorno loopback en Electron, migración `0006`, paso de @usuario en onboarding. 83 tests en verde. |
| 2026-11-16 | F04 iniciada: dominio de hábitos (7 tipos, objetivos versionados, pausas, constancia, rachas, recuperación; 25 tests), migraciones `0004` (hábitos, RLS, validación de fechas, idempotencia) y `0005` (corregir la versión de objetivo de hoy) aplicadas en remoto (13/13 tests de BD), `REGLAS_NEGOCIO.md`, pantallas: lista con segmentos, nuevo hábito, detalle (constancia, mapa de 12 semanas, historial, pausar/archivar/eliminar), Hoy con hábitos y recuperación. **Primer development build de Android** compilado (27 min) e instalado en el Xiaomi; la app arranca y muestra la bienvenida conectada a Supabase. Aviso `initialRouteName` obsoleto → `anchor`. 79 tests en verde. |
| 2026-11-16 | F03 iniciada: auth por email con PKCE, rutas protegidas, onboarding de 5 pasos, migraciones `0002` (RPC de @usuario) y `0003` (objetivos del onboarding) aplicadas en remoto y probadas en PGlite (7/7). Verificado por REST con la clave publishable: el RPC responde y `profiles` deniega a anónimos. Supabase exige confirmar email (`mailer_autoconfirm=false`); el SMTP por defecto de Supabase limita los envíos (pocos por hora). SDK de Android + JDK 21 instalados en `~/Android` (el Java 27 del sistema es demasiado nuevo para Gradle). |
| 2026-11-16 | F01: Expo Router en `src/app` con navegación adaptable (`expo-router/ui`); tema de navegación transparente (el tema por defecto pintaba un fondo `#F2F2F2` sobre el fondo espacial). Electron: CSP estricta, `safeStorage` asíncrono (la API síncrona está deprecada en Electron 45), sesión solo en memoria si no hay llavero. Capturas automáticas con `--ozone-platform=headless` (Hyprland ignoraba el tamaño de ventana). PGlite necesita `--experimental-vm-modules` en Jest. `expo-doctor` 20/20. Verificación: typecheck, lint y 32 tests en verde (26 app + 6 BD). |

### 15.3. Bloqueos activos

| ID | Bloqueo | Tareas afectadas | Qué se necesita |
|---|---|---|---|
| B-01 | Migraciones al día en remoto (2026-11-17); las Edge Functions (`ai-assist`, `account-delete`) siguen sin desplegar | F03-011, F10, F13-003 | `SUPABASE_ACCESS_TOKEN` o `supabase login` y `npm run deploy:backend` |
| B-06 | **Resuelto (2026-11-16):** SDK + JDK 21 en `~/Android`; development build instalado en el móvil (hay que aceptar el aviso de MIUI a tiempo, o instalar desde `Descargas/Nebula-dev.apk`) | — | — |
| B-02 | **Parcialmente resuelto (2026-11-17):** la llamada real a Groq funciona; falta subir el secreto a Supabase (depende de B-01) | F10-002 | Sesión de despliegue Supabase |
| B-03 | Xiaomi conectado; **su red no alcanza `*.supabase.co`** (Chrome: ERR_CONNECTION_TIMED_OUT; el PC en la misma Wi‑Fi sí). Pruebas hechas con un proxy por adb. Bloquea el retorno de Google en el móvil. Maestro no instalado | F12-007, verificaciones en Android | Dispositivo o emulador con Maestro |
| B-04 | Sin cuenta Expo ni Android SDK verificado; sin keystore | F13-004 | Cuenta EAS o Android SDK + keystore |
| B-05 | Sin máquina Windows | F12-009 | Prueba manual del propietario o runner de CI |
| B-07 | **Resuelto (2026-11-17):** cuentas `@qa_nebula_a` y `@qa_nebula_b` creadas con autorización del propietario; credenciales en `~/.config/nebula/e2e.env` (fuera del repo). Antes: sin cuentas de prueba: crear usuarios QA en el Supabase remoto requiere autorización del propietario (y confirmar email) | F03, F04, F06, F08, F09-012, F12-006 | Dos cuentas confirmadas y `E2E_EMAIL_A/B`, `E2E_PASSWORD_A/B` (local o secretos de CI) |

## 16. Decisiones arquitectónicas y de producto importantes

| ID | Decisión | Motivo |
|---|---|---|
| D-01 | **Tono:** el PDF pide frases que «hagan sentir culpable»; el prompt prohíbe humillar, avergonzar o culpar por descansar. Se adopta firmeza y responsabilidad («seguir aplazándolo también es una decisión») sin ataques personales ni vergüenza; el modo Intenso es opt-in. | El prompt es posterior y más específico; protege al usuario. |
| D-02 | Las frases del PDF están en inglés; la app se escribe en español con mensajes **originales** inspirados en su estilo (directo, futuro, disciplina). Textos centralizados para i18n futura. | Coherencia de idioma; originalidad exigida. |
| D-03 | Fondo principal `#0B0815`, alternativo `#100D1C` (el del PDF), violeta `#8055E8`, lavanda `#C7A9FF`. Los turquesas del tablero de inspiración del PDF se usan solo como acento informativo (cian suave) y en nebulosas de muy baja opacidad. | El violeta debe ser el color distintivo. |
| D-04 | Los **retos equilibrados** (PDF: «versión avanzada») entran en el MVP porque la maqueta de competencia del PDF ya clasifica por % de objetivo personal; lo avanzado son clasificaciones históricas y equipos. | La métrica porcentual es el núcleo de la competencia justa. |
| D-05 | Sin monedas, XP, niveles ni planetas. La constancia (%) es la métrica principal; la racha es secundaria y nunca se falsifica. | Prompt §3 y §6.5. |
| D-06 | Puntuación, cierre y desempate de retos en **Postgres** (funciones `security definer`) y Edge Functions; el cliente solo lee. | Integridad (prompt §10.9). |
| D-07 | Pruebas de BD con **PGlite** ejecutando las migraciones reales con un esquema `auth` simulado. | No hay Docker; RLS debe verificarse. |
| D-08 | Objetivos de hábito **versionados** (`habit_targets.valid_from`). | Cambiar metas no corrompe el historial. |
| D-09 | Registros con `source` (`manual`/`timer`/`integration`); la UI distingue «autodeclarado» y «con temporizador». | Prompt §10.9. |
| D-10 | El build **web** es la base del escritorio y se usa también para desarrollo, revisión visual y E2E. | Una sola UI para Android y PC. |
| D-13 | Las estadísticas se agregan en el cliente (`src/domain/stats`) a partir de los registros ya protegidos por RLS, en lugar de funciones SQL. Volumen por usuario pequeño (≤ 1 año de registros); funciones puras probadas. Se migrará a vistas SQL si el volumen lo exige. | Simplicidad, pruebas y una sola fuente de reglas. |
| D-14 | La revisión de compromisos usa un historial de tareas inmutable escrito por la BD (`task_history`), no aproximaciones a partir del contador de aplazamientos. | Datos reales (prompt §13.3). |
| D-15 | Si el perfil conserva la zona `UTC` por defecto (alta con Google), se adopta la del dispositivo una vez; una zona elegida no se cambia sola al viajar. | Detectado en el móvil: el «hoy» en UTC no coincidía con el día local. |
| D-12 | **Plataformas: Android + PC (Windows, Linux)** (indicación del propietario, 2026-11-16). Android: Expo nativo. Escritorio: build web de Expo dentro de **Electron**. Se descarta Tauri (requiere Rust, no disponible, y en Linux usa WebKitGTK con capacidades distintas a Windows/WebView2), React Native Windows (sin Linux) y Flutter (reescritura completa). iOS fuera de alcance. | Una base de código; mismo motor de render en Windows y Linux; verificable aquí. |
| D-11 | Gráficos propios con `react-native-svg` en lugar de librerías pesadas. | Control estético y rendimiento. |

## 17. Definición de MVP y versión completa

### 17.1. MVP (hito H5) — criterios del prompt §20

| # | Criterio | Tareas |
|---|---|---|
| 1 | Crear cuenta e iniciar sesión | F03-001, F03-002 |
| 2 | Configurar perfil y preferencias | F03-007, F03-008, F03-010 |
| 3 | Crear hábitos | F04-004 |
| 4 | Registrar y modificar cumplimiento | F04-006, F04-007 |
| 5 | Crear tareas y metas | F05-002, F05-010 |
| 6 | Consultar agenda | F06-002, F06-003 |
| 7 | Iniciar sesiones de enfoque | F06-017 |
| 8 | Estadísticas desde registros | F07-002 |
| 9 | Agregar amigos | F08-003 |
| 10 | Crear objetivo cooperativo | F08-012 |
| 11 | Invitar a otra persona | F08-012, F08-016 |
| 12 | Competencia 1 vs. 1 | F08-016 |
| 13 | Reto grupal | F08-017 |
| 14 | Clasificación correcta | F08-018, F08-029 |
| 15 | Recordatorios configurables | F09-006, F09-007 |
| 16 | Datos persistentes tras volver a iniciar sesión | F03-002, F12-006 |
| 17 | Privacidad de la actividad | F03-008, F08-004 |
| 18 | Interfaz consistente y navegable | F02-*, F12-001 |

Además (PDF §7, primera versión): hábitos flexibles y estadísticas, agenda y temporizador,
metas individuales y compartidas, competencias 1 vs. 1 y grupales, frases por contexto,
perfiles y seguimiento de amigos.

### 17.2. Versión completa (H7)
Todo lo marcado `AVZ`: adaptación inteligente de hábitos, replanificación con IA, simulador,
clasificaciones avanzadas y equipos, análisis de patrones y diario inteligente, integraciones
y salas de enfoque, voz, constelación, revisión semanal guiada.
