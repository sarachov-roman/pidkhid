#!/bin/bash
# Подвійний клік: збирає програму «Підхід» для Mac і кладе її в «Програми».
cd "$(dirname "$0")"
ROOT="$(pwd)"
clear
echo "Збираю «Підхід» для Mac. Перший раз це 2-5 хвилин."
for d in /opt/homebrew/bin /usr/local/bin "$HOME/.volta/bin" "$HOME/.local/bin" "$HOME/.nvm/versions/node"/*/bin; do
  [ -x "$d/node" ] && export PATH="$d:$PATH"
done
fail() { echo; echo "Помилка: $1"; read -n 1 -s -r -p "Натисни будь-яку клавішу, щоб закрити"; exit 1; }
command -v node >/dev/null || fail "не знайдено Node.js (nodejs.org)"

[ -d node_modules ] || { echo "1/4 Встановлюю залежності застосунку..."; npm install || fail "npm install"; }

echo "2/4 Збираю інтерфейс..."
rm -rf desktop/web
npx expo export --platform web --output-dir desktop/web >/tmp/pidkhid-export.log 2>&1 || { tail -30 /tmp/pidkhid-export.log; fail "expo export"; }
node desktop/fix-paths.js desktop/web || fail "fix-paths"

echo "3/4 Готую вікно програми (Electron)..."
cd desktop
[ -d node_modules ] || npm install --no-audit --no-fund || fail "npm install у desktop"
rm -rf out
npx electron-packager . "Підхід" --platform=darwin --arch="$(uname -m | sed 's/x86_64/x64/')" \
  --icon=icon.icns --app-bundle-id=com.pidkhid.app --app-version=1.0.0 \
  --ignore='^/out' --ignore='^/fix-paths\.js' --out=out --overwrite >/tmp/pidkhid-pack.log 2>&1 || { tail -30 /tmp/pidkhid-pack.log; fail "electron-packager"; }
APP="$(ls -d out/*/Підхід.app | head -1)"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1

echo "4/4 Встановлюю..."
# закриваємо стару версію, якщо відкрита (записи зберігаються окремо і нікуди не дінуться)
osascript -e 'tell application id "com.pidkhid.app" to quit' >/dev/null 2>&1; sleep 1
DEST="/Applications"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
rm -rf "$DEST/Підхід.app"
cp -R "$APP" "$DEST/" || fail "не вдалося скопіювати в $DEST"
echo
echo "Готово: $DEST/Підхід.app"
open "$DEST/Підхід.app"
sleep 2
