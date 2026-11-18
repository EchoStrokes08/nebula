import { EXTRA } from './extra';

/**
 * Biblioteca de mensajes de Nebula (prompt §11, PDF §4). Originales, en español.
 * Reglas editoriales (REGLAS_NEGOCIO §9): directos y orientados a la acción; sin insultos,
 * amenazas, humillación ni culpa por descansar. «intense» solo si el usuario lo elige.
 * Las variables `{x}` solo se rellenan con datos reales del contexto; si falta alguna,
 * el mensaje no es elegible.
 */
export type Category =
  | 'inicio'
  | 'enfoque'
  | 'disciplina'
  | 'procrastinacion'
  | 'habitos'
  | 'metas'
  | 'competencia'
  | 'colaboracion'
  | 'recuperacion'
  | 'resultados'
  | 'constancia'
  | 'cierre';
export type Intensity = 'balanced' | 'demanding' | 'intense';

export interface Message {
  id: string;
  category: Category;
  intensity: Intensity;
  text: string;
}

const m = (category: Category, intensity: Intensity, list: string[]): Message[] =>
  list.map((text, i) => ({ id: `${category}-${intensity[0]}${i + 1}`, category, intensity, text }));

const BASE: Message[] = [
  // Inicio del día
  ...m('inicio', 'balanced', [
    'El futuro que quieres se construye con lo que decides hacer hoy.',
    'No hace falta un día perfecto. Hace falta empezar la primera tarea.',
    'Elige una cosa importante y hazla antes de que el día decida por ti.',
  ]),
  ...m('inicio', 'demanding', [
    'Tu lista de objetivos no significa nada si nunca empiezas.',
    'Otro día esperando motivación es otro día sin avanzar.',
    'Hoy tienes {pendientes} cosas pendientes. Empieza por la que más pesa.',
  ]),
  ...m('inicio', 'intense', [
    'Nadie va a hacer esto por ti. Empieza ahora.',
    'La versión de ti que confía en que mañana será distinto lleva demasiado tiempo al mando.',
  ]),
  // Enfoque
  ...m('enfoque', 'balanced', [
    'Un bloque. Una tarea. Nada más importa durante los próximos minutos.',
    'Silencia lo que distrae. Lo que tienes delante merece tu atención entera.',
    'No necesitas cinco horas. Necesitas estos minutos sin interrupciones.',
  ]),
  ...m('enfoque', 'demanding', [
    'Deja de negociar contigo cada cinco minutos. Empieza el bloque.',
    'El trabajo profundo no aparece solo. Se protege.',
    'Lo difícil se vuelve manejable cuando le das tiempo completo.',
  ]),
  ...m('enfoque', 'intense', [
    'Cada notificación que abres es una decisión. Decide trabajar.',
    'Tu atención es lo más caro que tienes. Deja de regalarla.',
  ]),
  // Disciplina
  ...m('disciplina', 'balanced', [
    'La motivación te hace empezar. La disciplina te mantiene avanzando.',
    'No necesitas querer hacerlo. Necesitas decidir que importa.',
    'Las rutinas pequeñas sostienen los resultados grandes.',
  ]),
  ...m('disciplina', 'demanding', [
    'Tu potencial no tiene valor si nunca lo conviertes en acciones.',
    'El talento llama la atención. La constancia consigue resultados.',
    'No tienes que sentir ganas. Solo tienes que decidir que no hacerlo ya no es una opción.',
  ]),
  ...m('disciplina', 'intense', [
    'Alguien con la mitad de tu talento y el doble de disciplina va a llegar antes.',
    'Lo que haces cuando no te apetece define hasta dónde llegas.',
  ]),
  // Procrastinación
  ...m('procrastinacion', 'balanced', [
    'Hazlo durante diez minutos. Después decides si sigues.',
    'Divide la tarea hasta que el primer paso parezca ridículamente pequeño.',
    'Ya la has movido {aplazamientos} veces. Quizá necesita un primer paso más pequeño.',
  ]),
  ...m('procrastinacion', 'demanding', [
    'Sabes lo que tienes que hacer. Seguir aplazándolo también es una decisión.',
    'Tu problema no siempre es la falta de tiempo. A veces es lo que eliges hacer con él.',
    '«{tarea}» lleva {aplazamientos} aplazamientos. Hoy es un buen día para cerrarla.',
  ]),
  ...m('procrastinacion', 'intense', [
    'Tu futuro no va a esperar a que desaparezcan tus excusas.',
    'Aplazarlo otra vez no lo hace más fácil. Lo hace más urgente.',
  ]),
  // Hábitos
  ...m('habitos', 'balanced', [
    'Todavía te queda «{habito}» por hoy. Unos minutos bastan para mantenerlo vivo.',
    'Un hábito no se construye con días perfectos, sino con días que no se pierden.',
    'Hazlo pequeño si hace falta, pero hazlo.',
  ]),
  ...m('habitos', 'demanding', [
    'Repetirlo hoy es lo que lo convierte en parte de ti.',
    '«{habito}» sigue pendiente. El día aún no ha terminado.',
    'La versión mínima cuenta. No hacer nada, no.',
  ]),
  ...m('habitos', 'intense', [
    'Cada día que lo dejas pasar, el hábito se vuelve un deseo. Recupéralo hoy.',
    'Las promesas que te haces también cuentan. Cumple esta.',
  ]),
  // Metas
  ...m('metas', 'balanced', [
    'Quedan {dias} días para «{meta}». Un avance hoy hace el plazo más amable.',
    'Las metas grandes se alcanzan con pasos que parecen insignificantes.',
    'Mira lo que ya llevas hecho. El resto está a la misma distancia de siempre: un paso.',
  ]),
  ...m('metas', 'demanding', [
    'El plazo de «{meta}» no se mueve. Tu ritmo sí puede hacerlo.',
    'Una meta sin acciones de esta semana es solo un deseo con fecha.',
    'Te faltan {restante} para «{meta}». Decide hoy cuánto avanzas.',
  ]),
  ...m('metas', 'intense', [
    'Imagina terminar con exactamente la vida que no querías porque esto resultó incómodo.',
    'Algún día tendrás que vivir con las decisiones de hoy. Que sean buenas.',
  ]),
  // Competencia
  ...m('competencia', 'balanced', [
    'El marcador todavía puede cambiar. Lo que hagas hoy cuenta.',
    'No tienes que ser el mejor hoy. Tienes que hacer algo para ser mejor mañana.',
    'Compites contra tu objetivo, no contra el de los demás.',
  ]),
  ...m('competencia', 'demanding', [
    'El marcador todavía puede cambiar. Pero no mientras sigas esperando.',
    'Quedan {dias} días de reto y vas en el puesto {posicion}. Hay margen para remontar.',
    'Te separa un {diferencia} del siguiente puesto. Es alcanzable hoy.',
  ]),
  ...m('competencia', 'intense', [
    'Alguien está aprovechando el tiempo que tú estás dejando pasar.',
    'Mientras descansas sin haber empezado, el marcador sigue corriendo.',
  ]),
  // Colaboración
  ...m('colaboracion', 'balanced', [
    'Tu equipo lleva {progreso} del objetivo. Tu aporte de hoy se nota.',
    'Avanzar acompañado es más fácil. Haz tu parte.',
    'Cuando cumples, también ayudas a quien va contigo.',
  ]),
  ...m('colaboracion', 'demanding', [
    'Hay gente contando contigo. Tu parte sigue pendiente.',
    'Un objetivo compartido se cae si cada uno espera a que lo empuje otro.',
  ]),
  ...m('colaboracion', 'intense', ['Tu equipo ya se movió. Ahora te toca a ti.']),
  // Recuperación (nunca culpa por descansar)
  ...m('recuperacion', 'balanced', [
    'No puedes recuperar ayer. Todavía puedes decidir qué hacer hoy.',
    'Un mal día no define tu progreso. Lo que haces después sí importa.',
    'Llevas {dias} días sin «{habito}». Hoy puedes reiniciar con {minimo}.',
  ]),
  ...m('recuperacion', 'demanding', [
    'El objetivo sigue ahí. Vuelve a trabajar por él.',
    'Retomarlo cuesta menos de lo que crees. Empieza por la versión mínima.',
    'Volver es más importante que no haberse ido nunca.',
  ]),
  ...m('recuperacion', 'intense', ['Se acabó la pausa sin plan. Hoy vuelves, aunque sea con poco.']),
  // Resultados
  ...m('resultados', 'balanced', [
    'Esta semana cumpliste el {constancia} de lo que te propusiste. Eso es progreso real.',
    'Lo que hiciste esta semana ya forma parte de tu historial. Nadie te lo quita.',
    'Mira el camino recorrido antes de mirar el que falta.',
  ]),
  ...m('resultados', 'demanding', [
    'Buen ritmo. Ahora el reto es mantenerlo cuando no apetezca.',
    'Has completado {completadas} tareas esta semana. La siguiente semana se gana desde el lunes.',
  ]),
  ...m('resultados', 'intense', ['Lo hiciste. Ahora demuestra que no fue casualidad.']),
  // Constancia
  ...m('constancia', 'balanced', [
    'La constancia no es no fallar nunca. Es volver siempre.',
    'Un día más suma más de lo que parece.',
    'Llevas {racha} días seguidos. Protege el siguiente.',
  ]),
  ...m('constancia', 'demanding', [
    'Lo que repites define lo que llegas a ser.',
    'El peso de no intentarlo dura mucho más que la incomodidad de hacerlo hoy.',
  ]),
  ...m('constancia', 'intense', ['La vida que quieres no pregunta lo cansado que estás. Pregunta qué hiciste.']),
  // Cierre del día
  ...m('cierre', 'balanced', [
    'Revisa tu día: lo que hiciste también cuenta, aunque no fuera todo.',
    'Mañana empieza esta noche: deja elegida la primera tarea.',
    'Descansar también es parte del plan. Recarga para mañana.',
  ]),
  ...m('cierre', 'demanding', [
    'Quedan {pendientes} cosas abiertas. Decide ahora cuáles van mañana.',
    'Termina el día cerrando una tarea, aunque sea pequeña.',
  ]),
  ...m('cierre', 'intense', ['Antes de dormir, una pregunta honesta: ¿hoy avanzaste en lo que dices que importa?']),
];

export const LIBRARY: Message[] = [...BASE, ...EXTRA];

/** Lista de comprobación editorial (test): palabras que no pueden aparecer. */
export const FORBIDDEN = ['inútil', 'fracasado', 'vago', 'perdedor', 'idiota', 'estúpido', 'vergüenza', 'patético', 'deberías avergonzarte'];
