// Expo пише шляхи від кореня сайту ("/_expo/..."), а програма відкриває файли з диска,
// тому робимо їх відносними.
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const html = path.join(dir, 'index.html');
fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(/(src|href)="\/(?!\/)/g, '$1="./'));
const jsDir = path.join(dir, '_expo', 'static', 'js', 'web');
for (const f of fs.readdirSync(jsDir)) {
  const p = path.join(jsDir, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split('"/assets/').join('"./assets/'));
}
console.log('Шляхи виправлено');
