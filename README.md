# Princezna a bonbony

Plošinovka v čistém HTML/CSS/JS (Canvas). Bez buildu a bez závislostí.
Ovládání: dotyk, klávesnice, gamepad (DualSense).

## Lokální spuštění
    python3 -m http.server 8080
a otevři http://localhost:8080 (hra nejde spustit přes file://).

## Struktura
- `index.html` – vstupní stránka
- `js/config.js` – konstanty (gravitace, výšky skoků, rychlosti)
- `js/input.js` – sjednocený vstup (dotyk / klávesnice / gamepad)
- `js/level.js` – data levelů
- `js/player.js`, `js/enemies.js` – postavy a fyzika
- `js/render.js` – kreslení
- `js/main.js` – herní smyčka
- `assets/` – obrázky postav (PNG s průhledností)

## Nasazení (Cloudflare)
Build command: prázdný. Output directory: `/` (kořen repozitáře).
