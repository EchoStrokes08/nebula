import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
export function VoiceCapture({ onText }: { onText(text: string): void }) {
  const [listening, setListening] = useState(false); const [error, setError] = useState(''); const [blocked, setBlocked] = useState(false);
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
        if (!permission.granted) {
          // Denegado para siempre: Android ya no muestra el diálogo, hay que ir a los ajustes de la app.
          setBlocked(!permission.canAskAgain);
          setError(permission.canAskAgain ? 'Permite el micrófono para dictar.' : 'El micrófono está bloqueado para Nebula. Actívalo en los ajustes de la app.');
          return;
        }
        setBlocked(false);
        ExpoSpeechRecognitionModule.start({ lang: 'es-CO', interimResults: true, continuous: false });
      } catch { setError('El reconocimiento no está disponible. Puedes escribir la actividad.'); }
    }} />
    {error ? <Text tone="warning">{error}</Text> : null}
    {blocked ? <Button label="Abrir ajustes de la app" variant="ghost" onPress={() => void Linking.openSettings()} /> : null}
  </>;
}
