# Asistente y Groq

El cliente no llama directamente al proveedor. `ai-assist` autentica la sesión mediante
Supabase Auth, exige `ai_enabled`, reserva una petición en un contador atómico y llama al
proveedor desde el servidor. El máximo es de 20 peticiones diarias por cuenta (día UTC).
La IA empieza desactivada para nuevas cuentas. Los intentos al proveedor cuentan para el
límite incluso si fallan, para evitar abuso y costes de reintentos.

El proveedor elegido es **Groq**, con la URL `https://api.groq.com/openai/v1` y el modelo
preferido en la configuración local de dotfiles. Los valores privados viven en
`.env.server.local` (0600, ignorado por Git). No se empaqueta ese archivo. La clave
proporcionada por el propietario sustituye la obtenida de los dotfiles.

```sh
# Opcional: regenerar la configuración desde los dotfiles locales
npm run configure:groq
# Prueba sintética, sin datos personales ni escrituras
node scripts/test-groq.mjs
# Desplegar después de configurar el acceso a Supabase
export NEBULA_SUPABASE_PROJECT_REF=tu_proyecto
npm run deploy:backend
```

El despliegue ejecuta las comprobaciones, aplica migraciones, configura los secretos y
publica `ai-assist` y `account-delete`. La autenticación se valida dentro de cada función;
`verify_jwt=false` evita depender del verificador antiguo del gateway. Nunca debe omitirse
`authenticate()` en el código de una función expuesta.

## Datos y acciones

Desde 2026-11-17 el asistente recibe un **contexto completo y acotado** (`src/domain/assistant/context.ts`,
mismo esquema Zod en cliente y servidor), construido por `buildAssistantContext()`:

- `now`: fecha, hora local, día de la semana y franja del día.
- `person`: nombre de pila, el texto «Sobre mí» que escribe la persona (`ai_about`), el tono
  preferido (`ai_tone`: cercano, directo, motivador o tranquilo), intereses, objetivos del
  onboarding, días activos, franjas de enfoque e intensidad motivacional.
- `week`: últimos 7 días, por día: hábitos cumplidos/programados, tareas hechas y minutos de enfoque.
- `habits` (≤25): tipo, objetivo, estado de hoy, racha actual y mejor, constancia a 30 días y si cuesta.
- `tasks` (≤30 abiertas, con ID real): prioridad, vencimiento, estimación, aplazamientos, bloqueo,
  meta y subtareas. Las notas de las tareas **no** se envían. `recentlyDone` (≤12 títulos).
- `goals` (≤12 activas): progreso, fecha objetivo, hitos y siguiente hito.
- `agenda` (≤30 eventos de los próximos 7 días), `challenges` propios (≤8) e `insights` de la app.
- `journal` (≤4 entradas recientes) **solo** si se activa «Compartir mi diario» (`ai_share_journal`).
- `history`: hasta 8 turnos previos de la conversación, para mantener el hilo.

Nunca se envían emails, datos de amigos ni tokens. La conversación sigue en memoria de la pantalla.
Cliente y servidor validan el mismo esquema Zod. Las propuestas admiten crear tareas,
hábitos, metas con hitos y eventos, y modificar fecha, estimación o prioridad de una tarea
identificada. Cada tarjeta exige **Confirmar y aplicar**. Descartar no escribe datos.
La reprogramación comprueba solapamientos con la agenda antes de guardar.

Como el contexto incluye los IDs de las tareas abiertas, el asistente puede proponer mover,
estimar o priorizar tareas existentes; el prompt le prohíbe usar IDs que no estén en el contexto. La planificación diaria completa se
realiza desde `Planificar`, que usa el planificador determinista. Las recomendaciones de
sobrecarga y constancia son heurísticas explicadas; no son predicciones clínicas.

Sin proveedor, sin red, con cuota agotada o con JSON inválido, la app conserva captura local,
planificador y recomendaciones. El parser español interpreta fechas relativas a la zona
horaria del perfil y ofrece vista previa editable mediante el texto de captura.

## Planes para metas

Cuando la persona no sabe cómo conseguir algo («No sé cómo lograr una meta» en el asistente, o
**Plan con IA** en el detalle de una meta), el modelo devuelve una acción `create_plan`: meta nueva
o existente (`goalId` de `context.goals`), hitos, tareas con fecha y «qué estudiar», hábitos en sus
días activos y recursos web. `ai-assist` comprueba cada enlace (`links.ts`: solo https público, sin IPs
ni hosts internos; descarta 404/410/5xx y los que no resuelven) antes de responder.

La tarjeta permite desmarcar partes y aplica por pasos reanudables (un reintento no duplica). Las
tareas guardan lo que estudiar y los enlaces en sus notas; los hábitos, en su descripción (≤500), y
quedan vinculados a la meta. Notas y descripciones muestran los enlaces pulsables.

