#!/usr/bin/env bash
# Publica una versión nueva de Nebula de una sola vez:
#   npm run release -- 1.1.0 "Novedades de esta versión"
# 1) sube version y android.versionCode en app.json   2) comprueba tipos, lint y tests
# 3) compila el APK (arm64)   4) compila el AppImage de Linux y el instalador de Windows (x64)
# 5) commit + etiqueta en main   6) release de GitHub con el APK, el AppImage y el paquete de Windows
# 7) publica la web + APK + instalador de Windows + version.json en GitHub Pages (avisa a las apps)
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
# El APK se firma con la clave propia (plugins/withReleaseSigning.js); sin ella no hay release.
grep -q '^NEBULA_UPLOAD_STORE_FILE=' "$HOME/.gradle/gradle.properties" 2>/dev/null \
  || { echo "Falta la clave de firma de Nebula en ~/.gradle/gradle.properties (ver docs/FIRMA_ANDROID.md)."; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo "Ejecuta la release desde la rama main."; exit 1; }

step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }

step "1/7 Versión $VERSION"
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

step "2/7 Comprobaciones"
npx tsc --noEmit
npx eslint .
npx jest --selectProjects app --silent

step "3/7 APK"
export JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain -q)
mkdir -p release
cp android/app/build/outputs/apk/release/app-release.apk release/nebula.apk
ls -lh release/nebula.apk

step "4/7 AppImage de Linux e instalador de Windows"
npm run dist:linux
cp "release/Nebula-$VERSION.AppImage" release/Nebula-linux-x86_64.AppImage
ls -lh release/Nebula-linux-x86_64.AppImage
# Si Nebula está instalada en este equipo, se actualiza a la versión nueva.
if [ -x "$HOME/.local/opt/nebula/Nebula.AppImage" ]; then bash scripts/install-linux.sh --sin-compilar; fi
# Reutiliza la web de escritorio recién preparada; el paquete solo lo acepta el instalador de esta versión.
bash scripts/build-windows.sh

step "5/7 Commit y etiqueta"
git add app.json
git commit -q -m "Versión $VERSION" || true
git tag -a "v$VERSION" -m "Nebula $VERSION"
git push -q origin main "v$VERSION"

step "6/7 Release de GitHub"
if [ -z "$NOTES" ]; then
  PREV=$(git describe --tags --abbrev=0 "v$VERSION^" 2>/dev/null || true)
  NOTES=$(git log --pretty='- %s' ${PREV:+"$PREV"..}"v$VERSION^" | grep -v '^- Versión ' | head -30)
fi
# GitHub Pages no admite archivos > 100 MB: el AppImage vive en la release y la web enlaza a
# releases/latest/download/Nebula-linux-x86_64.AppImage, que siempre es la versión más reciente.
gh release create "v$VERSION" release/nebula.apk release/Nebula-linux-x86_64.AppImage release/nsis-web/Nebula-windows-x64.nsis.7z --repo "$REPO" --title "Nebula $VERSION" \
  --notes "$NOTES

Android: https://echostrokes08.github.io/nebula/nebula.apk · Windows: https://echostrokes08.github.io/nebula/Nebula-Setup.exe · Linux: https://github.com/$REPO/releases/latest/download/Nebula-linux-x86_64.AppImage · Web: https://echostrokes08.github.io/nebula/"

# La web va la última: su version.json avisa a las apps instaladas, y para entonces el
# AppImage de la release ya tiene que estar subido.
step "7/7 Web en GitHub Pages"
rm -rf .pages-dist
EXPO_BASE_URL=/nebula npx expo export --platform web --output-dir .pages-dist
node scripts/scan-bundle.cjs .pages-dist
cp release/nebula.apk .pages-dist/nebula.apk
cp release/nsis-web/Nebula-Setup.exe .pages-dist/Nebula-Setup.exe
# Lo consulta el aviso «Hay una versión nueva» de Android y escritorio (1.2.0+).
node -e '
  const [version, notes] = process.argv.slice(1);
  const info = { version, notes: notes.split("\n")[0].slice(0, 300), apk: "https://echostrokes08.github.io/nebula/nebula.apk", windows: "https://echostrokes08.github.io/nebula/Nebula-Setup.exe", linux: "https://github.com/EchoStrokes08/nebula/releases/latest/download/Nebula-linux-x86_64.AppImage" };
  require("fs").writeFileSync(".pages-dist/version.json", JSON.stringify(info, null, 2) + "\n");
' "$VERSION" "$NOTES"
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

printf '\n\033[1;32m✓ Nebula %s publicada\033[0m\n' "$VERSION"
echo "  Web: https://echostrokes08.github.io/nebula/ (GitHub Pages tarda ~1 min en actualizar)"
echo "  APK: https://echostrokes08.github.io/nebula/nebula.apk"
echo "  Windows: https://echostrokes08.github.io/nebula/Nebula-Setup.exe"
echo "  Linux: https://github.com/$REPO/releases/latest/download/Nebula-linux-x86_64.AppImage"
echo "  Instalar por cable: adb install -r release/nebula.apk"
