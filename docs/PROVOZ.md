# Provoz – pro provozovatele

Jak je aplikace postavená, kde co nastavit a jak vydat novou verzi. Žádná hesla ani tajné klíče sem nepatří.

## Jak to celé funguje

- Statický web (HTML, CSS, JavaScript bez sestavování) na **GitHub Pages**: repozitář **LERVAZ/finance**, větev `main`, kořen. Adresa **https://lervaz.github.io/finance/**.
- Data každého uživatele jsou v **jeho vlastní Google tabulce** „Finance – data“ na jeho Disku. Aplikace k ní přistupuje přímo z prohlížeče přes Google Sheets a Drive API s oprávněním `drive.file` (vidí jen soubory, které sama založila).
- Přihlášení: OAuth 2.0 **přesměrováním** (`response_type=token`). Stránka odejde na `accounts.google.com` a vrátí se s tokenem v adrese za `#`. Token platí asi hodinu, obnovuje se novým přihlášením. Vyskakovací okno se nepoužívá, protože v prohlížečích s blokovanými cookies třetích stran padalo.
- Odhlášení jen smaže token v zařízení. Povolení u Googlu se neruší (jinak by se Google při dalším přihlášení znovu ptal a políčko Disku bývá nezaškrtnuté).
- Stará aplikace **lervaz.github.io/finance-app** je samostatná (jiný repozitář, jiná tabulka) a nic ze zde popsaného ji neovlivní.

## Google Cloud

Projekt číslo **958006176041**, konzole: https://console.cloud.google.com/

### OAuth klient „Finance web“ (APIs & Services → Credentials)

- **Authorized JavaScript origins:** `https://lervaz.github.io` a `http://localhost:8790` (bez cesty a bez lomítka na konci).
- **Authorized redirect URIs:** `https://lervaz.github.io/finance/` a `http://localhost:8790/` (s lomítkem na konci).
- Client ID je v `js/config.js`. Není tajné. Klientský „secret“ se nepoužívá a do repozitáře nepatří.

### Zapnutá API (APIs & Services → Library)

- Google Sheets API, Google Drive API.
- Google Picker API – jen pro import ze staré tabulky, který běží jen lokálně. Klíč pro Picker v `js/config.js` je omezený na adresy aplikace a jen na Picker API.

### Testeři (Google Auth Platform → Audience)

Aplikace je ve stavu **Testing**. Přihlásit se mohou jen účty v seznamu **Test users** (nejvýš 100):

1. V konzoli otevři **Google Auth Platform → Audience** (dříve „OAuth consent screen“).
2. U **Test users** klikni na **+ Add users**, vlož e-mail testera (účet Google, kterým se bude přihlašovat) a ulož.
3. Testerovi pošli odkaz https://lervaz.github.io/finance/ a návod (`docs/NAVOD.md`, v aplikaci Nastavení → Nápověda).

Tester, který v seznamu není, uvidí „Přístup zablokován“. Pro zveřejnění všem by bylo potřeba aplikaci publikovat a projít ověřením Googlu (oprávnění `drive.file` patří mezi necitlivá, ověření je jednodušší).

## Vývoj na počítači

Ve složce aplikace:

```bash
npm start
```

- `http://localhost:8790/?ukazka` – ukázka se smyšlenými daty, bez přihlášení.
- `http://localhost:8790/` – ostrý režim s přihlášením.
- Import ze staré tabulky (`js/import*.js`) se načítá jen na localhostu a do repozitáře nejde (`.gitignore`).

Testy (výpočty, úložiště proti napodobenině Google API, přihlášení):

```bash
npm test
```

Soukromé testy se skutečnými čísly jsou v `tests/soukrome/` (mimo repozitář): `node --test "tests/soukrome/*.test.js"`.

Skryté snímky obrazovky (headless Edge, žádné okno):

```bash
node tools/snimek.js "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" http://localhost:8790 tools/snimky
```

Snímky pro návod: stejný příkaz s výstupem `docs/obrazky` a filtrem `navod-`.

## Vydání nové verze

Verze má tvar **HLAVNÍ.VEDLEJŠÍ.OPRAVA**: oprava chyby → OPRAVA (1.1.0 → 1.1.1), nová funkce → VEDLEJŠÍ (1.1.1 → 1.2.0), velká změna → HLAVNÍ.

1. Připrav vydání (zkontroluje číslo verze, že jsou všechny soubory v `sw.js`, spustí testy a zapíše `js/verze.js`, `verze.json`, `sw.js` a `CHANGELOG.md`):

   ```bash
   node tools/vydat.js 1.2.0 "co je nového" "další novinka"
   ```

2. Ulož a nahraj (ve složce aplikace):

   ```bash
   git add -A
   git commit -m "Verze 1.2.0"
   git tag -a v1.2.0 -m "Verze 1.2.0"
   git push --follow-tags
   ```

3. GitHub Pages zveřejní novou verzi do pár minut. Ověření: https://lervaz.github.io/finance/verze.json ukazuje nové číslo.

**Jak se aktualizace dostane k uživatelům:** service worker (`sw.js`) bere soubory nejdřív ze sítě a cache má název podle verze (`finance2-1.2.0`). Aplikace každých 30 minut a při návratu do okna čte `verze.json`. Když je na serveru novější číslo, ukáže lištu **Aktualizovat**. Kdo nic neudělá, dostane novou verzi při příštím otevření.

**Nový soubor JavaScriptu** je potřeba přidat do seznamu `SOUBORY` v `sw.js`, jinak `vydat.js` vydání zastaví.

## Návrat ke starší verzi

Každá verze má v gitu značku (`v1.1.0` …). Návrat celé aplikace na starší verzi bez přepisování historie:

```bash
git revert --no-edit <commit>..HEAD
```

Pak vydat jako novou opravnou verzi (`node tools/vydat.js …`). Seznam verzí: `git tag`, rozdíly: `git diff v1.1.0 v1.1.1`.

## Zálohy dat uživatelů

- Aplikace sama kopíruje tabulku uživatele na jeho Disk: jednou pro každou verzi aplikace a vždy před změnou struktury tabulky (nové listy nebo sloupce). Ponechá posledních 10, starší přesune do koše.
- Kopie mají v Drive vlastnost `finance_app=zaloha` a jsou vidět v Nastavení → Verze a zálohy.
- Když se záloha nepovede, aplikace strukturu tabulky nezmění.
- Obnova: uživatel zálohu otevře v Google tabulkách a údaje z ní zkopíruje zpět. Tlačítko „použít tuto zálohu místo současné tabulky“ v aplikaci zatím není – celou zálohu je zatím potřeba vrátit ručně (s provozovatelem).

## Bezpečnost

- Do repozitáře nikdy: osobní data (`podklady/`, `MOJE_DATA.md`), skutečná čísla v testech, `.pem` a jiné klíče, `.env`. Hlídá to `.gitignore`.
- Napojení banky (Enable Banking): každý uživatel má vlastní aplikaci u Enable Banking a vlastní klíč `.pem`. Klíč je jen ve vlastnostech skriptu v jeho tabulce (`apps-script/Banka.gs`), nikdy v aplikaci, v repozitáři ani u provozovatele. Provozovatel cizí bankovní data nevidí. Podrobnosti: `docs/ROZHODNUTI.md` (jen lokálně), návod pro uživatele v `docs/NAVOD.md`, kapitola 6.
- Skript `apps-script/Banka.gs` je veřejný a nesmí obsahovat žádné klíče ani ID.
