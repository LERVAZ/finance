/* Rozložení dlaždic přímo na obrazovce: přetáhnout (pořadí), roztáhnout za roh (šířka ve sloupcích, výška),
   skrýt, kompaktní zobrazení s rozbalováním. Dlaždice se skládají bez mezer (mřížka s malými řádky).
   Uloženo v _config pod klíčem `rozlozeni`: { [zalozka]: { pc: {...}, mobil: {...} } },
   kde {...} = { poradi: [id], skryte: [id], sirka: {id: sloupců}, vyska: {id: px}, styl: 'plne'|'kompaktni', jedna: bool }.
   Dlaždice = { id, nazev, barva, poradi, souhrn: { hodnota, pod, trida }, html }. */
import { html, raw } from './html.js';

export const HRANICE_MOBILU = 760;
export const zarizeni = (sirka = (typeof window !== 'undefined' ? window.innerWidth : 1280)) => (sirka < HRANICE_MOBILU ? 'mobil' : 'pc');

const RADEK = 4;       // výška jednoho řádku mřížky v px
const MEZERA = 14;     // mezera mezi dlaždicemi
const VYCHOZI = {
  prehled: { pc: { poradi: ['jmeni', 'mesic', 'platby'] }, mobil: {} },
  ucty: { pc: { zobrazeni: 'seznam' }, mobil: { zobrazeni: 'banky' } },
  utraty: { pc: { sirka: { souhrn: 2 } }, mobil: {} }
};

/** Platné nastavení pro záložku a zařízení (rozpracovaný návrh má přednost před uloženým). */
export function nastaveni(cfgRozlozeni, navrh, zalozka, zar) {
  const zdroj = (navrh && navrh[zalozka]) || (cfgRozlozeni && cfgRozlozeni[zalozka]) || {};
  const r = zdroj[zar] || (VYCHOZI[zalozka] || {})[zar] || {};
  return { poradi: r.poradi || [], skryte: r.skryte || [], sirka: r.sirka || {}, vyska: r.vyska || {},
    styl: r.styl === 'kompaktni' ? 'kompaktni' : 'plne', jedna: r.jedna !== false, zobrazeni: r.zobrazeni || '' };
}

/** Seřadí dlaždice: nejdřív podle uloženého pořadí, nové (neznámé) podle výchozího pořadí na konec. */
export function serad(dlazdice, poradi) {
  const idx = (k) => { const i = poradi.indexOf(k.id); return i >= 0 ? i : 10000 + (k.poradi || 0); };
  return [...dlazdice].sort((a, b) => idx(a) - idx(b));
}

/** Počet sloupců mřížky podle šířky, zařízení a stylu. */
export function pocetSloupcu(sirka, zar, styl, minPlne = 320) {
  if (zar === 'mobil') return styl === 'kompaktni' ? 2 : 1;
  const min = styl === 'kompaktni' ? 170 : minPlne;
  return Math.max(1, Math.min(styl === 'kompaktni' ? 8 : 4, Math.floor((sirka + MEZERA) / (min + MEZERA))));
}

function mini(k, zalozka) {
  const s = k.souhrn || {};
  return html`<button type="button" class="card mini ${k.barva ? 'c-' + k.barva : ''}" ${k.barvaHex ? raw('style="--c:' + k.barvaHex.replace(/[^#0-9a-fA-F]/g, '') + '"') : ''} data-akce="rozl.otevrit" data-hodnota="${k.id}" data-zalozka="${zalozka}" aria-expanded="false">
    <span class="mini-n">${k.logo || ''}${k.nazev}</span>
    <span class="mini-h num ${s.trida || ''}">${s.hodnota ?? '–'}</span>
    ${s.pod ? html`<span class="mini-p">${s.pod}</span>` : ''}</button>`;
}

