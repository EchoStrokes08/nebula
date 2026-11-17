# Nebula — Diseño UI/UX

Documento vivo. Define el sistema visual, la navegación y las 40 pantallas. Las pantallas se
implementan siguiendo esta especificación; si la implementación la cambia, este documento se
actualiza en el mismo cambio.

## 1. Principios

1. **Lo de hoy primero.** Toda pantalla responde a «¿qué hago ahora?» antes que a «¿qué he hecho?».
2. **Una acción principal por pantalla.** Un único botón primario violeta; el resto, secundarios o fantasma.
3. **Datos reales o nada.** Sin cifras de relleno. Si no hay datos suficientes, se dice cuántos faltan.
4. **Oscuro y sereno.** Superficies sólidas; el cristal se reserva a la navegación, los modales y los menús.
5. **El espacio es atmósfera, no mecánica.** Estrellas y nebulosas en el fondo; constelaciones solo donde representan relaciones reales (mapa de progreso).
6. **Mismo producto en Android y PC.** Mismos componentes; cambia la disposición, no la identidad.

## 2. Sistema visual

Fuente de verdad: `src/design/tokens.ts`. Contraste verificado por `src/design/contrast.test.ts`.

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#0B0815` | Fondo espacial principal |
| `bgAlt` | `#100D1C` | Barras de navegación, fondos alternos |
| `surface` | `#171126` | Tarjetas, listas |
| `surfaceRaised` | `#251B39` | Hojas, modales, menús, elementos elevados |
| `accent` | `#8055E8` | Botón primario, selección |
| `accentBright` | `#A987FF` | Iconos activos, progreso, foco |
| `accentSoft` | `#C7A9FF` | Texto de acento, sobrelíneas |
| `text` / `textSecondary` / `textTertiary` | `#F7F4FF` / `#B5AAC8` / `#8A7FA0` | Jerarquía de texto |
| `info` / `success` / `warning` / `danger` | cian / verde / ámbar / rojo moderado | Estados; nunca decorativos |

**Tipografía (Inter):** `display 34`, `title1 26`, `title2 20`, `title3 17`, `body 15`, `callout 14`,
`caption 12`, `overline 11 (mayúsculas, +1.2)`, `metric 28 (cifras tabulares)`. Escalado del
sistema hasta ×2.

