export type AuthSessionResult = { type: 'success'; url: string } | { type: 'cancel' } | { type: 'redirect' };

/** Flujo OAuth por plataforma: prepara la URL de retorno y abre el proveedor. */
export interface OAuthAdapter {
  /** URL a la que el proveedor devolverá el control (debe estar en las Redirect URLs de Supabase). */
  prepareRedirect(): Promise<string>;
  /** Abre la URL de autorización y espera la vuelta con `?code=…`. */
  open(authUrl: string, redirectUrl: string): Promise<AuthSessionResult>;
}
