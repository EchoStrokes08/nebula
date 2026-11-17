// Configuración de Metro: la de Expo, excluyendo lo que nunca debe entrar en el bundle cliente.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// En desarrollo Expo vigila los archivos `*.local`; los secretos de servidor (`.env.server.local`)
// y el código Deno de `supabase/` no pueden resolverse ni empaquetarse.
const blocked = [/[\\/]\.env\.server(\.[^\\/]*)?$/, /[\\/]supabase[\\/]/];
const prior = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(prior) ? prior : prior ? [prior] : []), ...blocked];

module.exports = config;
