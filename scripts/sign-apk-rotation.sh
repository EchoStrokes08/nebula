#!/usr/bin/env bash
# Vuelve a firmar un APK con rotación de clave (APK Signature Scheme v3, Android 9+):
# la clave de depuración con la que se firmaron las versiones 1.0.0–1.2.3 certifica a la clave
# propia de Nebula, así que esas instalaciones se actualizan encima sin desinstalar.
#   bash scripts/sign-apk-rotation.sh release/nebula.apk
# La primera vez crea la cadena de rotación en ~/.local/share/nebula-firma/rotacion.lineage.
# Ver docs/FIRMA_ANDROID.md.
set -euo pipefail
cd "$(dirname "$0")/.."
APK="${1:-release/nebula.apk}"
DIR="$HOME/.local/share/nebula-firma"
OLD_KS="$DIR/clave-antigua-debug.keystore"
LINEAGE="$DIR/rotacion.lineage"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)/apksigner"

prop() { sed -n "s/^$1=//p" "$HOME/.gradle/gradle.properties" | tail -1; }
NEW_KS="$(prop NEBULA_UPLOAD_STORE_FILE)"
NEW_ALIAS="$(prop NEBULA_UPLOAD_KEY_ALIAS)"
export NEBULA_KS_PASS="$(prop NEBULA_UPLOAD_STORE_PASSWORD)"
export NEBULA_KEY_PASS="$(prop NEBULA_UPLOAD_KEY_PASSWORD)"
[ -n "$NEW_KS" ] || { echo "Falta la clave de firma de Nebula en ~/.gradle/gradle.properties."; exit 1; }

# La clave antigua es la de depuración estándar de React Native (alias androiddebugkey, contraseña android).
if [ ! -f "$OLD_KS" ]; then cp android/app/debug.keystore "$OLD_KS"; fi
OLD=(--ks "$OLD_KS" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android)
NEW=(--ks "$NEW_KS" --ks-key-alias "$NEW_ALIAS" --ks-pass env:NEBULA_KS_PASS --key-pass env:NEBULA_KEY_PASS)

if [ ! -f "$LINEAGE" ]; then
  "$APKSIGNER" rotate --out "$LINEAGE" --old-signer "${OLD[@]}" --new-signer "${NEW[@]}"
  echo "Cadena de rotación creada: $LINEAGE (haz copia de seguridad junto al .jks)"
fi

# v1/v2 con la clave antigua (lo que reconocen las instalaciones previas en Android < 9);
# v3 con la nueva + la cadena desde Android 9 (API 28).
"$APKSIGNER" sign "${OLD[@]}" --next-signer "${NEW[@]}" --lineage "$LINEAGE" \
  --rotation-min-sdk-version 28 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true "$APK"
"$APKSIGNER" verify --print-certs -v "$APK" | grep -E "^Verified using|SHA-256" | sed -n 1,12p
