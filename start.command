#!/bin/bash
# Подвійний клік: встановлює залежності (перший раз) і запускає «Підхід».
cd "$(dirname "$0")"
clear
echo "Підхід: запуск"
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Не знайдено Node.js. Встанови його з https://nodejs.org (версія LTS) і запусти цей файл ще раз."
  read -n 1 -s -r -p "Натисни будь-яку клавішу, щоб закрити"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Встановлюю залежності, це 1-3 хвилини..."
  npm install || { echo "npm install не вдався"; read -n 1 -s -r; exit 1; }
fi
echo
echo "Відкрий Expo Go на телефоні і відскануй QR-код нижче."
echo "Телефон і ноут мають бути в одній Wi-Fi мережі."
echo
npx expo start
