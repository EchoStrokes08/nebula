#!/usr/bin/env bash
# Aplica las migraciones pendientes de supabase/migrations al proyecto remoto.
# Lee SUPABASE_DB_URL de .env (cadena del pooler IPv4; la contraseña va codificada en URL).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL en .env}"
# Se invoca el binario directamente: `npx` imprimiría el comando con la contraseña.
exec ./node_modules/.bin/supabase db push --db-url "$SUPABASE_DB_URL" "$@"
