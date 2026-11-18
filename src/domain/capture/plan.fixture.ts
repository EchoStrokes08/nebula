/** Plan de ejemplo compartido por los tests. */
export const samplePlan = {
  type: 'create_plan', goalId: null, goal: 'Aprender Python básico', why: 'Fundamentos primero, luego proyectos pequeños.', day: '2027-02-01',
  milestones: ['Sintaxis y tipos', 'Funciones', 'Primer proyecto'],
  tasks: [{ title: 'Instalar Python y VS Code', day: '2026-11-18', minutes: 30, priority: 2, study: 'Instalar y ejecutar hola mundo.', resources: [{ title: 'Python.org', url: 'https://www.python.org/downloads/', note: null }] }],
  habits: [{ title: 'Practicar Python', minutes: 25, days: [1, 3, 5], time: '19:00', study: 'Un ejercicio al día.', resources: [{ title: 'Exercism', url: 'https://exercism.org/tracks/python', note: 'Ejercicios con mentoría' }] }],
  resources: [{ title: 'Tutorial oficial', url: 'https://docs.python.org/es/3/tutorial/', note: 'Referencia' }],
} as const;
