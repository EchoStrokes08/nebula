const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Aviso de borrado: dice exactamente qué se va a perder (no se puede deshacer). */
export function deleteGoalMessage(title: string, tasks: number, habits: number): string {
  const linked = [tasks ? plural(tasks, 'tarea', 'tareas') : '', habits ? plural(habits, 'hábito', 'hábitos') + ' con sus registros' : ''].filter(Boolean).join(' y ');
  return `Se borrarán «${title}», sus hitos y su historial${linked ? `, junto con ${linked} de esta meta` : ''}. No se puede deshacer.`;
}