**Aplicar automáticamente** (interruptor del asistente, por sesión) crea al momento tareas, hábitos,
metas, eventos y planes. Mover, estimar o priorizar tareas existentes siempre pide confirmación.

## Cambiar de proveedor

La cadena tiene cuatro proveedores gratuitos; este es su orden de preferencia:

1. **Groq** (`AI_*`): `openai/gpt-oss-120b` con `AI_REASONING_EFFORT=low` (plan completo en ~6 s) y
   alternativos `qwen/qwen3.8-27b` y `openai/gpt-oss-20b` (`AI_ALTERNATE_MODELS`). Gratis: 8000
   tokens/min.
2. **OpenRouter** (`AI_FALLBACK_*`, `AI_FALLBACK_PROVIDER=openrouter`): modelos `:free`,
   `baidu/ernie-5.5-flash-preview:free` (~60 s por plan) y alternativos Nemotron 3 Ultra y Gemma 4
   31B. Gratis: 50 peticiones al día por cuenta; los `:free` dan 429 a menudo.
3. **NVIDIA** (`AI_FALLBACK2_*`, `AI_FALLBACK2_PROVIDER=nvidia`,
   `AI_FALLBACK2_BASE_URL=https://integrate.api.nvidia.com/v1`): `nvidia/nemotron-3-ultra-550b-a55b`
   (respuestas cortas en ~3 s, planes en ~130 s). Kimi K3.1, GLM 5.3 y Mistral Large 4 aparecen en
   el catálogo pero se quedaban en cola sin responder (2026-11-18).
4. **Cloudflare Workers AI** (`AI_FALLBACK3_*`, `AI_FALLBACK3_PROVIDER=cloudflare`,
   `AI_FALLBACK3_BASE_URL=https://api.cloudflare.com/client/v4/accounts/<cuenta>/ai/v1`):
   `@cf/openai/gpt-oss-120b` y `@cf/qwen/qwen3.8-27b`. El plan gratis (10 000 neuronas/día) no
   incluye Kimi, GLM 5.3 ni DeepSeek V4 y es lento: sirve para respuestas cortas.

### Salud de los modelos (cada 6 horas)

`ai-assist` registra cada intento real (`record_ai_attempt`: bien, saturado o error, y su
latencia) en `ai_model_health`. Cada 6 horas pg_cron llama a la función `ai-health` (cabecera
`x-health-secret` = `AI_HEALTH_SECRET`), que evalúa cada modelo:

- con 3 o más intentos reales en la ventana, por esos resultados, sin gastar consultas;
- si no, con un sondeo barato: un «ping» de 8 tokens como mucho y 20 s de espera; en OpenRouter,
  su estado público (`/models/<id>/endpoints`), que no gasta ninguna de las 50 consultas diarias.

Los proveedores se revisan en paralelo y los modelos de un mismo proveedor de uno en uno. Después,
`ai-assist` ordena la cadena: primero los sanos en su orden de preferencia, luego los irregulares
(menos del 50 % de aciertos) y al final los caídos; las evaluaciones de más de 13 h se ignoran. Encima
sigue actuando el descanso en memoria de los modelos que acaban de dar 429/5xx.

La URL del proyecto y el secreto del cron viven en Vault (`nebula_project_url` y
`nebula_ai_health_secret`), no en el repositorio.

Cada uno admite `*_ALTERNATE_MODELS`. `AI_TIMEOUT_MS`, `AI_MAX_TOKENS`, `AI_DEADLINE_MS` y
`AI_CONNECT_TIMEOUT_MS` son opcionales. `node --experimental-strip-types scripts/test-plan.mjs
[--proveedor AI_FALLBACK_] "<meta>"` prueba un plan real con un solo proveedor y comprueba sus enlaces
sin escribir datos.

Si todos fallan, la función responde con un `code` que la app traduce: `models_busy`, `models_error`
(claves o modelos mal configurados), `not_configured`, `daily_limit`, `ai_disabled`, `unauthorized`,
`invalid_request` o `internal`.

`groq`, `google`, `openrouter`, `nvidia` y `cloudflare` usan Chat Completions compatible. `AI_PROVIDER=openai` usa Responses con
`store=false`. `AI_BASE_URL`, `AI_MODEL` y `AI_API_KEY` son secretos del servidor. El endpoint
requiere HTTPS y el timeout es de 25 segundos. No hay ejecución de código del modelo.

Referencias: [compatibilidad Groq](https://console.groq.com/docs/openai),
[modelos Groq](https://console.groq.com/docs/models),
[Responses](https://developers.openai.com/api/reference/resources/responses/methods/create),
[autenticación de funciones Supabase](https://supabase.com/docs/guides/functions/auth).
