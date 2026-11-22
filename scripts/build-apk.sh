#!/usr/bin/env bash
# Genera un APK independiente (JS empaquetado, no necesita Metro) en release/nebula.apk.
# Usa las variables EXPO_PUBLIC_* de .env. Firmado con la clave propia de Nebula
# (plugins/withReleaseSigning.js, ver docs/FIRMA_ANDROID.md).
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
npx expo prebuild --platform android --no-install
# Solo arm64 (todos los móviles actuales); NEBULA_ARCHS=armeabi-v7a,arm64-v8a,x86,x86_64 para el resto.
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures="${NEBULA_ARCHS:-arm64-v8a}" --console=plain)
mkdir -p release
cp android/app/build/outputs/apk/release/app-release.apk release/nebula.apk
bash scripts/sign-apk-rotation.sh release/nebula.apk
echo "APK listo: release/nebula.apk"
