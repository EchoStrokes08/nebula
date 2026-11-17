import { createElement } from 'react';
import {
  BookOpen,
  Brain,
  Circle,
  Code,
  CupSoda,
  Droplet,
  Dumbbell,
  Footprints,
  HeartPulse,
  Languages,
  Moon,
  Music,
  PenLine,
  Smartphone,
  Sprout,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';

/** Catálogo curado de iconos de hábito (nombres guardados en BD, `^[a-z0-9-]+$`). */
export const HABIT_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  circle: { icon: Circle, label: 'Genérico' },
  'book-open': { icon: BookOpen, label: 'Lectura' },
  languages: { icon: Languages, label: 'Idiomas' },
  code: { icon: Code, label: 'Programación' },
  brain: { icon: Brain, label: 'Estudio' },
  'pen-line': { icon: PenLine, label: 'Escritura' },
  dumbbell: { icon: Dumbbell, label: 'Fuerza' },
  footprints: { icon: Footprints, label: 'Caminar o correr' },
  'heart-pulse': { icon: HeartPulse, label: 'Salud' },
  droplet: { icon: Droplet, label: 'Agua' },
  moon: { icon: Moon, label: 'Sueño' },
  sprout: { icon: Sprout, label: 'Meditación' },
  music: { icon: Music, label: 'Música' },
  wallet: { icon: Wallet, label: 'Finanzas' },
  smartphone: { icon: Smartphone, label: 'Pantallas' },
  'cup-soda': { icon: CupSoda, label: 'Bebidas' },
};

export const habitIcon = (name: string): LucideIcon => HABIT_ICONS[name]?.icon ?? Circle;

/** Icono de hábito por nombre (evita crear componentes durante el render). */
export function HabitIcon({ name, size, color, strokeWidth }: { name: string; size: number; color: string; strokeWidth?: number }) {
  return createElement(habitIcon(name), { size, color, strokeWidth });
}
