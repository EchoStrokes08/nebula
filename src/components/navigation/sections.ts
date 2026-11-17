import { CalendarDays, Flag, Repeat, Sun, UserRound, type LucideIcon } from 'lucide-react-native';

export interface Section {
  name: 'hoy' | 'habitos' | 'agenda' | 'retos' | 'perfil';
  href: '/hoy' | '/habitos' | '/agenda' | '/retos' | '/perfil';
  label: string;
  icon: LucideIcon;
}

/** Las cinco secciones principales (PDF §6: palabras normales). */
export const sections: readonly Section[] = [
  { name: 'hoy', href: '/hoy', label: 'Hoy', icon: Sun },
  { name: 'habitos', href: '/habitos', label: 'Hábitos', icon: Repeat },
  { name: 'agenda', href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { name: 'retos', href: '/retos', label: 'Retos', icon: Flag },
  { name: 'perfil', href: '/perfil', label: 'Perfil', icon: UserRound },
];

/** Punto de corte a partir del cual se usa la barra lateral (escritorio). */
export const SIDEBAR_BREAKPOINT = 900;

export const navLayoutFor = (width: number): 'bottom' | 'sidebar' =>
  width >= SIDEBAR_BREAKPOINT ? 'sidebar' : 'bottom';
