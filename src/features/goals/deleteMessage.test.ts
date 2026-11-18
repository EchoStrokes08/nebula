import { deleteGoalMessage } from './deleteMessage';

it('avisa de las tareas y hábitos que se borran con la meta', () => {
  expect(deleteGoalMessage('Aprender Python', 5, 1)).toBe('Se borrarán «Aprender Python», sus hitos y su historial, junto con 5 tareas y 1 hábito con sus registros de esta meta. No se puede deshacer.');
  expect(deleteGoalMessage('Correr', 1, 0)).toContain('junto con 1 tarea de esta meta');
  expect(deleteGoalMessage('Leer', 0, 0)).toBe('Se borrarán «Leer», sus hitos y su historial. No se puede deshacer.');
});