**Espaciado:** base 4 (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Margen de pantalla 20 (Android) / 40 (escritorio).
**Radios:** 8 controles pequeños, 12 botones y campos, 16 tarjetas, 22 hojas y modales, píldora para chips.
**Elevación:** `low` tarjetas pulsables, `high` hojas y modales, `glow` solo en el botón de enfoque activo.
**Movimiento:** 150 ms (pulsación, hover), 220 ms (cambios de estado, pestañas), 350 ms (hojas, completar meta). Con «reducir movimiento» se sustituyen por fundidos de 150 ms o cambios instantáneos.

### 2.1. Fondo espacial
Gradiente oscuro + nebulosa violeta arriba a la derecha (≤ 28 % de opacidad) + nebulosa cian
abajo a la izquierda (≤ 7 %) + 60–90 estrellas deterministas. Estático. Nunca detrás de bloques
de texto largos sin una superficie sólida intermedia.

### 2.2. Iconografía
Lucide, trazo 1.8 (2.2 activo), tamaños 16/18/22/28. Sin emojis en la interfaz. Los iconos
que elige el usuario para hábitos vienen de un catálogo curado de Lucide.

## 3. Navegación

| | Android y ventanas < 900 px | Escritorio ≥ 900 px |
|---|---|---|
| Principal | Barra inferior: Hoy, Hábitos, Agenda, Retos, Perfil | Barra lateral de 232 px con marca y atajos `Ctrl 1…5` |
| Crear | Botón «+» contextual en la cabecera de cada sección | Igual + `Ctrl+K` (captura universal) |
| Detalle | Pantalla apilada | Panel derecho (lista + detalle) desde 1100 px |
| Formularios | Hoja inferior a pantalla completa | Modal centrado de 560 px |
| Volver | Gesto/botón atrás del sistema | `Esc` cierra modal/panel; botón atrás en la cabecera |

Rutas: `src/app/(tabs)/…` para las cinco secciones; detalles y formularios como rutas apiladas
o modales (`src/app/habito/[id].tsx`, `src/app/habito/nuevo.tsx`, …). No existe ningún enlace
a una ruta que no exista.

## 4. Estados comunes (aplican a todas las pantallas)

| Estado | Tratamiento |
|---|---|
| Cargando | Esqueletos con la forma del contenido (sin spinners centrados salvo en acciones) |
| Vacío | `EmptyState`: icono, título, una frase y, si tiene sentido, una acción real |
| Error | `ErrorState` con mensaje comprensible y «Reintentar»; los datos en caché siguen visibles |
| Sin conexión | Banner superior discreto; lectura desde caché; registros de hábitos encolados |
| Sin permisos | `PermissionState` explicando para qué se usa el permiso, con botón a ajustes del sistema |
| Sesión expirada | Redirección a inicio de sesión conservando la ruta de destino |
| Información incompleta | Indicador de «faltan N días de datos» en lugar de cifras |
| Confirmación destructiva | `ConfirmDialog` con el nombre del elemento y la consecuencia |
| Acción reversible | `Toast` de 5 s con «Deshacer» |

Accesibilidad común: objetivos táctiles ≥ 44 pt; `accessibilityRole` y etiqueta en todo control;
orden de foco lógico; foco visible en escritorio; los gráficos tienen resumen textual; el color
nunca es el único portador de información.

## 5. Pantallas

Formato: **Objetivo · Jerarquía · Componentes · Acciones · Navegación · Específico** (vacío,
errores, validaciones, confirmaciones, adaptación, accesibilidad cuando difieren de §4).

### Acceso y primer uso

**1. Splash** — Objetivo: cubrir la carga inicial (fuentes, sesión). Jerarquía: marca centrada sobre `bg`. Componentes: icono + logotipo. Acciones: ninguna. Navegación: → Bienvenida (sin sesión), Onboarding (sin completar) o Hoy. Específico: máx. 1,5 s; sin animación con reducir movimiento.

**2. Bienvenida** — Objetivo: presentar Nebula. Jerarquía: titular («Convierte intenciones en resultados»), una frase, dos botones. Componentes: fondo espacial con constelación abstracta, `Button` primario «Crear cuenta», secundario «Ya tengo cuenta». Navegación: → Registro / Inicio de sesión. Adaptación: escritorio en dos columnas (mensaje | formulario).

**3. Onboarding** — Objetivo: personalizar en ≤ 8 pasos. Jerarquía: progreso (puntos), pregunta, opciones, «Continuar» y «Omitir». Pasos: propósito → áreas de interés (chips multiselección) → objetivos iniciales → estilo motivacional (Equilibrado / Exigente / Intenso con ejemplo de frase) → recordatorios (opcional; pide permiso) → primer hábito o meta (plantillas editables) → listo. Validaciones: el nombre es el único obligatorio (paso de Personalización). Errores: si falla el guardado, se conserva lo elegido y se reintenta.

**4. Inicio de sesión** — Componentes: `TextField` email y contraseña (mostrar/ocultar), «¿Olvidaste tu contraseña?», botones OAuth solo si están configurados. Errores: credenciales inválidas (mensaje genérico, no revela si el email existe), email sin verificar (con «Reenviar»), sin conexión. Accesibilidad: `textContentType`/`autoComplete` correctos.

**5. Registro** — Componentes: nombre visible, `@usuario` (comprobación de disponibilidad), email, contraseña con requisitos visibles. Validaciones: email válido; contraseña ≥ 10 caracteres; handle `^[a-z0-9_]{3,24}$`. Confirmación: pantalla «Revisa tu correo» si la verificación está activa.

**6. Recuperación de contraseña** — Paso 1: email → mensaje neutro («Si existe una cuenta, recibirás un enlace»). Paso 2 (deep link `nebula://`): nueva contraseña ×2. Errores: enlace caducado → volver a solicitar.

**7. Personalización inicial** — Campos: nombre, avatar (galería/archivo; recorte cuadrado), zona horaria (detectada, editable con búsqueda), días activos (selector L–D), franjas de concentración, privacidad por defecto (Privado / Amigos / Público, explicado). Todo editable después en Configuración.

### Núcleo

**8. Panel Hoy** — Objetivo: el día de un vistazo. Jerarquía: (1) fecha + mensaje contextual (motor de motivación, solo si hay contexto real); (2) «Ahora»: siguiente bloque o sesión de enfoque con botón «Empezar»; (3) Hábitos de hoy con registro en un toque; (4) Tareas de hoy y vencidas; (5) Avisos: recuperación de hábitos, retos por terminar, sobrecarga. Acciones: registrar, empezar enfoque, abrir Día viable, crear. Vacío: guía de tres pasos (crear hábito, crear tarea, invitar a un amigo) con acciones reales. Escritorio: dos columnas (Hábitos | Agenda del día).

**9. Lista de hábitos** — Segmentos: Hoy / Todos / Pausados / Archivados. Fila: icono y color, nombre, progreso del periodo (anillo), constancia 30 días, control de registro según tipo. Acciones: registrar, reordenar (arrastrar en escritorio; mantener pulsado en Android), abrir detalle, crear. Vacío por segmento.

**10. Crear / editar hábito** — Secciones: Básico (nombre, icono, color, categoría) → Tipo y objetivo (binario, duración, cantidad, frecuencia, acumulativo, reducción, flexible; con explicación de cada uno) → Calendario (días, horario sugerido, fecha de inicio) → Recordatorios → Meta asociada → Privacidad. Validaciones: objetivo > 0; unidad obligatoria en cantidad/acumulativo; reducción exige límite. Confirmación al cambiar el objetivo: «Se aplicará desde hoy; tu historial conserva el objetivo anterior».

**11. Detalle de hábito** — Jerarquía: progreso del periodo actual, mapa de consistencia (12 semanas), constancia y racha (racha como dato secundario), historial con notas. Acciones: registrar, editar registro (fecha y valor), añadir nota, pausar, archivar, eliminar. Modo recuperación: tarjeta con propuesta de reinicio mínimo cuando hay interrupción.

**12. Estadísticas de hábito** — Tendencia semanal (líneas), comparación con el periodo anterior, distribución por día de la semana y franja horaria. Información incompleta: «Necesitas 14 días de registros para ver tendencias».

**13. Lista de tareas** — Agrupación (Fecha / Prioridad / Proyecto / Etiqueta), filtros, búsqueda, pendientes / completadas. Fila: casilla, título, fecha límite (ámbar si vence hoy, rojo si vencida), prioridad, subtareas n/m. Acciones: completar (animación + deshacer), aplazar, reordenar, abrir. Escritorio: lista + detalle.

**14. Crear / editar tarea** — Título (obligatorio), notas, prioridad, fecha y hora límite, duración estimada, etiquetas, subtareas, recurrencia, recordatorio, proyecto/meta, dependencias. Validación: recurrencia requiere fecha.

**15. Lista de metas** — Tarjetas con progreso medible, fecha objetivo, estado (en curso, en riesgo, completada, abandonada), participantes. Filtros: activas / completadas / compartidas.

**16. Crear meta** — Título, resultado esperado, indicador medible (cantidad + unidad o hitos), fecha objetivo, hábitos y tareas vinculados, visibilidad, participantes. Enlace a «Simular antes de comprometerte».

**17. Detalle de meta** — Progreso acumulado, hitos (línea temporal), vinculados, historial de progreso, participantes y contribuciones. Acciones: registrar avance (si es manual), completar hito, editar, archivar.

**18. Proyecto con dependencias** — Grafo por niveles (izquierda → derecha) con nodos de estado (pendiente, en curso, bloqueado, hecho); los bloqueantes resaltados en ámbar con «Desbloquea N pasos». Alternativa accesible: lista ordenada topológicamente. Validación: la UI impide crear ciclos y la BD los rechaza.

**19. Calendario** — Vistas Día / Semana / Mes. Día: línea temporal con bloques (eventos, tareas programadas, hábitos con horario, sesiones). Semana: 7 columnas en escritorio, 3 días deslizables en Android. Mes: cuadrícula con indicadores de carga. Filtros por categoría. Conflictos marcados con borde ámbar.

**20. Planificación diaria** — Propuesta del planificador (bloques sugeridos con motivo), indicador de carga vs. disponibilidad, Día viable (Completo / Esencial / Recuperación). Acciones: aceptar todo, aceptar uno, mover, dividir, descartar. Nunca se aplica sin confirmación.

**21. Sesión de enfoque** — Temporizador grande (cifras tabulares), objetivo vinculado, modo (Pomodoro, libre, larga), pausar / continuar / terminar antes. Mensaje de inicio contextual. Al terminar: duración real, registro automático en el hábito/tarea, registro opcional de interrupciones (radar). Escritorio: opción de mini-ventana «siempre visible».

**22. Estadísticas de productividad** — KPIs (cumplimiento, foco, terminadas, metas), evolución semanal/mensual, mapa de consistencia anual, distribución por categoría, comparación con el periodo anterior.

**23. Perfil personal** — Cabecera (avatar, nombre, @usuario), accesos a Estadísticas, Metas, Diario, Resumen semanal, Amigos, Configuración. Perfil de productividad (horarios efectivos, hábitos constantes, más aplazadas) cuando haya datos.

### Social

**24. Amigos** — Lista con estado de actividad según privacidad, búsqueda por @usuario o nombre, solicitudes pendientes (contador). Acciones: ver perfil, retar, eliminar, bloquear.

**25. Solicitudes de amistad** — Recibidas / enviadas. Acciones: aceptar, rechazar, cancelar. Vacío honesto.

**26. Círculos** — Lista de círculos; detalle con miembros y roles, retos y objetivos activos, historial. Acciones: crear, invitar, cambiar rol (admin), salir.

**27. Lista de retos** — Segmentos Competencia / En equipo / Pactos (como la maqueta del PDF). Tarjeta: nombre, día n de m, posición o progreso conjunto. Invitaciones pendientes arriba.

**28. Crear competencia** — Asistente: tipo (1 vs. 1, grupal, equipos) → actividad y métrica → objetivos personales (equilibrado: cada uno define el suyo antes del inicio) → fechas y zona → reglas de victoria y desempate (explicadas en lenguaje claro) → invitados → resumen. Validación: unidad común si la métrica es «cantidad»; inicio en el futuro.

**29. Crear objetivo cooperativo** — Modalidad colectiva o distribuida (mínimo por persona), total, unidad, plazo, vínculo con hábito, invitados.

**30. Detalle de reto** — Estado, reglas, tiempo restante, progreso propio y de cada participante, registros puntuables con su origen (autodeclarado / temporizador). Acciones: aceptar condiciones, registrar, abandonar (confirmación).

**31. Clasificación** — Filas con avatar, nombre, % (o métrica), barra, diferencia con el siguiente; nota de la métrica usada («La clasificación usa el porcentaje de cumplimiento de cada participante, no las horas acumuladas»). Tiempo real.

**32. Resultados de competencia** — Podio sobrio (sin trofeos infantiles), resultados finales, desempates aplicados, enlace a «Revancha».

**33. Sala de concentración compartida** — Participantes presentes, temporizador sincronizado, inicio/fin comunes. Privacidad: solo se muestra lo que cada uno permite.

### Inteligencia y reflexión

**34. Asistente de IA** — Conversación + tarjetas de acción (crear hábito, mover bloque…) con vista previa editable y «Aplicar» / «Descartar». Aviso de qué datos se envían. Estado «IA desactivada» con acceso a Configuración.

**35. Simulador de metas** — Entradas: trabajo pendiente, horas/semana, frecuencia, plazo. Salidas: escenarios conservador / medio / exigente; separación «Cálculo» (determinista) y «Estimación» (con historial, etiquetada como tal).

**36. Resumen semanal** — Logros, progreso, pendientes, cambios de constancia, obstáculos registrados, resultados sociales, 3 recomendaciones prácticas.

**37. Diario** — Lista por fecha; entrada con tipo (reflexión, dificultad, aprendizaje, logro), texto, vínculos a actividades y metas.

**38. Centro de notificaciones** — Agrupadas por día; leídas/no leídas; cada una con acción directa (aceptar invitación, abrir reto).

**39. Configuración** — Cuenta, notificaciones (por tipo, silencio, máximo diario), motivación (intensidad), semana (inicio), IA (activar/desactivar), escritorio (iniciar con el sistema, minimizar a la bandeja), exportar datos, cerrar sesión, eliminar cuenta (doble confirmación).

**40. Privacidad y personalización** — Visibilidad por defecto y por tipo de dato, quién puede retarme o encontrarme, usuarios bloqueados, datos usados por la IA.

## 6. Revisión visual

Cada pantalla nueva se captura con `npm run desktop:shots` a 1280×800 (escritorio) y 390×844
(Android) y se revisa contra este documento antes de marcar su tarea como completada.
