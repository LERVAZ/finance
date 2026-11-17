/* Kostra aplikace: stav, záložky složené z modulů, vykreslení, akce, spuštění a zámek. */
import { html, raw, ikona, karta, segment, esc } from './html.js';
import { kc, KATEGORIE_VYCHOZI, CASOVE_PASMO } from './texty.js';
import { dnes as dnesV } from './vypocty/datumy.js';
import { klicObdobi } from './vypocty/obdobi.js';
import { souhrnObdobi } from './vypocty/utraty.js';
import { prehledUctu } from './vypocty/ucty.js';
import { zapnute } from './moduly/registr.js';
import { PametUloziste } from './uloziste/pamet.js';
import { SheetsUloziste } from './uloziste/sheets.js';
import { ukazkovaData } from './ukazka.js';
import { renderPruvodce, pruvodceAkce, pruvodceStav } from './pruvodce.js';
import { renderNastaveni, nastaveniAkce } from './nastaveni.js';
import { prehled, uctyTab, zapisTab, planyTab, poRenderu, zalozkyAkce } from './zalozky.js';
import { nactiKatalogBank } from './banky.js';
import { VERZE } from './verze.js';
import { rozlozeniAkce, zarizeni, rozvrhniVse, inicializujRozlozeni } from './rozlozeni.js';
import { kontrolaAkce } from './kontrola.js';
import { doplnky, nactiDoplnky } from './doplnky.js';
import { vytvorKontext } from './kontext.js';
import * as auth from './auth.js';

const $ = (id) => document.getElementById(id);
const LS = auth.LS;

const app = {
  store: null,
  rezim: 'start',              // start | pruvodce | aplikace
  dnes: dnesV(CASOVE_PASMO),
  zamekPodporovan: false,
  ui: { tab: location.hash.slice(1) || LS.get('tab') || 'prehled', zapis: '', plany: '', banka: '', ucet: '', obdobi: '', trvaleForm: '', predvyplnit: null, editor: null, projekt: '' }
};
window.FINANCE = app; // jen pro ladění v konzoli

/* ---------- kontext pro moduly ---------- */
function kontext() {
  return vytvorKontext({ store: app.store, dnes: app.dnes, ui: app.ui, zprava, potvrd: (t) => window.confirm(t), prejdi: (tab, sub) => prejdi(tab, sub) });
}

/* ---------- záložky: Přehled, Účty, (Útraty), Zápis, Plány – složené ze zapnutých modulů ---------- */
function zalozky(ctx) {
  const ma = (k) => ctx.moduly.some((m) => m[k] && (typeof m[k] !== 'object' || m[k].length !== 0));
  const t = [{ id: 'prehled', nazev: 'Přehled', titulek: 'Přehled', ikona: 'prehled', poradi: 0, render: prehled }];
  if (ma('polozky') || ma('pridat')) t.push({ id: 'ucty', nazev: 'Účty', titulek: 'Účty a produkty', ikona: 'ucty', poradi: 20, render: uctyTab });
  ctx.moduly.forEach((m) => { if (m.zalozka) t.push(m.zalozka); });
  if (ma('zapis') || ma('stavy')) t.push({ id: 'zapis', nazev: 'Zápis', titulek: 'Zápis', ikona: 'zapis', poradi: 80, render: zapisTab });
  if (ma('vyhled') || ma('grafy') || ma('kolace') || ma('planySub') || ma('jmeni')) t.push({ id: 'plany', nazev: 'Plány', titulek: 'Plány a výhledy', ikona: 'plany', poradi: 90, render: planyTab });
  return t.sort((a, b) => a.poradi - b.poradi);
}
const NASTAVENI_TAB = { id: 'nastaveni', nazev: 'Nastavení', titulek: 'Nastavení', render: (ctx) => renderNastaveni(ctx, app) };

