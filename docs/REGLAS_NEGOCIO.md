# Nebula — Reglas de negocio

Documento vivo. Cada regla tiene su implementación y sus pruebas indicadas. Si una regla
cambia, se cambian a la vez el código, las pruebas y este documento.

## 1. Fechas

- Los periodos se calculan sobre **días civiles** (`DayKey`, `YYYY-MM-DD`) en la zona horaria
  del perfil en el momento del registro. Cada registro guarda `day_key` y `tz`.
- Semana: empieza el día configurado por el usuario (`week_starts_on`, lunes por defecto).
- Mes: del día 1 al último día natural.
- Implementación: `src/lib/dates.ts` · Pruebas: `dates.test.ts` (incluye DST de Madrid y Bogotá).

## 2. Tipos de hábito

Implementación: `src/domain/habits/evaluate.ts` · Pruebas: `evaluate.test.ts`.

| Tipo | Periodo habitual | Valor medido | Cumplido si |
|---|---|---|---|
| Binario | día | 1 si hay algún registro > 0 | valor = 1 |
| Duración | día (o semana) | suma de minutos | suma ≥ objetivo |
| Cantidad | día (o semana) | suma de unidades | suma ≥ objetivo |
| Frecuencia | semana/mes (o día) | nº de registros > 0 (cada registro es «una vez») | veces ≥ objetivo |
| Acumulativo | semana/mes | suma en el periodo | suma ≥ objetivo |
| Reducción | día (o semana) | suma de lo consumido | suma ≤ límite **y** hay al menos un registro |
| Flexible | semana | nº de días cuya suma ≥ mínimo por sesión | sesiones ≥ objetivo |

**Diferencia frecuencia / flexible:** en frecuencia cada registro cuenta una vez (p. ej.
«meditar 5 veces por semana»). En flexible solo cuentan los días que alcanzan un mínimo
(p. ej. «3 sesiones de al menos 20 min por semana, el día que quieras»).

**Reducción sin registro:** un día sin registro queda como **desconocido**, no como cumplido.
Para declarar «hoy 0», se registra 0. Así la constancia no se infla con días olvidados.

### Estados de un periodo

`met` (cumplido) · `partial` (cerrado con avance insuficiente) · `missed` (cerrado sin avance) ·
`pending` (en curso y sin cumplir; en reducción, en curso aunque vaya dentro del límite) ·
`paused` · `notScheduled` (día no programado) · `unknown` (reducción sin registro) ·
`beforeStart`.

## 3. Cambios en un hábito sin corromper el historial

- **Objetivo y periodo** se versionan en `habit_targets` (`valid_from`). Un periodo se evalúa con
  la versión vigente en su primer día. Las versiones que empiezan en días pasados son inmutables
  (RLS solo permite `update` si `valid_from ≥ hoy − 1`, margen por zona horaria). Al editar el objetivo,
  la UI crea o corrige la versión con `valid_from = hoy`.
- **Días programados**: cambian hacia delante. Los días que antes estaban programados y ya
  pasaron se reevaluarían con la nueva programación. **Decisión:** se acepta y se documenta, porque solo
  afecta a qué días *no programados* se excluyen. Para evitar sorpresas, la UI avisa al cambiarlos.
- **Tipo**: no se puede cambiar (otra semántica de valores). Se crea un hábito nuevo.
- **Pausas** (`habit_pauses`): al reanudar, la pausa abierta termina ayer; si empezó hoy, se elimina. Los días pausados no cuentan en constancia ni rompen rachas. Un
  periodo semanal/mensual cuenta como pausado solo si estuvo pausado entero.
- **Archivar** no borra nada; **eliminar** borra hábito, objetivos, registros y pausas (con confirmación).
- **Registros**: editables (valor, nota, fecha dentro del rango permitido) y borrables. No se puede
  registrar más de un día en el futuro (margen por zonas horarias) ni antes del inicio.

## 4. Constancia, rachas y recuperación

- **Constancia** = periodos `met` / periodos cerrados evaluables (`met`, `partial`, `missed`).
  No cuentan el periodo en curso, las pausas, los días no programados ni los `unknown`.
- **Racha actual**: periodos `met` consecutivos hacia atrás. El periodo en curso suma si ya está
  cumplido y no rompe si está pendiente. Pausas y días no programados se saltan. `unknown` corta.
  La racha nunca se falsifica ni se «congela» artificialmente; la métrica principal es la constancia (D-05).
- **Día de descanso** (`src/domain/habits/rest.ts`): en hábitos diarios, uno por semana, solo hoy
  (si aún no está cumplido) o mañana, nunca un día pasado. Es una pausa de un día: no rompe ni
  suma racha y no cuenta en la constancia. Compatible con D-05 porque se decide antes, no tras fallar.
