/* Service worker: aplikace se otevře i bez signálu. Data z tabulky se nikdy neukládají do mezipaměti.
   Název mezipaměti nastavuje tools/vydat.js podle verze. */
const CACHE = 'finance2-1.0.1';
const SOUBORY = ['./', 'index.html', 'css/base.css', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/verze.js', 'js/auth.js', 'js/config.js', 'js/html.js', 'js/texty.js', 'js/schema.js', 'js/ukazka.js', 'js/pruvodce.js', 'js/nastaveni.js',
  'js/editor.js', 'js/zalozky.js', 'js/grafy.js', 'js/kontrola.js', 'js/doplnky.js', 'js/kontext.js', 'js/rozlozeni.js', 'js/banky.js', 'js/vypocty/katalog.js', 'data/katalog.json',
  'js/vypocty/datumy.js', 'js/vypocty/obdobi.js', 'js/vypocty/utraty.js', 'js/vypocty/ucty.js', 'js/vypocty/hypoteka.js', 'js/vypocty/investice.js', 'js/vypocty/produkty.js', 'js/vypocty/platby.js',
  'js/uloziste/prevod.js', 'js/uloziste/pamet.js', 'js/uloziste/sheets.js',
  'js/moduly/registr.js', 'js/moduly/ucty.js', 'js/moduly/utraty.js', 'js/moduly/trvale.js', 'js/moduly/rocni.js', 'js/moduly/zdroje.js',
  'js/moduly/investice.js', 'js/moduly/dluhopis.js', 'js/moduly/hypoteka.js', 'js/moduly/stavebko.js', 'js/moduly/pojisteni.js',
  'js/moduly/majetek.js', 'js/moduly/dane.js', 'js/moduly/archiv.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SOUBORY))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Vlastní soubory: nejdřív síť (nová verze se projeví hned), bez sítě z mezipaměti. Cizí adresy (Google) se neřeší.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // no-cache: prohlížeč se serveru vždy zeptá, jestli je soubor nový (GitHub Pages jinak drží starý až 10 minut)
  const pozadavek = e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(pozadavek).then((r) => {
    const kopie = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, kopie));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