/* ---------- vykreslení ---------- */
function render() {
  const nav = [$('navBottom'), $('navTop')];
  if (app.rezim !== 'aplikace') {
    nav.forEach((n) => { n.innerHTML = ''; n.hidden = true; });
    document.body.classList.add('bez-nav');
    $('hTitle').textContent = 'Finance';
    $('hSub').textContent = '';
    $('btnObnovit').hidden = true; $('btnNastaveni').hidden = true;
    $('content').innerHTML = app.rezim === 'pruvodce' ? renderPruvodce(app).s : '<div id="loading">Načítám…</div>';
    return;
  }
  document.body.classList.remove('bez-nav');
  $('btnObnovit').hidden = app.store.druh === 'pamet'; $('btnNastaveni').hidden = false;
  const ctx = kontext();
  const tabs = zalozky(ctx);
  let tab = app.ui.tab === 'nastaveni' ? NASTAVENI_TAB : tabs.find((t) => t.id === app.ui.tab);
  if (!tab) { tab = tabs[0]; app.ui.tab = tab.id; }
  const navHtml = html`${tabs.map((t) => html`<button type="button" class="tabbtn ${t.id === tab.id ? 'on' : ''}" data-akce="app.tab" data-hodnota="${t.id}" ${t.id === tab.id ? raw('aria-current="page"') : ''}>${ikona(t.ikona)}<span>${t.nazev}</span></button>`)}`.s;
  nav.forEach((n) => { n.innerHTML = navHtml; n.hidden = false; });
  $('navBottom').style.setProperty('--n', tabs.length);
  $('hTitle').textContent = tab.titulek;
  $('hSub').textContent = app.store.druh === 'pamet' ? 'ukázková data' : (auth.email() || '');
  let obsah;
  try { obsah = tab.render(ctx).s; } catch (e) { console.error(e); obsah = karta('', 'Chyba zobrazení', html`<p class="muted">${e.message}</p>`).s; }
  if (app.store.druh === 'pamet' && tab.id !== 'nastaveni') obsah = '<div class="alert"><b>Ukázka:</b> smyšlená data, nic se neukládá. <button type="button" class="linkbtn" data-akce="app.konecUkazky">Ukončit ukázku</button></div>' + obsah;
  $('content').innerHTML = obsah;
  rozvrhniVse();
  poRenderu(ctx, tab.id);
}

function prejdi(tab, sub) {
  app.ui.tab = tab; LS.set('tab', tab);
  history.replaceState(null, '', location.pathname + location.search + '#' + tab);
  if (tab === 'zapis' && sub) app.ui.zapis = sub;
  if (tab === 'plany' && sub) app.ui.plany = sub;
  app.ui.trvaleForm = ''; app.ui.editor = null; app.ui.kontrola = false; app.ui.import = false; app.ui.rozlUprava = ''; app.ui.rozlNavrh = null;
  window.scrollTo(0, 0);
}

/* ---------- hlášky ---------- */
let zpravaTimer = 0;
function zprava(text, chyba = false) {
  const el = $('toast');
  el.textContent = text;
  el.className = 'toast show' + (chyba ? ' err' : '');
  clearTimeout(zpravaTimer);
  zpravaTimer = setTimeout(() => { el.className = 'toast'; }, chyba ? 8000 : 4000);
}
app.zprava = zprava;

/* ---------- akce ---------- */
const AKCE = {
  ...pruvodceAkce,
  ...nastaveniAkce,
  ...zalozkyAkce,
  ...kontrolaAkce,
  ...rozlozeniAkce,
  'app.tab': (ctx, el) => prejdi(el.dataset.hodnota),
  'app.zapisSub': (ctx, el) => { app.ui.zapis = el.dataset.hodnota; app.ui.trvaleForm = ''; app.ui.editor = null; },
  prejdi: (ctx, el) => prejdi(el.dataset.tab, el.dataset.sub),
  'app.nastaveni': () => prejdi(app.ui.tab === 'nastaveni' ? 'prehled' : 'nastaveni'),
  'app.obnovit': async () => { await app.store.nacti(); zprava('Načteno z tabulky.'); },
  'app.motiv': () => {
    const t = app.motiv() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    LS.set('theme', t);
  },
  'app.zamek': async () => {
    if (auth.zamekZapnuty()) { auth.zamekVypnout(); zprava('Zámek vypnut.'); } else { await auth.zamekZapnout(); zprava('Zámek zapnut.'); }
  },
  'app.odhlasit': () => {
    if (!window.confirm('Odhlásit z Google účtu na tomto zařízení?')) return false;
    auth.odhlasit(); LS.del('sheet'); app.store = null; pruvodceStav.krok = 'uvod'; app.rezim = 'pruvodce';
  },
  'app.konecUkazky': () => { LS.del('rezim'); app.store = null; pruvodceStav.krok = 'uvod'; app.rezim = 'pruvodce'; history.replaceState(null, '', location.pathname); }
};
function najdiAkci(nazev) {
  if (AKCE[nazev]) return AKCE[nazev];
  if (doplnky.import && doplnky.import.importAkce[nazev]) return doplnky.import.importAkce[nazev];
  for (const m of zapnute(app.store ? app.store.config : {})) if (m.akce && m.akce[nazev]) return m.akce[nazev];
  return null;
}

