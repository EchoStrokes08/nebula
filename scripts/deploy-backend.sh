#!/usr/bin/env bash
# Despliega el backend en producción lo más rápido posible:
#   npm run deploy:backend              comprueba y sube solo lo que cambió desde el último despliegue
#   npm run deploy:backend -- --todo    vuelve a subir todas las funciones y los secretos
#   npm run deploy:backend -- --sin-comprobaciones   (si ya pasaron, p. ej. justo antes de una release)
# Orden: comprobaciones (en paralelo) → migraciones → secretos y funciones (a la vez).
# Las funciones se empaquetan en los servidores de Supabase (--use-api, sin Docker) y en paralelo.
# Ejecutar este script es la confirmación: se pasa --yes a la CLI, que si no se niega a tocar producción.
set -euo pipefail
cd "$(dirname "$0")/.."

TODO=0; CHECKS=1
for arg in "$@"; do
  case "$arg" in
    --todo) TODO=1 ;;
    --sin-comprobaciones) CHECKS=0 ;;
    *) echo "Opción desconocida: $arg"; exit 1 ;;
  esac
done

SUPABASE=./node_modules/.bin/supabase
REF="${NEBULA_SUPABASE_PROJECT_REF:-$(sed -n 's#^EXPO_PUBLIC_SUPABASE_URL=https://\([a-z0-9]*\)\.supabase\.co.*#\1#p' .env 2>/dev/null | head -1)}"
[ -n "$REF" ] || { echo 'No se encontró el proyecto: define NEBULA_SUPABASE_PROJECT_REF o EXPO_PUBLIC_SUPABASE_URL en .env'; exit 1; }
test -f .env.server.local || { echo 'Falta .env.server.local. Ejecuta python3 scripts/configure-groq.py'; exit 1; }

# Huellas de lo ya desplegado (solo en esta máquina; --todo las ignora).
STATE=node_modules/.cache/nebula-deploy
mkdir -p "$STATE"
hash_of() { find "$@" -type f -print0 2>/dev/null | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64; }
changed() { [ "$TODO" = 1 ] || [ "$(cat "$STATE/$1" 2>/dev/null)" != "$2" ]; }

step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }
S0=$(date +%s)

# La sesión de la CLI se comprueba a la vez que las pruebas.
step "Comprobaciones y sesión de Supabase"
pids=()
"$SUPABASE" projects list --output json >/dev/null & pids+=($!)
if [ "$CHECKS" = 1 ]; then
  npx tsc --noEmit & pids+=($!)
  npx eslint . & pids+=($!)
  npm run -s test:all -- --silent & pids+=($!)
  npm run -s test:desktop >/dev/null & pids+=($!)
fi
for p in "${pids[@]}"; do wait "$p"; done

step "Migraciones"
bash scripts/db-push.sh --yes

step "Secretos y funciones"
SHARED=$(hash_of supabase/functions/_shared supabase/functions/deno.json supabase/config.toml)
FUNCS=(); HASHES=()
for dir in supabase/functions/*/; do
  name=$(basename "$dir")
  [ "$name" = _shared ] && continue
  h=$(printf '%s %s' "$SHARED" "$(hash_of "$dir")" | sha256sum | cut -c1-64)
  if changed "fn-$name" "$h"; then FUNCS+=("$name"); HASHES+=("$h"); fi
done
SECRETS=$(hash_of .env.server.local)

pids=()
if changed secrets "$SECRETS"; then
  ( "$SUPABASE" secrets set --remote="$REF" --env-file .env.server.local --yes && echo "$SECRETS" > "$STATE/secrets" ) & pids+=($!)
else echo "Secretos sin cambios."; fi
if [ ${#FUNCS[@]} -gt 0 ]; then
  echo "Funciones: ${FUNCS[*]}"
  (
    "$SUPABASE" functions deploy "${FUNCS[@]}" --remote="$REF" --no-verify-jwt --use-api --jobs "${#FUNCS[@]}" --yes
    for i in "${!FUNCS[@]}"; do echo "${HASHES[$i]}" > "$STATE/fn-${FUNCS[$i]}"; done
  ) & pids+=($!)
else echo "Funciones sin cambios."; fi
for p in "${pids[@]}"; do wait "$p"; done

printf '\n\033[1;32m✓ Backend desplegado en %ss\033[0m\n' "$(( $(date +%s) - S0 ))"
