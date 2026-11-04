#!/usr/bin/env python3
"""Збирає сайт для GitHub Pages у папку, яку передано аргументом: python3 scripts/build-site.py /шлях/до/site
Спершу: EXPO_OFFLINE=1 npx expo export --platform web"""
import glob, json, os, shutil, sys
from PIL import Image

dst = sys.argv[1]
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree('dist', dst)
for js in glob.glob(f'{dst}/_expo/static/js/web/*.js'):
    s = open(js).read().replace('"/assets/', '"./assets/')
    open(js, 'w').write(s)
h = open(f'{dst}/index.html').read()
h = h.replace('src="/_expo', 'src="./_expo').replace('href="/favicon', 'href="./favicon')
h = h.replace('<meta name="theme-color" content="#1B2026">', '''<meta name="theme-color" content="#1B2026">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Підхід">
<meta name="apple-mobile-web-app-status-bar-style" content="black">''')
h = h.replace('<html lang="en">', '<html lang="uk">')
h = h.replace('</body>', '<script>if("serviceWorker"in navigator){addEventListener("load",function(){navigator.serviceWorker.register("./sw.js").catch(function(){})})}</script></body>')
open(f'{dst}/index.html', 'w').write(h)
im = Image.open('assets/icon.png').convert('RGBA')
for n in (180, 192, 512):
    im.resize((n, n), Image.LANCZOS).save(f'{dst}/icon-{n}.png')
json.dump({"name": "Підхід", "short_name": "Підхід", "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait",
           "background_color": "#1B2026", "theme_color": "#1B2026", "lang": "uk",
           "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}]},
          open(f'{dst}/manifest.webmanifest', 'w'), ensure_ascii=False, indent=1)
shutil.copy('scripts/sw.js', f'{dst}/sw.js')
open(f'{dst}/.nojekyll', 'w').close()
os.remove(f'{dst}/metadata.json') if os.path.exists(f'{dst}/metadata.json') else None
