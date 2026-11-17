/** Traduce errores de Supabase Auth a mensajes comprensibles (sin revelar si un email existe). */
export function authErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number } | null;
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials'))
    return 'El correo o la contraseña no son correctos.';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.';
  if (code === 'user_already_exists' || msg.includes('already registered'))
    return 'No se pudo crear la cuenta con ese correo. Si ya tienes una, inicia sesión.';
  if (code === 'weak_password') return 'La contraseña es demasiado débil.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e?.status === 429)
    return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  if (code === 'same_password') return 'La nueva contraseña debe ser distinta de la anterior.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Sin conexión con el servidor. Comprueba tu red.';
  return 'Algo salió mal. Inténtalo de nuevo.';
}