function lista(ctx, zar, n, vse) {
  const skryte = vse.filter((k) => n.skryte.includes(k.id));
  return html`<div class="rozl-bar" role="toolbar" aria-label="Úprava rozložení">
    <span class="rozl-bar-t">Přetáhni dlaždici jinam, za roh <b>◢</b> ji roztáhneš. Platí pro ${zar === 'pc' ? 'počítač' : 'mobil'}.</span>
    <div class="seg">${[['plne', 'Plné'], ['kompaktni', 'Kompaktní']].map(([id, t]) => html`<button type="button" class="${id === n.styl ? 'on' : ''}" data-akce="rozl.styl" data-hodnota="${id}">${t}</button>`)}</div>
    ${n.styl === 'kompaktni' ? html`<label class="check small"><input type="checkbox" data-zmena="rozl.jedna" ${n.jedna ? 'checked' : ''}> jen jedna otevřená</label>` : ''}
    ${skryte.length ? html`<span class="rozl-skryte"><span class="muted small">Skryté:</span>${skryte.map((k) => html`<button type="button" class="slim btn2" data-akce="rozl.skryt" data-hodnota="${k.id}">+ ${k.nazev}</button>`)}</span>` : ''}
    <span class="spacer"></span>
    <button type="button" class="slim btn2" data-akce="rozl.vychozi">Výchozí</button>
    <button type="button" class="slim btn2" data-akce="rozl.zrusit">Zrušit</button>
    <button type="button" class="slim" data-akce="rozl.ulozit">Hotovo</button>
  </div>`;
}

/** Vykreslí dlaždice záložky podle rozložení. */
export function vykresliDlazdice(ctx, zalozka, dlazdice, { pred = '', vedle = '', minSirka = 320 } = {}) {
  const uprava = ctx.ui.rozlUprava === zalozka;
  const zar = zarizeni();
  const n = nastaveni(ctx.cfg.rozlozeni, uprava ? ctx.ui.rozlNavrh : null, zalozka, zar);
  const vse = serad(dlazdice, n.poradi);
  const vid = vse.filter((k) => !n.skryte.includes(k.id));
  const otevrene = (ctx.ui.rozlOtevrene || {})[zalozka] || [];
  const ovladani = (k) => (uprava ? html`<span class="dl-uchyt" title="Přetáhni">⠿</span>
    <button type="button" class="dl-skryt" data-akce="rozl.skryt" data-hodnota="${k.id}" title="Skrýt dlaždici" aria-label="Skrýt ${k.nazev}">✕</button>
    <span class="dl-grip" title="Táhni pro změnu velikosti, dvojklik vrátí původní">◢</span>` : '');
  const polozky = vid.map((k) => {
    const kompakt = n.styl === 'kompaktni';
    const otevrena = kompakt && otevrene.includes(k.id) && !uprava;
    return html`<div class="dl ${otevrena ? 'mini-otevrena' : ''}" data-id="${k.id}" data-w="${n.sirka[k.id] || 1}" data-h="${(!kompakt || !otevrena) && n.vyska[k.id] ? n.vyska[k.id] : ''}">
      ${kompakt && !otevrena ? mini(k, zalozka) : k.html}
      ${otevrena ? html`<button type="button" class="btn2 slim mini-zmensit" data-akce="rozl.zavrit" data-hodnota="${k.id}" data-zalozka="${zalozka}" aria-expanded="true">Zmenšit ▲</button>` : ''}
      ${ovladani(k)}</div>`;
  });
  const hlava = uprava ? lista(ctx, zar, n, vse)
    : html`<div class="rozl-lista">${vedle}<button type="button" class="slim btn2" data-akce="rozl.upravit" data-hodnota="${zalozka}" title="Přeskládat a roztáhnout dlaždice">Upravit rozložení</button></div>`;
  return html`${hlava}${pred}<div class="dgrid ${uprava ? 'upravuji' : ''}" data-zalozka="${zalozka}" data-zar="${zar}" data-styl="${n.styl}" data-min="${minSirka}">${polozky}</div>`;
}

