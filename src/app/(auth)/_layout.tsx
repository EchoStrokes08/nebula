import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'bienvenida' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'fade' }} />;
}
