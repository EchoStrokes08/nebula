import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/** Sonidos de fondo del modo Enfoque (generados por scripts/generate-focus-sounds.py). */
export type FocusSound = 'none' | 'lluvia' | 'ruido-marron';

export const FOCUS_SOUNDS: { value: FocusSound; label: string }[] = [
  { value: 'none', label: 'Silencio' },
  { value: 'lluvia', label: 'Lluvia' },
  { value: 'ruido-marron', label: 'Ruido marrón' },
];

const SOURCES = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- recursos de Metro
  lluvia: require('../../../assets/sounds/lluvia.ogg'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- recursos de Metro
  'ruido-marron': require('../../../assets/sounds/ruido-marron.ogg'),
} as const;

let player: AudioPlayer | null = null;
let current: FocusSound = 'none';

/** Reproduce en bucle el sonido elegido (o lo para con 'none'). Nunca lanza: el sonido es opcional. */
export async function playFocusSound(sound: FocusSound, volume = 0.6): Promise<void> {
  try {
    if (sound === current && player) { player.volume = volume; player.play(); return; }
    stopFocusSound();
    if (sound === 'none') return;
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
    player = createAudioPlayer(SOURCES[sound]);
    player.loop = true;
    player.volume = volume;
    player.play();
    current = sound;
  } catch {
    stopFocusSound();
  }
}

export function pauseFocusSound(): void {
  try { player?.pause(); } catch { /* sin reproductor */ }
}

export function stopFocusSound(): void {
  try { player?.pause(); player?.remove(); } catch { /* ya liberado */ }
  player = null;
  current = 'none';
}