/* ---------- skládání bez mezer ---------- */
export function rozvrhni(g) {
  const cols = pocetSloupcu(g.clientWidth, g.dataset.zar, g.dataset.styl, Number(g.dataset.min) || 320);
  g.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
  g.dataset.cols = cols;
  for (const d of g.children) {
    const w = d.classList.contains('mini-otevrena') ? cols : Math.min(cols, Math.max(1, Number(d.dataset.w) || 1));
    d.style.gridColumn = 'span ' + w;
    const obsah = d.firstElementChild;
    if (obsah) obsah.style.height = d.dataset.h ? d.dataset.h + 'px' : '';
  }
  for (const d of g.children) {
    const vys = d.getBoundingClientRect().height;
    d.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((vys + MEZERA) / RADEK));
  }
}
// když se obsah dlaždice změní (načtené písmo, graf, rozbalení), přepočítat skládání
let sledovac = null, cekaRozvrh = false;
function sleduj(g) {
  if (typeof ResizeObserver === 'undefined') return;
  if (!sledovac) sledovac = new ResizeObserver(() => {
    if (cekaRozvrh) return;
    cekaRozvrh = true;
    requestAnimationFrame(() => { cekaRozvrh = false; document.querySelectorAll('.dgrid').forEach(rozvrhni); });
  });
  for (const d of g.children) if (d.firstElementChild) sledovac.observe(d.firstElementChild);
}
export function rozvrhniVse() {
  if (typeof document === 'undefined') return;
  if (sledovac) sledovac.disconnect();
  document.querySelectorAll('.dgrid').forEach((g) => { rozvrhni(g); sleduj(g); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll('.dgrid').forEach(rozvrhni));
}

/* ---------- přetahování a roztahování ---------- */
let APP = null;
const pctx = () => ({ ui: APP.app.ui, cfg: APP.app.store ? APP.app.store.config : {} });

function zacniTah(e, g, d) {
  const x0 = e.clientX, y0 = e.clientY;
  let duch = null, posunuto = false, rect = null;
  const pohyb = (ev) => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!posunuto) {
      if (Math.hypot(dx, dy) < 6) return;
      posunuto = true;
      rect = d.getBoundingClientRect();
      duch = d.cloneNode(true);
      duch.classList.add('dl-duch');
      Object.assign(duch.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
      document.body.appendChild(duch);
      d.classList.add('dl-misto');
    }
    duch.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    const pod = document.elementFromPoint(ev.clientX, ev.clientY);
    const cil = pod && pod.closest('.dl');
    if (cil && cil !== d && cil.parentElement === g) {
      const deti = [...g.children];
      if (deti.indexOf(d) < deti.indexOf(cil)) cil.after(d); else cil.before(d);
      rozvrhni(g);
    }
    if (ev.clientY < 70) window.scrollBy(0, -12); else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
  };
  const konec = () => {
    window.removeEventListener('pointermove', pohyb);
    window.removeEventListener('pointerup', konec);
    window.removeEventListener('pointercancel', konec);
    if (!posunuto) return;
    duch.remove(); d.classList.remove('dl-misto');
    const r = navrh(pctx());
    const ids = [...g.children].map((x) => x.dataset.id);
    r.poradi = [...ids, ...r.skryte.filter((id) => !ids.includes(id))];
  };
  window.addEventListener('pointermove', pohyb);
  window.addEventListener('pointerup', konec);
  window.addEventListener('pointercancel', konec);
}

function zacniResize(e, g, d) {
  const x0 = e.clientX, y0 = e.clientY;
  const rect = d.getBoundingClientRect();
  const cols = Number(g.dataset.cols) || 1;
  const sirkaSloupce = (g.clientWidth - (cols - 1) * MEZERA) / cols;
  let zmenaVysky = false;
  d.classList.add('dl-meni');
  const pohyb = (ev) => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (cols > 1) d.dataset.w = Math.max(1, Math.min(cols, Math.round((rect.width + dx + MEZERA) / (sirkaSloupce + MEZERA))));
    if (Math.abs(dy) > 8 || zmenaVysky) { zmenaVysky = true; d.dataset.h = Math.max(90, Math.round((rect.height + dy) / RADEK) * RADEK); }
    rozvrhni(g);
  };
  const konec = () => {
    window.removeEventListener('pointermove', pohyb);
    window.removeEventListener('pointerup', konec);
    window.removeEventListener('pointercancel', konec);
    d.classList.remove('dl-meni');
    const r = navrh(pctx());
    const id = d.dataset.id;
    if (cols > 1) { r.sirka = { ...r.sirka }; if (Number(d.dataset.w) > 1) r.sirka[id] = Number(d.dataset.w); else delete r.sirka[id]; }
    if (zmenaVysky) r.vyska = { ...r.vyska, [id]: Number(d.dataset.h) };
  };
  window.addEventListener('pointermove', pohyb);
  window.addEventListener('pointerup', konec);
  window.addEventListener('pointercancel', konec);
}

