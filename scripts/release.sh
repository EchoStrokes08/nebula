#!/usr/bin/env bash
# Publica una versión nueva de Nebula de una sola vez:
#   npm run release -- 1.1.0 "Novedades de esta versión"
# 1) sube version y android.versionCode en app.json   2) comprueba tipos, lint y tests
# 3) compila el APK (arm64)   4) publica la web + APK en GitHub Pages
# 5) commit + etiqueta en main   6) crea la release de GitHub con el APK
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
NOTES="${2:-}"
REPO="EchoStrokes08/nebula"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Uso: npm run release -- <versión X.Y.Z> [\"notas\"]"; exit 1
fi
git fetch -q --tags origin
if git rev-parse "v$VERSION" >/dev/null 2>&1; then echo "La etiqueta v$VERSION ya existe."; exit 1; fi
command -v gh >/dev/null || { echo "Falta GitHub CLI (gh)."; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo "Ejecuta la release desde la rama main."; exit 1; }

step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }

step "1/6 Versión $VERSION"
CODE=$(node -e '
  const fs = require("fs"); const f = "app.json"; const j = JSON.parse(fs.readFileSync(f, "utf8"));
  // Idempotente: si una ejecución anterior falló a medias, no vuelve a subir el versionCode.
  if (j.expo.version !== process.argv[1]) {
    j.expo.version = process.argv[1];
    j.expo.android.versionCode = (j.expo.android.versionCode ?? 1) + 1;
  }
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  console.log(j.expo.android.versionCode);
' "$VERSION")
echo "version $VERSION · versionCode $CODE"

step "2/6 Comprobaciones"
npx tsc --noEmit
npx eslint .
npx jest --selectProjects app --silent

step "3/6 APK"
export JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain -q)
mkdir -p release
cp android/app/build/outputs/apk/release/app-release.apk release/nebula.apk
ls -lh release/nebula.apk

step "4/6 Web en GitHub Pages"
rm -rf .pages-dist
EXPO_BASE_URL=/nebula npx expo export --platform web --output-dir .pages-dist
node scripts/scan-bundle.cjs .pages-dist
cp release/nebula.apk .pages-dist/nebula.apk
cp .pages-dist/index.html .pages-dist/404.html
touch .pages-dist/.nojekyll
(
  cd .pages-dist
  git init -q -b gh-pages
  git add -A
  git commit -q -m "Publicar Nebula $VERSION"
  git push -q -f "git@github.com:$REPO.git" gh-pages
  rm -rf .git
)

step "5/6 Commit y etiqueta"
git add app.json
git commit -q -m "Versión $VERSION" || true
git tag -a "v$VERSION" -m "Nebula $VERSION"
git push -q origin main "v$VERSION"

step "6/6 Release de GitHub"
if [ -z "$NOTES" ]; then
  PREV=$(git describe --tags --abbrev=0 "v$VERSION^" 2>/dev/null || true)
  NOTES=$(git log --pretty='- %s' ${PREV:+"$PREV"..}"v$VERSION^" | grep -v '^- Versión ' | head -30)
fi
gh release create "v$VERSION" release/nebula.apk --repo "$REPO" --title "Nebula $VERSION" \
  --notes "$NOTES

Descarga directa: https://echostrokes08.github.io/nebula/nebula.apk · Web: https://echostrokes08.github.io/nebula/"

printf '\n\033[1;32m✓ Nebula %s publicada\033[0m\n' "$VERSION"
echo "  Web: https://echostrokes08.github.io/nebula/ (GitHub Pages tarda ~1 min en actualizar)"
echo "  APK: https://echostrokes08.github.io/nebula/nebula.apk"
echo "  Instalar por cable: adb install -r release/nebula.apk"
