// Falla antes de generar un instalador que solo muestre la pantalla de configuración.
const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length || process.env.EXPO_PUBLIC_DEV_PREVIEW_UI === '1') {
  console.error('Build de distribución inválido. Configura las variables públicas de Supabase y desactiva la vista previa.');
  process.exit(1);
}
try {
  if (new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).protocol !== 'https:') throw new Error();
} catch { console.error('La URL de Supabase debe ser HTTPS.'); process.exit(1); }
console.log('Configuración pública de distribución válida.');
