import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { VoiceCapture } from '@/platform/VoiceCapture';
import { parseCapture } from '@/domain/capture/parser';
import { describeAction, applyAction } from '@/features/intelligence/apply';
import { useTimeZone } from '@/features/habits/useToday';

export default function Captura() {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const tz = useTimeZone();
  const preview = useMemo(() => parseCapture(text, new Date(), tz), [text, tz]);
  return <Screen title="Captura rápida" back={{ fallback: '/hoy' }}>
    <Text tone="secondary">Escribe una tarea, hábito, meta o evento. Revisa la propuesta antes de guardarla.</Text>
    <TextField label="¿Qué tienes en mente?" value={text} onChangeText={(v) => { setText(v); setMessage(''); }} multiline maxLength={1000} placeholder="Leer mañana a las 18:00 durante 20 min" autoFocus />
    <VoiceCapture onText={setText} />
    {text ? preview.warnings.map((w) => <Text key={w} tone="warning">{w}</Text>) : null}
    {preview.action ? <><Text variant="title3">Vista previa</Text><Text>{describeAction(preview.action)}</Text><Button label="Confirmar y guardar" loading={busy} onPress={async () => {
      if (!preview.action) return;
      setBusy(true); setMessage('');
      try { await applyAction(preview.action, tz); setText(''); setMessage('Guardado. Puedes capturar otra idea.'); }
      catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo guardar. Reintenta.'); }
      finally { setBusy(false); }
    }} /></> : null}
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
    <Button label="Abrir asistente" variant="secondary" onPress={() => router.push('/asistente')} />
  </Screen>;
}
