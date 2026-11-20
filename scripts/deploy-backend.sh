#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./node_modules/.bin/supabase projects list --output json >/dev/null
: "${NEBULA_SUPABASE_PROJECT_REF:?Define NEBULA_SUPABASE_PROJECT_REF}"
test -f .env.server.local || { echo 'Falta .env.server.local. Ejecuta python3 scripts/configure-groq.py'; exit 1; }
npm run check
npm run db:push
./node_modules/.bin/supabase secrets set --project-ref "$NEBULA_SUPABASE_PROJECT_REF" --env-file .env.server.local
./node_modules/.bin/supabase functions deploy ai-assist --project-ref "$NEBULA_SUPABASE_PROJECT_REF" --no-verify-jwt
./node_modules/.bin/supabase functions deploy account-delete --project-ref "$NEBULA_SUPABASE_PROJECT_REF" --no-verify-jwt
./node_modules/.bin/supabase functions deploy ai-health --project-ref "$NEBULA_SUPABASE_PROJECT_REF" --no-verify-jwt
./node_modules/.bin/supabase functions deploy google-calendar --project-ref "$NEBULA_SUPABASE_PROJECT_REF" --no-verify-jwt
