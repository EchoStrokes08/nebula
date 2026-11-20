import type { Intensity } from './library';

/**
 * Frases célebres de filósofos y autores de productividad, agrupadas por nivel de exigencia.
 * Solo citas con atribución documentada (obra indicada en `source`); traducciones al español
 * fieles al sentido. Se evitan las atribuciones apócrifas que circulan por internet.
 */
export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
  intensity: Intensity;
}

const q = (intensity: Intensity, list: [string, string, string?][]): Quote[] =>
  list.map(([text, author, source], i) => ({ id: `${intensity[0]}${i + 1}`, text, author, source, intensity }));

export const QUOTES: Quote[] = [
  ...q('balanced', [
    ['Un viaje de mil leguas comienza con un solo paso.', 'Lao-Tse', 'Tao Te Ching, 64'],
    ['Quien ha empezado tiene la mitad hecha.', 'Horacio', 'Epístolas I, 2'],
    ['Ninguna cosa grande se produce de repente.', 'Epicteto', 'Disertaciones I, 15'],
    ['Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.', 'Will Durant', 'resumiendo a Aristóteles en «Historia de la filosofía»'],
    ['La virtud moral es fruto de la costumbre.', 'Aristóteles', 'Ética a Nicómaco II, 1'],
    ['Ningún viento es favorable para quien no sabe a qué puerto se dirige.', 'Séneca', 'Cartas a Lucilio, 71'],
    ['Tu mente está para tener ideas, no para guardarlas.', 'David Allen', 'Organízate con eficacia'],
    ['Cada acción que realizas es un voto por el tipo de persona que quieres llegar a ser.', 'James Clear', 'Hábitos atómicos'],
    ['La clave no está en priorizar lo que hay en tu agenda, sino en agendar tus prioridades.', 'Stephen R. Covey', 'Primero, lo primero'],
    ['No son las cosas las que nos perturban, sino las opiniones que tenemos sobre ellas.', 'Epicteto', 'Enquiridión, 5'],
    ['Sufrimos más a menudo en la imaginación que en la realidad.', 'Séneca', 'Cartas a Lucilio, 13'],
    ['Los hábitos son el interés compuesto de la mejora personal.', 'James Clear', 'Hábitos atómicos'],
  ]),
  ...q('demanding', [
    ['No es que tengamos poco tiempo, es que perdemos mucho.', 'Séneca', 'Sobre la brevedad de la vida'],
    ['Bien hecho es mejor que bien dicho.', 'Benjamin Franklin', 'Almanaque del pobre Richard'],
    ['El tiempo perdido nunca se vuelve a encontrar.', 'Benjamin Franklin', 'Almanaque del pobre Richard'],
    ['No hay nada tan inútil como hacer con gran eficiencia algo que no debería hacerse en absoluto.', 'Peter Drucker'],
    ['No te elevas al nivel de tus metas. Caes al nivel de tus sistemas.', 'James Clear', 'Hábitos atómicos'],
    ['No sigas discutiendo qué tiene que ser un hombre bueno. Sélo.', 'Marco Aurelio', 'Meditaciones X, 16'],
    ['Primero dite a ti mismo qué quieres ser; después haz lo que tengas que hacer.', 'Epicteto', 'Disertaciones III, 23'],
    ['El trabajo se expande hasta llenar el tiempo disponible para completarlo.', 'C. Northcote Parkinson', 'La ley de Parkinson'],
    ['La disciplina es el puente entre las metas y los logros.', 'Jim Rohn'],
  ]),
  ...q('intense', [
    ['Mientras se aplaza, la vida pasa de largo.', 'Séneca', 'Cartas a Lucilio, 1'],
    ['Al amanecer, cuando te cueste levantarte, piensa: me levanto para hacer el trabajo de un ser humano.', 'Marco Aurelio', 'Meditaciones V, 1'],
    ['Lo que impide la acción hace avanzar la acción. Lo que se interpone en el camino se convierte en el camino.', 'Marco Aurelio', 'Meditaciones V, 20'],
    ['Quien tiene un porqué para vivir puede soportar casi cualquier cómo.', 'Friedrich Nietzsche', 'El ocaso de los ídolos'],
    ['El genio es un uno por ciento de inspiración y un noventa y nueve por ciento de transpiración.', 'Thomas A. Edison'],
    ['Haz cada acto de tu vida como si fuera el último.', 'Marco Aurelio', 'Meditaciones II, 5'],
    ['Empieza a vivir de una vez, y cuenta cada día como una vida aparte.', 'Séneca', 'Cartas a Lucilio, 101'],
  ]),
];

export const quoteById = (id: string) => QUOTES.find((x) => x.id === id);
