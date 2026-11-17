import { useEffect, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
export function VoiceCapture({ onText }: { onText(text: string): void }) {
  const [listening, setListening] = useState(false); const [error, setError] = useState('');
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (e) => { if (e.results[0]?.transcript) onText(e.results[0].transcript); });
  useSpeechRecognitionEvent('error', () => { setListening(false); setError('No se pudo reconocer la voz. Puedes escribir la actividad.'); });
  useEffect(() => () => { ExpoSpeechRecognitionModule.abort(); }, []);
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return null;
  return <>
    <Text variant="caption" tone="secondary">El reconocimiento lo realiza el servicio de voz del sistema. Revisa siempre el texto antes de guardar.</Text>
    <Button label={listening ? 'Terminar dictado' : 'Dictar actividad'} variant="secondary" onPress={async () => {
      if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
      setError('');
      try {
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!permission.granted) { setError('Permite el micrófono para dictar.'); return; }
        ExpoSpeechRecognitionModule.start({ lang: 'es-CO', interimResults: true, continuous: false });
      } catch { setError('El reconocimiento no está disponible. Puedes escribir la actividad.'); }
    }} />
    {error ? <Text tone="warning">{error}</Text> : null}
  </>;
}