- **Órbitas de semana y mes** (`src/domain/stats/orbits.ts`): cada periodo de hábito que cae en la
  ventana es una unidad (un día de un diario, la semana de un semanal —también la que empezó el mes
  anterior—) y suma su progreso parcial (la reducción solo al cerrarse cumplida); cada tarea no
  cancelada con fecha límite en la ventana es otra unidad. Los días futuros cuentan en el total. El
  **ritmo** compara lo hecho con `total × parte transcurrida` (contando hoy entero).
- **Modo recuperación** (`src/domain/habits/recovery.ts`): hábitos diarios (no de reducción) con
  ≥ 2 días programados seguidos sin cumplir y sin cumplir hoy. Propone un mínimo para hoy: el
  `min_target` del usuario o ~25 % del objetivo (en duración, múltiplos de 5 y mínimo 5 min).
  Nunca modifica el historial.

## 5. Integridad de datos (servidor)

- RLS: cada usuario solo lee y escribe sus hábitos, objetivos, registros y pausas.
- Un registro solo puede apuntar a un hábito propio (`owns_habit`) y no puede moverse a otro.
- `client_id` único por usuario: reintentos de la cola offline no duplican registros.
- Origen del registro (`manual` / `timer` / `integration`) para distinguir lo autodeclarado (D-09).
- Pruebas: `supabase/tests/habitos.test.ts`.

## 6. Tareas

Implementación: `src/domain/tasks/*`, `supabase/migrations/20261117000100_tareas_metas.sql` · Pruebas: `listing.test.ts`, `tasks.test.ts`, `supabase/tests/tareas.test.ts`.

- **Estados:** `todo`, `in_progress`, `done`, `cancelled`. `completed_at` lo fija la BD al pasar a `done` y lo borra al reabrir.
- **Prioridad:** 3 alta · 2 media · 1 baja. **Orden en listas:** prioridad, fecha límite, orden manual.
- **Agrupación:** por fecha (vencidas, hoy, mañana, próximos 7 días, más adelante, sin fecha), prioridad, meta, etiqueta u orden manual. Una tarea con varias etiquetas aparece en cada una.
- **Búsqueda:** insensible a mayúsculas y tildes, en título, notas y etiquetas.
- **Aplazamientos:** cada vez que la fecha límite se mueve **hacia delante** la BD incrementa `postponed_count` (adelantarla no cuenta). Con ≥ 3 se muestra el aviso de fricción.
- **Recurrencia:** subconjunto de RRULE (`FREQ=DAILY|WEEKLY|MONTHLY`, `INTERVAL`, `BYDAY` en semanal). Exige fecha. Al completar, `complete_task(id, siguiente)` marca hecha y crea la siguiente (con subtareas y etiquetas) **en la misma transacción**; la siguiente fecha debe ser posterior. Mensual en día 31 → último día del mes.
- **Recordatorio:** instante = fecha + hora (09:00 si no hay) en la zona del usuario − antelación.
- **Orden manual:** orden fraccional (`sortOrderBetween`), sin renumerar la lista.

## 7. Metas, proyectos y dependencias

- **Progreso** (`src/domain/goals/progress.ts`):
  - *Cantidad*: suma de eventos de avance (las correcciones son eventos negativos; el historial es inmutable) + registros de hábitos vinculados con la misma unidad (o duración si la unidad es «min») desde la creación de la meta.
  - *Hitos*: hitos completados / hitos.
  - *Tareas*: tareas `done` / tareas no canceladas.
  - Sin datos medibles el progreso es **desconocido**, no 0 %.
- **Ritmo necesario** = pendiente / semanas hasta el plazo. Se presenta como cálculo.
- **Dependencias:** grafo dirigido acíclico. La BD rechaza ciclos (CTE recursiva) y dependencias entre tareas de usuarios distintos; la UI oculta las opciones que crearían un ciclo. Una tarea está **bloqueada** si algún prerrequisito no está terminado; **lista** si todos lo están. «Lo que más desbloquea» = nº de pendientes que dependen de ella directa o indirectamente. **Ruta crítica** = cadena de pendientes con más minutos estimados (30 min por defecto).
- **Simulador** (`src/domain/goals/simulator.ts`): *cálculo* con tres ritmos (75 %, 100 %, 125 % del planificado) y comparación con el plazo; *estimación* solo con ≥ 4 semanas de historial real (media ± desviación típica), etiquetada como estimación.

## 8. Planificación y agenda

Implementación: `src/domain/planning/*`, `src/domain/calendar/*`, `src/domain/focus/timer.ts`.

