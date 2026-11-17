# Finance – modulární aplikace na domácí finance

PWA pro mobil i PC. Každý uživatel má data ve **své vlastní Google tabulce**. Aplikace nemá žádný server ani databázi.

## Vyzkoušení

```bash
npm start
```

Pak otevři:

- `http://localhost:8790/?ukazka` – ukázka se smyšlenými daty, bez přihlášení
- `http://localhost:8790/` – ostrý režim s přihlášením Google. Adresa `http://localhost:8790` musí být v „Authorized JavaScript origins“ OAuth klienta.

## Testy

```bash
npm test
```

Testy pokrývají výpočty (období od výplaty do výplaty, útraty, trvalé platby, zůstatky a toky účtů), převody hodnot do buněk a úložiště proti napodobenině Google API.

Skrytá kontrola v prohlížeči (headless, žádné okno), která uloží snímky do `tools/snimky/`:

```bash
node tools/snimek.js "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" http://localhost:8790 tools/snimky
```

## Struktura

| Kde | Co |
|---|---|
| `js/app.js` | kostra: záložky složené ze zapnutých modulů, akce, spuštění, zámek |
| `js/moduly/` | moduly (`registr.js` je seznam modulů) |
| `js/vypocty/` | čisté výpočty bez DOM (testované) |
| `js/uloziste/` | Google tabulka (`sheets.js`), paměť pro ukázku (`pamet.js`), převod hodnot |
| `js/schema.js` | listy a sloupce tabulky |
| `js/texty.js` | jazyk, měna, formáty |
| `js/config.js` | Client ID Google (není tajné) |
| `docs/ROZHODNUTI.md` | technická rozhodnutí |

## Moduly

Účty, Útraty za měsíc, Trvalé platby, Roční platby, Roční zdroje, Investice a fondy, Pevný výnos / dluhopis, Hypotéka, Stavební spoření, Životní pojištění, Majetek, Daňové odpočty, Archiv a projekty. Napojení na banku přijde ve fázi 5.

## Jak přidat modul

1. Vytvoř `js/moduly/<id>.js`. Soubor exportuje objekt s položkami `id`, `nazev`, `popis`, `ikona` a `tabulky` a k nim podle potřeby:
   - `polozky` – co se ukáže v Účtech
   - `stavy` – políčka v Zápis → Stavy
   - `editory` – formuláře
   - `karty` – karty na Přehledu
   - `jmeni` – položky čistého jmění
   - `vyhled`, `grafy`, `kolace`, `planySub` – obsah záložky Plány
   - `upozorneni`, `zapis`, `zalozka`, `akce`
2. Listy, které modul potřebuje, přidej do `js/schema.js`.
3. Zaregistruj modul v `js/moduly/registr.js` a přidej jeho soubor do `sw.js`.

Do repozitáře nikdy nepatří soukromá data ani klíče (viz `.gitignore`).
