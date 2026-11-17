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

Se envían la petición que escribe el usuario y un resumen numérico de siete días: fechas,
tareas completadas, número de registros de hábitos y días activos. No se incluyen emails,
IDs de amigos, textos del diario, títulos de tareas existentes ni tokens de sesión del cliente.
La conversación permanece en memoria de la pantalla; Nebula no la guarda en tablas.
El proveedor procesa el contenido conforme a sus propias condiciones.

Cliente y servidor validan el mismo esquema Zod. Las propuestas admiten crear tareas,
hábitos, metas con hitos y eventos, y modificar fecha, estimación o prioridad de una tarea
identificada. Cada tarjeta exige **Confirmar y aplicar**. Descartar no escribe datos.
La reprogramación comprueba solapamientos con la agenda antes de guardar.

Los IDs de tareas existentes no se envían en el contexto automático: el asistente debe pedir
más información antes de proponer modificaciones. La planificación diaria completa se
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