export function inicializujRozlozeni(app, render) {
  APP = { app, render };
  document.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.dgrid.upravuji');
    const d = g && e.target.closest('.dl');
    if (!d || e.target.closest('[data-akce]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const grip = e.target.closest('.dl-grip');
    // na dotykovém displeji se tahá jen za úchyt (zbytek dlaždice nechává stránku posouvat)
    if (!grip && e.pointerType !== 'mouse' && !e.target.closest('.dl-uchyt')) return;
    e.preventDefault();
    if (grip) zacniResize(e, g, d); else zacniTah(e, g, d);
  });
  document.addEventListener('dblclick', (e) => {
    const grip = e.target.closest('.dgrid.upravuji .dl-grip');
    if (!grip) return;
    const id = grip.closest('.dl').dataset.id;
    const r = navrh(pctx());
    r.sirka = { ...r.sirka }; r.vyska = { ...r.vyska };
    delete r.sirka[id]; delete r.vyska[id];
    render();
  });
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(rozvrhniVse, 80); });
}

/** Uloží jednu volbu (např. zobrazení záložky) pro aktuální zařízení rovnou do tabulky. */
export async function ulozVolbu(ctx, zalozka, klic, hodnota) {
  const zar = zarizeni();
  const R = JSON.parse(JSON.stringify(ctx.cfg.rozlozeni || {}));
  R[zalozka] = R[zalozka] || {};
  R[zalozka][zar] = { ...((VYCHOZI[zalozka] || {})[zar] || {}), ...(R[zalozka][zar] || {}), [klic]: hodnota };
  await ctx.store.nastav('rozlozeni', R);
}

/* ---------- akce ---------- */
function navrh(ctx) {
  const zalozka = ctx.ui.rozlUprava;
  const zar = zarizeni();
  if (!ctx.ui.rozlNavrh) ctx.ui.rozlNavrh = JSON.parse(JSON.stringify(ctx.cfg.rozlozeni || {}));
  const N = ctx.ui.rozlNavrh;
  N[zalozka] = N[zalozka] || {};
  if (!N[zalozka][zar]) {
    const n = nastaveni(ctx.cfg.rozlozeni, null, zalozka, zar);
    N[zalozka][zar] = { poradi: [...n.poradi], skryte: [...n.skryte], sirka: { ...n.sirka }, vyska: { ...n.vyska }, styl: n.styl, jedna: n.jedna, ...(n.zobrazeni ? { zobrazeni: n.zobrazeni } : {}) };
  }
  return N[zalozka][zar];
}
const prepni = (pole, id) => (pole.includes(id) ? pole.filter((x) => x !== id) : [...pole, id]);

export const rozlozeniAkce = {
  'rozl.upravit': (ctx, el) => { ctx.ui.rozlUprava = el.dataset.hodnota; ctx.ui.rozlNavrh = null; },
  'rozl.styl': (ctx, el) => { navrh(ctx).styl = el.dataset.hodnota; },
  'rozl.jedna': (ctx, el) => { navrh(ctx).jedna = !!el.checked; },
  'rozl.skryt': (ctx, el) => { const r = navrh(ctx); r.skryte = prepni(r.skryte, el.dataset.hodnota); },
  'rozl.vychozi': (ctx) => { const z = navrh(ctx).zobrazeni; const N = ctx.ui.rozlNavrh[ctx.ui.rozlUprava]; delete N[zarizeni()]; if (z) N[zarizeni()] = { ...((VYCHOZI[ctx.ui.rozlUprava] || {})[zarizeni()] || {}), zobrazeni: z }; },
  'rozl.zrusit': (ctx) => { ctx.ui.rozlUprava = ''; ctx.ui.rozlNavrh = null; },
  'rozl.ulozit': async (ctx) => {
    if (ctx.ui.rozlNavrh) await ctx.store.nastav('rozlozeni', ctx.ui.rozlNavrh);
    ctx.ui.rozlUprava = ''; ctx.ui.rozlNavrh = null;
    ctx.zprava('Rozložení uloženo.');
  },
  'rozl.otevrit': (ctx, el) => {
    const zalozka = el.dataset.zalozka || ctx.ui.tab, id = el.dataset.hodnota;
    const n = nastaveni(ctx.cfg.rozlozeni, null, zalozka, zarizeni());
    const o = ctx.ui.rozlOtevrene = ctx.ui.rozlOtevrene || {};
    o[zalozka] = n.jedna ? [id] : [...(o[zalozka] || []).filter((x) => x !== id), id];
  },
  'rozl.zavrit': (ctx, el) => {
    const o = ctx.ui.rozlOtevrene || {};
    const zalozka = el.dataset.zalozka || ctx.ui.tab;
    o[zalozka] = (o[zalozka] || []).filter((x) => x !== el.dataset.hodnota);
  }
};
