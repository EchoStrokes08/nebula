#!/usr/bin/env bash
# Instala Nebula como aplicación de Linux para el usuario actual (sin root):
#   npm run install:linux            compila el AppImage actual y lo instala
#   npm run install:linux -- --sin-compilar   instala el último AppImage de release/
#   npm run uninstall:linux          lo desinstala (conserva tus datos)
# Deja el ejecutable en ~/.local/bin/nebula, el lanzador en el menú de aplicaciones,
# el icono en el tema hicolor y registra los enlaces nebula://.
set -euo pipefail
cd "$(dirname "$0")/.."

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
OPT="$HOME/.local/opt/nebula"
BIN="$HOME/.local/bin/nebula"
DESKTOP="$DATA/applications/nebula.desktop"
ICON_DIR="$DATA/icons/hicolor"

refresh() {
  command -v update-desktop-database >/dev/null && update-desktop-database -q "$DATA/applications" || true
  command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$ICON_DIR" 2>/dev/null || true
}

if [ "${1:-}" = "--desinstalar" ]; then
  rm -rf "$OPT"; rm -f "$BIN" "$DESKTOP"
  find "$ICON_DIR" -name nebula.png -path '*/apps/*' -delete 2>/dev/null || true
  refresh
  echo "Nebula desinstalada. Tus datos siguen en ~/.config/Nebula."
  exit 0
fi

if [ "${1:-}" != "--sin-compilar" ]; then npm run dist:linux; fi
VERSION=$(node -p 'require("./app.json").expo.version')
APPIMAGE="release/Nebula-$VERSION.AppImage"
[ -f "$APPIMAGE" ] || { echo "No existe $APPIMAGE (ejecuta sin --sin-compilar)."; exit 1; }

mkdir -p "$OPT" "$(dirname "$BIN")" "$(dirname "$DESKTOP")"
install -m 755 "$APPIMAGE" "$OPT/Nebula.AppImage.new"
mv -f "$OPT/Nebula.AppImage.new" "$OPT/Nebula.AppImage"   # reemplazo atómico aunque esté abierta
ln -sfn "$OPT/Nebula.AppImage" "$BIN"

# Iconos en varios tamaños (si hay ImageMagick); siempre al menos el de 512 px.
for size in 512 256 128 64 48 32; do
  dir="$ICON_DIR/${size}x${size}/apps"; mkdir -p "$dir"
  if command -v magick >/dev/null; then magick assets/icon.png -resize "${size}x${size}" "$dir/nebula.png"
  elif [ "$size" = 512 ]; then cp assets/icon.png "$dir/nebula.png"; fi
done

cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Nebula
GenericName=Productividad personal
Comment=Hábitos, tareas, agenda y enfoque
Exec="$OPT/Nebula.AppImage" %U
TryExec=$OPT/Nebula.AppImage
Icon=nebula
Terminal=false
Categories=Office;ProjectManagement;
Keywords=hábitos;tareas;agenda;enfoque;pomodoro;productividad;
MimeType=x-scheme-handler/nebula;
StartupWMClass=nebula
StartupNotify=true
X-AppImage-Version=$VERSION
EOF
chmod 644 "$DESKTOP"
command -v xdg-mime >/dev/null && xdg-mime default nebula.desktop x-scheme-handler/nebula || true
refresh

# Si el inicio con el sistema estaba activado, apunta al ejecutable instalado.
AUTOSTART="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/nebula.desktop"
if [ -f "$AUTOSTART" ]; then sed -i "s|^Exec=.*|Exec=\"$OPT/Nebula.AppImage\" --hidden|" "$AUTOSTART"; fi

echo "Nebula $VERSION instalada: búscala en el lanzador de aplicaciones o ejecuta «nebula»."