let bezi = false;
async function spustAkci(nazev, el, form) {
  const fn = najdiAkci(nazev);
  if (!fn) { console.warn('Neznámá akce', nazev); return; }
  if (bezi) return;
  bezi = true;
  const tlacitka = form ? form.querySelectorAll('button') : [el];
  tlacitka.forEach((b) => { if (b.tagName === 'BUTTON') b.disabled = true; });
  document.body.classList.add('busy');
  try {
    const r = await fn(kontext(), el, form ? formData(form) : null, app);
    if (r !== false) render();
  } catch (e) {
    console.error(e);
    if (e && e.needLogin) ukazPrihlaseni(e.message);
    else zprava(e && e.message ? e.message : String(e), true);
  } finally {
    // tlačítka mimo překreslený obsah (lišta nahoře, spodní menu) by jinak zůstala vypnutá
    tlacitka.forEach((b) => { if (b.tagName === 'BUTTON') b.disabled = false; });
    bezi = false;
    document.body.classList.remove('busy');
  }
}
function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value;
  }
  return o;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-akce]');
  if (!el || el.tagName === 'FORM') return;
  e.preventDefault();
  spustAkci(el.dataset.akce, el, null);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-akce]');
  if (!f) return;
  e.preventDefault();
  spustAkci(f.dataset.akce, f, f);
});
// přechod mezi mobilním a počítačovým rozložením při změně šířky okna
inicializujRozlozeni(app, () => render());
let posledniZarizeni = zarizeni();
window.addEventListener('resize', () => {
  const z = zarizeni();
  if (z !== posledniZarizeni) { posledniZarizeni = z; if (app.rezim === 'aplikace' && !bezi) render(); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-zmena]');
  if (el) spustAkci(el.dataset.zmena, el, null);
});

/* ---------- overlay: zámek, vypršelé přihlášení ---------- */
function ukazOverlay(obsah) { const o = $('overlay'); o.innerHTML = '<div class="ovbox">' + obsah + '</div>'; o.hidden = false; }
function skryjOverlay() { const o = $('overlay'); o.hidden = true; o.innerHTML = ''; }
function ukazPrihlaseni(msg) {
  ukazOverlay(ikona('zamek', 56).s + '<h1>Finance</h1><p class="muted">' + esc(msg || 'Přihlášení vypršelo.') + '</p>' +
    '<button type="button" class="wide" data-akce="app.prihlasitZnovu">Přihlásit přes Google</button>');
}
function ukazZamek() {
  ukazOverlay(ikona('zamek', 56).s + '<h1>Finance</h1><p class="muted">Pro otevření se ověř otiskem, obličejem nebo PINem zařízení.</p>' +
    '<button type="button" id="odemknout" class="wide">Odemknout</button><p id="ovMsg" class="status err"></p>');
  $('odemknout').onclick = () => auth.zamekOverit().then(() => { zamceno = false; skryjOverlay(); start(); },
    () => { $('ovMsg').textContent = 'Ověření se nepovedlo, zkus to znovu.'; });
}
let zamceno = auth.zamekZapnuty(), skrytoOd = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) skrytoOd = Date.now();
  else {
    if (dnesV(CASOVE_PASMO) !== app.dnes) { app.dnes = dnesV(CASOVE_PASMO); if (app.rezim === 'aplikace') render(); }
    if (auth.zamekZapnuty() && skrytoOd && Date.now() - skrytoOd > 120000) { zamceno = true; ukazZamek(); }
  }
});