- **Puntuación del planificador** = fecha (vencida 60 · hoy 50 · ≤ 2 días 30 · ≤ 7 días 15 · resto 5) + prioridad × 12 + min(desbloquea, 5) × 4. Mayor puntuación se coloca antes; las de prioridad alta van primero a las franjas preferidas de concentración.
- Descanso de 10 min entre bloques; una tarea con prerrequisitos solo se coloca si estos se colocan antes en el mismo plan (y empieza tras ellos). En Planificar no se dividen tareas: si no caben, se informa.
- **Día viable:** Completo (todo lo que cabe), Esencial (vencidas, de hoy y prioridad alta), Recuperación (50 % de la capacidad, ≤ 3 imprescindibles). Lo que queda fuera solo se aplaza si el usuario lo marca.
- **Planificar hoy o mañana con hábitos** (`src/domain/planning/habitPlan.ts`): entran los hábitos que
  tocan ese día sin cumplir (no los de reducción). Diarios: duración = lo que falta (5–180 min), resto
  15 min; puntúan como «de hoy». Semanales/mensuales solo si les falta algo: flexible = sesión mínima,
  minutos = lo que falta repartido entre los días que quedan (10–120), resto 15–30 min; vencen al
  cerrar su periodo. Los diarios con hora propia y los ya colocados ese día quedan fijos. Aceptar el
  plan coloca el hábito ese día en la agenda (guardado en el dispositivo) sin cambiar su hora de siempre.
- **Negociación:** ante un evento que choca con un bloque planificado se ofrece mover (siguiente hueco del día), dividir (si caben ≥ 15 min antes; la segunda parte pasa a una tarea de continuación que depende de la primera) o mantener. Nunca automático.
- **Temporizador:** basado en marcas de tiempo; un bloque desatendido más allá de su duración no suma más enfoque; terminar antes registra solo el tiempo real.
- **Eventos recurrentes** conservan la hora local de su zona aunque cambie el horario de verano.

## 9. Mensajes motivacionales

Implementación: `src/domain/motivation/*` · Pruebas: `motivation.test.ts`.

- ≥ 80 mensajes originales, 12 categorías × 3 intensidades. Se elige la categoría por hechos reales (enfoque > reto que acaba > recuperación > tarea aplazada ≥ 3 veces > meta a ≤ 14 días > cierre del día > resultados > hábito pendiente > colaboración > racha ≥ 3 > inicio/disciplina).
- Nunca se supera la intensidad elegida (se permiten las más suaves). Un mensaje con variables solo es elegible si todas tienen datos reales.
- Se evitan los 30 últimos mostrados. El mensaje es estable durante el día.
- **Reglas editoriales:** sin insultos, humillación, amenazas ni culpa por descansar (lista de términos vetados comprobada por test); máximo 140 caracteres.

## 10. Retos y competencias

Implementación: `supabase/migrations/20261117000500_retos.sql` (+ `…0600`) · Pruebas: `supabase/tests/retos.test.ts`.

**Ciclo de vida.** `pending` (invitaciones; cada uno acepta las reglas y fija su objetivo personal) → `active` el día de inicio si ≥ 2 aceptaron (si no, `cancelled`; los no respondidos pasan a `declined`) → `finished` cuando termina la gracia (24 h tras el último día) o, en cooperativos, en cuanto se alcanza el objetivo. Las reglas no se editan tras enviar invitaciones; el objetivo personal queda **bloqueado** al empezar.

**Qué cuenta (fuente).**
- *Enfoque*: minutos de sesiones completadas con el temporizador; sesión válida ≥ 10 min; máx. 16 h por día.
- *Hábito*: registros del hábito que cada participante vincula al aceptar. No cuentan: registros creados **más de 2 días después** de su fecha (retroactivos) ni después del corte. Máx. 16 h/día en hábitos de minutos. En «cantidad total» todos deben usar la misma unidad.
- Se muestra qué parte procede del temporizador; lo demás es **autodeclarado** (nunca se presenta como verificado externamente).

**Puntuación** (calculada en el servidor; el cliente no puede escribir resultados):

| Métrica | Puntuación |
|---|---|
| % de objetivo (equilibrado) | min(valor / objetivo personal × 100, tope); tope 100 % por defecto |
| Constancia | días con valor ≥ mínimo diario |
| Sesiones válidas | nº de sesiones/registros válidos |
| Cantidad total | suma (misma unidad) |
| Progreso relativo | (valor − valor del periodo anterior de igual duración) / anterior × 100; sin base: 100 si hay actividad, 0 si no |

**Clasificación y empates.** Orden por puntuación; con regla «constancia», el empate lo rompe quien tenga más días activos; con regla «compartido», se comparte el puesto. Quien abandona queda al final, marcado como abandonado. Diferencia con el anterior = puntuación del anterior − propia.

**Equipos.** Puntuación de equipo = media del % de sus miembros (métrica %) o suma (resto).

**Cooperativos.** Colectivo: total ≥ objetivo. Distribuido: total ≥ objetivo **y** cada integrante ≥ mínimo por persona. Resultado: conseguido / no conseguido.

**Pactos.** Cada uno se compromete a N días; al terminar, cada participante confirma si el otro cumplió; se muestran la celebración y la acción de apoyo acordadas.

**Integridad.** Solo amigos pueden ser invitados; solo participantes ven el reto, la clasificación y los resultados; inscripción y resultados solo mediante funciones del servidor; las sesiones de enfoque deben ser plausibles (enfoque ≤ duración real) y los registros son idempotentes (`client_id`); la zona del reto define sus días; el cierre es transaccional y se ejecuta al consultar o cada hora (si `pg_cron` está disponible).
