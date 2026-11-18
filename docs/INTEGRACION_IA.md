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

## Cambiar de proveedor

`AI_PROVIDER=groq` usa Chat Completions compatible. `AI_PROVIDER=openai` usa Responses con
`store=false`. `AI_BASE_URL`, `AI_MODEL` y `AI_API_KEY` son secretos del servidor. El endpoint
requiere HTTPS y el timeout es de 25 segundos. No hay ejecución de código del modelo.

Referencias: [compatibilidad Groq](https://console.groq.com/docs/openai),
[modelos Groq](https://console.groq.com/docs/models),
[Responses](https://developers.openai.com/api/reference/resources/responses/methods/create),
[autenticación de funciones Supabase](https://supabase.com/docs/guides/functions/auth).
