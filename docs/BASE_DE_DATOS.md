# Base de datos

Las migraciones de `supabase/migrations` son la fuente del esquema. Se aplican en orden y se
prueban completas en PGlite (Postgres real en WASM) mediante `npm run test:db`.

| Área | Tablas principales | Escritura |
|---|---|---|
| Cuenta | profiles, user_preferences | Usuario sobre sus propias filas; alta por trigger |
| Hábitos | habits, habit_targets, habit_logs, habit_pauses | Usuario; objetivos versionados; client_id idempotente |
| Tareas/metas | tasks, subtasks, tags, task_tags, task_dependencies, goals, milestones, goal_progress_events | Usuario; dependencias y completado validados en SQL |
| Historial | task_history | Trigger del servidor |
| Agenda/enfoque | calendar_events, availability_windows, focus_sessions, distraction_logs | Usuario, con validaciones |
| Social | friend_requests, friendships, blocks, circles, circle_members, circle_invites, notifications | RPC con autorización; lectura mediante RLS |
| Retos | challenges, challenge_participants, challenge_results, pact_confirmations | RPC; puntuación y cierre autoritativos |
| Diario | journal_entries | Solo propietario, sin acceso social |
| IA | ai_daily_usage | RPC atómica; sin edición desde el cliente |
| Calendarios | integrations | Importación transaccional e idempotente mediante import_calendar |
| Salas | focus_rooms, focus_room_members | RPC; invitación solo entre amigos; inicio con hora del servidor |

Todas las tablas de usuario tienen RLS. Las funciones `security definer` fijan `search_path`.
La migración de permisos elimina el acceso heredado de PUBLIC. La excepción pública
intencionada es `is_handle_available(text)`, que devuelve únicamente disponibilidad de un
handle durante el registro. Los motores de puntuación y reloj no son invocables por clientes.

La importación de calendario identifica cada evento por `(integration_id, external_id)`;
reimportar actualiza esa copia. Quitar una integración elimina sus eventos importados en
cascada. La política impide asociar eventos a integraciones de otra cuenta.

Realtime publica únicamente tablas sociales autorizadas por RLS. Al registrar un hábito o
una sesión se actualiza `challenges.updated_at` para refrescar clasificaciones sin publicar
la actividad privada de los participantes. Las salas usan canales privados de presencia;
las políticas de `realtime.messages` verifican membresía y aceptación.

El arnés simula `auth.users`, roles y `auth.uid()`. Los buckets de Storage, el servicio Auth y
Realtime requieren validación adicional en Supabase real; PGlite no simula esos servicios.

```sh
npm run test:db
npm run db:push
```

No ejecutar migraciones manualmente desde pantallas de la app ni guardar contraseñas o
claves de servidor en variables con prefijo `EXPO_PUBLIC_`.