/* ---------- spuštění ---------- */
app.motiv = () => document.documentElement.getAttribute('data-theme') || 'dark';
app.spust = () => { app.rezim = 'aplikace'; render(); };
app.pruvodceDalsi = (krok) => { pruvodceStav.krok = krok; };
app.render = () => render(); // pro ladění a skryté testy
app.spustUkazku = () => {
  LS.set('rezim', 'ukazka');
  app.store = new PametUloziste(ukazkovaData(app.dnes));
  if (!location.hash) app.ui.tab = 'prehled';
  app.spust();
};
/** Po přihlášení: najde tabulku (uloženou, nebo na Disku), jinak pokračuje průvodce výběrem modulů. */
app.pripojTabulku = async () => {
  let id = LS.get('sheet');
  if (!id) {
    const nalezene = await SheetsUloziste.najdi(auth.token);
    if (nalezene.length) { id = nalezene[0].id; LS.set('sheet', id); }
  }
  if (!id) { pruvodceStav.krok = 'moduly'; app.rezim = 'pruvodce'; return; }
  const s = new SheetsUloziste(auth.token, id);
  try { await s.nacti(); } catch (e) {
    if (e.status === 404 || e.status === 403) { LS.del('sheet'); pruvodceStav.krok = 'moduly'; app.rezim = 'pruvodce'; zprava('Uloženou tabulku se nepodařilo otevřít, založíme novou.', true); return; }
    throw e;
  }
  app.store = s;
  s.verzeAplikace = VERZE;
  // jednou pro každou verzi aplikace kopie tabulky na Disk (na pozadí, nezdržuje)
  s.zalohujProVerzi(VERZE).then((z) => { if (z) zprava('Záloha tabulky pro verzi ' + VERZE + ' je na tvém Disku.'); }).catch((e) => console.warn('Záloha se nepovedla', e));
  if (!s.config.dokonceno) { pruvodceStav.krok = 'zaklad'; app.rezim = 'pruvodce'; return; }
  app.rezim = 'aplikace';
};

nactiKatalogBank().then(() => { if (app.rezim === 'aplikace') render(); });
async function start() {
  if (zamceno) { ukazZamek(); return; }
  const ukazka = new URLSearchParams(location.search).has('ukazka') || LS.get('rezim') === 'ukazka';
  if (ukazka) { app.spustUkazku(); return; }
  if (!auth.tokenPlatny()) {
    // uživatel už aplikaci používal → rovnou nabídnout přihlášení; nový → úvod průvodce
    app.rezim = 'pruvodce'; pruvodceStav.krok = 'uvod'; render();
    if (LS.get('sheet')) ukazPrihlaseni('Přihlas se Google účtem, pod kterým máš svou tabulku.');
    return;
  }
  render();
  try { await app.pripojTabulku(); } catch (e) {
    if (e.needLogin) { app.rezim = 'pruvodce'; render(); ukazPrihlaseni(e.message); return; }
    $('content').innerHTML = karta('', 'Data se nepodařilo načíst', html`<p class="muted">${e.message}</p><button type="button" data-akce="app.znovu">Zkusit znovu</button>`).s;
    return;
  }
  render();
}
/* ---------- nová verze ---------- */
let posledniKontrola = 0;
/** Zjistí, jestli na serveru není novější verze; když ano, ukáže lištu s tlačítkem Aktualizovat. */
async function zkontrolujVerzi(rucne = false) {
  if (!rucne && Date.now() - posledniKontrola < 5 * 60 * 1000) return null;
  posledniKontrola = Date.now();
  try {
    const r = await fetch('verze.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    app.novaVerze = j.verze && j.verze !== VERZE ? j : null;
    ukazListuVerze();
    return j;
  } catch (e) { return null; }
}
function ukazListuVerze() {
  let el = document.getElementById('novaVerze');
  if (!app.novaVerze) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'novaVerze'; el.className = 'nova-verze'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const n = app.novaVerze;
  el.innerHTML = html`<span><b>Je k dispozici nová verze ${n.verze}.</b>${(n.novinky || []).length ? html` <span class="muted small">${n.novinky[0]}</span>` : ''}</span>
    <button type="button" class="slim" data-akce="app.aktualizovat">Aktualizovat</button>`.s;
}
app.zkontrolujVerzi = zkontrolujVerzi;
AKCE['app.aktualizovat'] = async () => {
  // nové soubory se stáhnou při znovunačtení (service worker bere nejdřív síť)
  if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update().catch(() => {}); }
  location.reload();
  return false;
};
AKCE['app.kontrolaVerze'] = async () => {
  const j = await zkontrolujVerzi(true);
  zprava(!j ? 'Nepodařilo se zjistit, jestli je nová verze (jsi online?).' : app.novaVerze ? 'Je k dispozici verze ' + j.verze + '.' : 'Máš nejnovější verzi ' + VERZE + '.');
};
AKCE['app.znovu'] = async () => { await start(); return false; };
AKCE['app.prihlasitZnovu'] = async () => {
  await auth.prihlasit();
  skryjOverlay();
  if (app.store) await app.store.nacti(); else await app.pripojTabulku();
};

window.addEventListener('DOMContentLoaded', async () => {
  app.zamekPodporovan = await auth.zamekPodporovan();
  await nactiDoplnky();
  start();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  setTimeout(zkontrolujVerzi, 4000);
  setInterval(zkontrolujVerzi, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') zkontrolujVerzi(); });
});
