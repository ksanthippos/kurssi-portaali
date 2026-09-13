# Kurssiportaali

Pieni staattinen verkkosovellus opettajan kurssi- ja sijaisohjeiden hallintaan.

## Rakenne

- `index.html` – käyttöliittymä
- `src/css/style.css` – ulkoasu
- `src/js/app.js` – toiminnallisuus
- `src/data/courses.json` – kurssien lista
- `src/data/fy7.json` – esimerkkikurssin tuntidata

## Paikallinen käyttö

Sivusto käyttää `fetch()`-kutsuja JSON-tiedostojen lataamiseen, joten sitä kannattaa ajaa paikallisen kehityspalvelimen kautta eikä avata suoraan tiedostona Finderista.

Esimerkiksi VS Coden Live Server -laajennuksella tai terminaalista sopivalla staattisella palvelimella.

## GitHub Pages

Sivusto on tarkoitettu julkaistavaksi GitHub Pagesissa. Koska kyseessä on staattinen HTML/CSS/JS-sivusto, erillistä palvelinta tai tietokantaa ei tarvita.
