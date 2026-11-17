#!/usr/bin/env bash
# Genera un APK independiente (JS empaquetado, no necesita Metro) en release/nebula.apk.
# Usa las variables EXPO_PUBLIC_* de .env. Firmado con la clave de depuración salvo que
# android/app/build.gradle se configure con un keystore propio (F13-004).
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease --console=plain)
mkdir -p release
cp android/app/build/outputs/apk/release/app-release.apk release/nebula.apk
echo "APK listo: release/nebula.apk"
