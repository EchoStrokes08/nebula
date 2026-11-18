#!/usr/bin/env bash
# Instalador de Windows (x64) compilable desde Linux (necesita wine para el icono del .exe).
# El instalador completo pesa ~115 MB y GitHub Pages no admite archivos > 100 MB, así que es un
# instalador web (nsis-web): un Nebula-Setup.exe pequeño, publicado en Pages, que descarga el
# paquete de la release v<versión> y comprueba su SHA-512 antes de instalar.
# Salida: release/nsis-web/Nebula-Setup.exe y release/nsis-web/Nebula-windows-x64.nsis.7z
# Requiere haber ejecutado antes `npm run build:desktop`.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p 'require("./app.json").expo.version')
PACKAGE="Nebula-windows-x64.nsis.7z"
# La URL lleva la etiqueta (no `latest`): cada instalador solo acepta el paquete de su versión.
URL="https://github.com/EchoStrokes08/nebula/releases/download/v$VERSION/$PACKAGE"

rm -rf release/nsis-web
# Sin electronDist: hace falta el Electron de Windows, no el de node_modules (Linux).
./node_modules/.bin/electron-builder --win nsis-web --x64 --publish never \
  --config.compression=maximum --config.nsisWeb.appPackageUrl="$URL"
mv release/nsis-web/*-x64.nsis.7z "release/nsis-web/$PACKAGE"
ls -lh release/nsis-web/Nebula-Setup.exe "release/nsis-web/$PACKAGE"
echo "El paquete debe subirse a la release v$VERSION como $PACKAGE"
