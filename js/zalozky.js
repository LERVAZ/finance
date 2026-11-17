/* Společné záložky skládané z modulů: Přehled, Účty (všechny produkty podle banky), Zápis (stavy + sekce modulů), Plány. */
import { html, raw, karta, segment, trida, radek } from './html.js';
import { kc, sk, cislo, datum, precti, MESICE } from './texty.js';
import { formularEditoru, prectiEditor } from './editor.js';
import { nactiChart, znicGrafy, kolac, cary, PALETA, cv } from './grafy.js';
import { pridejMesice, dniVMesici, rozloz, iso } from './vypocty/datumy.js';
import { zustatekK } from './vypocty/ucty.js';
import { hodnotaK } from './vypocty/produkty.js';
import { rada as radaInvestice } from './vypocty/investice.js';
import { vzhledBanky, odznak } from './banky.js';
import { vykresliDlazdice, zarizeni, nastaveni as nastaveniRozlozeni, ulozVolbu } from './rozlozeni.js';

const z = (ctx, klic) => ctx.moduly.flatMap((m) => (m[klic] ? m[klic](ctx) : []));
const podlePoradi = (a, b) => (a.poradi || 0) - (b.poradi || 0);

/* ---------- editor (společný pro moduly) ---------- */
export function definiceEditoru(ctx, tab) {
  for (const m of ctx.moduly) if (m.editory && m.editory[tab]) return m.editory[tab];
  return null;
}
export function renderEditor(ctx) {
  const e = ctx.ui.editor;
  const def = e && definiceEditoru(ctx, e.tab);
  if (!def) return null;
  const zaznam = e.id ? ctx.data(e.tab).find((x) => x.id === e.id) : null;
  return formularEditoru(ctx, def, e.tab, zaznam || (e.predvyplnit ? { ...e.predvyplnit } : null));
}

/* ---------- Přehled ---------- */
export function prehled(ctx) {
  const jm = z(ctx, 'jmeni');
  const karty = z(ctx, 'karty');
  const upoz = z(ctx, 'upozorneni');
  if (jm.length) {
    const sum = (f) => jm.filter(f).reduce((s, p) => s + p.hodnota, 0);
    const majetek = sum((p) => p.skupina === 'Majetek');
    const penize = sum((p) => p.hodnota > 0 && p.skupina !== 'Majetek');
    const dluhy = -sum((p) => p.hodnota < 0);
    const historie = cisteJmeniVCase(ctx, 2);
    const zmena = historie.length >= 2 ? historie[historie.length - 1].hodnota - historie[0].hodnota : null;
    karty.push({ id: 'jmeni', nazev: 'Čisté jmění', barva: 'purple', poradi: 10,
      souhrn: { hodnota: kc(penize + majetek - dluhy), trida: trida(penize + majetek - dluhy), pod: zmena !== null ? 'za měsíc ' + sk(zmena) : '' },
      html: karta('purple', 'Čisté jmění', html`<div class="big num ${trida(penize + majetek - dluhy)}">${kc(penize + majetek - dluhy)}</div>
      <div class="split"><span>peníze a investice <b class="num">${kc(penize)}</b></span>${majetek ? html`<span>majetek <b class="num">${kc(majetek)}</b></span>` : ''}${dluhy ? html`<span>dluhy <b class="num">−${kc(dluhy)}</b></span>` : ''}</div>
      ${zmena !== null ? html`<div class="small">Za poslední měsíc <b class="num ${trida(zmena)}">${sk(zmena)}</b></div>` : ''}`) });
  }
  const inv = jm.filter((p) => p.skupina === 'Investice');
  if (inv.length) {
    karty.push({ id: 'investice', nazev: 'Investice', barva: 'teal', poradi: 38,
      souhrn: { hodnota: kc(inv.reduce((s, p) => s + p.hodnota, 0)), pod: inv.length + (inv.length === 1 ? ' položka' : inv.length < 5 ? ' položky' : ' položek') },
      html: karta('teal', 'Investice', inv.map((p) => radek(p.nazev, p.pod, kc(p.hodnota), p.hodnota2, p.trida2)),
      html`<span class="num">${kc(inv.reduce((s, p) => s + p.hodnota, 0))}</span>`) });
  }
  if (!karty.length && !upoz.length) return karta('', 'Vítej', html`<p class="muted">Zatím tu nic není. Přidej účty nebo platby.</p>`);
  return vykresliDlazdice(ctx, 'prehled', karty.sort(podlePoradi).map((k, i) => ({ id: 'k' + i, nazev: 'Dlaždice', ...k })), { pred: upoz });
}

/** Čisté jmění na konci posledních n měsíců (+ dnes) z historie stavů. */
export function cisteJmeniVCase(ctx, mesicu = 24) {
  const body = [];
  for (let i = mesicu; i >= 1; i--) {
    const [y, m] = rozloz(pridejMesice(ctx.dnes.slice(0, 8) + '01', -i));
    body.push(iso(y, m, dniVMesici(y, m)));
  }
  body.push(ctx.dnes);
  const stavy = ctx.data('stavy'), hist = ctx.data('historie'), ih = ctx.data('investice_historie');
  const ucty = ctx.zapnuto('ucty') ? ctx.data('ucty').filter((u) => u.id) : [];
  const inv = ctx.zapnuto('investice') ? ctx.data('investice') : [];
  const rucni = [['hypoteka', -1], ['stavebko', 1], ['pojisteni', 1], ['majetek', 1]].filter(([t]) => ctx.zapnuto(t));
  const out = [];
  for (const d of body) {
    let s = 0, neco = false;
    for (const u of ucty) { const v = zustatekK(stavy, u.id, d); if (v) { s += v.zustatek; neco = true; } }
    for (const i of inv) { const r = radaInvestice(ih, i.id).filter((b) => b.datum <= d); if (r.length) { s += r[r.length - 1].hodnota; neco = true; } }
    for (const [t, znam] of rucni) for (const x of ctx.data(t)) {
      if (x.aktivni === false) continue;
      const v = hodnotaK(hist, t + ':' + x.id, d);
      if (v !== null) { s += znam * v; neco = true; }
    }
    if (ctx.zapnuto('dluhopis')) for (const b of ctx.data('dluhopisy')) if (b.aktivni !== false && b.datum_vkladu && b.datum_vkladu <= d && (!b.splatnost || b.splatnost >= d)) { s += Number(b.vklad) || 0; neco = true; }
    if (neco) out.push({ datum: d, hodnota: s });
  }
  return out;
}

/* ---------- Účty: všechny produkty seskupené podle banky ---------- */
const atributy = (data) => raw(Object.entries(data || {}).map(([k, v]) => 'data-' + k + '="' + String(v).replace(/"/g, '&quot;') + '"').join(' '));
const tlacitkaPolozky = (p) => (p.tlacitka && p.tlacitka.length ? html`<div class="hbtns">${p.tlacitka.map((t) => html`<button type="button" class="btn2 slim" data-akce="${t.akce}" ${atributy(t.data)}>${t.text}</button>`)}</div>` : '');
const detailPolozky = (p) => html`${(p.detail || []).map(([l, v, t]) => html`<span class="kvl"><span>${l}</span><span class="num ${t || ''}">${v}</span></span>`)}`;
const ZOBRAZENI_UCTU = [['banky', 'Po bankách'], ['seznam', 'Seznam a detail'], ['dlazdice', 'Dlaždice']];
const pocetPolozek = (n) => n + (n === 1 ? ' položka' : n < 5 ? ' položky' : ' položek');

function seskupPodleBank(polozky) {
  const banky = [];
  const mapa = new Map();
  polozky.sort(podlePoradi).forEach((p) => {
    const k = (p.banka || 'Ostatní').trim();
    if (!mapa.has(k)) { const b = { banka: k, polozky: [], celkem: 0 }; mapa.set(k, b); banky.push(b); }
    mapa.get(k).polozky.push(p);
    mapa.get(k).celkem += p.hodnota || 0;
  });
  return banky;
}

const radekPolozky = (p, akce, on) => html`<button type="button" class="md-polozka ${on ? 'on' : ''}" data-akce="${akce}" data-id="${p.id}" ${akce === 'ucty.vyber' ? raw('aria-pressed="' + String(!!on) + '"') : ''}>
  <span class="md-n">${p.nazev}</span>
  <span class="num ${p.hodnota < 0 ? 'neg' : ''}">${p.hodnotaText || kc(p.hodnota)}</span></button>`;

function uctySeznamDetail(ctx, banky) {
  const vse = banky.flatMap((b) => b.polozky);
  const mobil = zarizeni() === 'mobil';
  const vybrany = vse.find((p) => p.id === ctx.ui.ucet) || (mobil ? null : vse[0]);
  const celkem = vse.reduce((s, p) => s + (p.hodnota || 0), 0);
  const seznam = html`<section class="card md-seznam">
    <div class="chead"><h2>Všechno</h2><span class="num ${celkem < 0 ? 'neg' : ''}">${kc(celkem)}</span></div>
    ${banky.map((b) => html`<div class="md-skupina" style="--bk:${vzhledBanky(b.banka).barva}"><div class="md-banka"><span class="md-bn">${odznak(b.banka)}${b.banka}</span><span class="num ${b.celkem < 0 ? 'neg' : ''}">${kc(b.celkem)}</span></div>
      ${b.polozky.map((p) => radekPolozky(p, 'ucty.vyber', vybrany && p.id === vybrany.id))}</div>`)}
  </section>`;
  const detail = vybrany ? html`<section class="card c-blue md-detail" style="--c:${vzhledBanky(vybrany.banka).barva}">
    ${mobil ? html`<button type="button" class="linkbtn md-zpet" data-akce="ucty.vyber" data-id="">← Všechny účty</button>` : ''}
    <div class="md-bn muted small">${odznak(vybrany.banka)}${vybrany.banka || ''}</div>
    <h2>${vybrany.nazev}</h2>
    <div class="num big2 ${vybrany.hodnota < 0 ? 'neg' : ''}">${vybrany.hodnotaText || kc(vybrany.hodnota)}</div>
    ${vybrany.pod ? html`<div class="muted small ${vybrany.podTrida || ''}">${vybrany.pod}</div>` : ''}
    <div class="md-kv">${detailPolozky(vybrany)}</div>
    ${tlacitkaPolozky(vybrany)}
  </section>` : '';
  if (mobil) return vybrany ? detail : seznam;
  return html`<div class="md">${seznam}<div class="md-prava">${detail}</div></div>`;
}

function uctyDlazdice(ctx, banky, prepinac) {
  const dl = banky.map((b, i) => ({ id: 'banka:' + b.banka, nazev: b.banka, barva: 'blue', poradi: i,
    souhrn: { hodnota: kc(b.celkem), trida: b.celkem < 0 ? 'neg' : '', pod: pocetPolozek(b.polozky.length) },
    barvaHex: vzhledBanky(b.banka).barva, logo: odznak(b.banka),
    html: karta('blue', html`<span class="md-bn">${odznak(b.banka)}${b.banka}</span>`, html`<div class="md-list">${b.polozky.map((p) => html`${radekPolozky(p, 'ucty.rozbal', ctx.ui.ucet === p.id)}
      ${ctx.ui.ucet === p.id ? html`<div class="md-rozbal">${detailPolozky(p)}${tlacitkaPolozky(p)}</div>` : ''}`)}</div>`,
      html`<span class="num ${b.celkem < 0 ? 'neg' : ''}">${kc(b.celkem)}</span>`, vzhledBanky(b.banka).barva) }));
  return vykresliDlazdice(ctx, 'ucty', dl, { vedle: prepinac });
}

export function uctyTab(ctx) {
  const ed = renderEditor(ctx);
  if (ed) return ed;
  const polozky = z(ctx, 'polozky').filter((p) => p.banka !== undefined);
  const pridat = z(ctx, 'pridat');
  const tlacitkaPridat = pridat.length ? html`<div class="hbtns center">${pridat.map((p) => html`<button type="button" class="btn2 slim" data-akce="${p.akce}" ${atributy(p.data)}>+ ${p.text}</button>`)}</div>` : '';
  if (!polozky.length) return html`${karta('blue', 'Zatím nic', html`<p class="muted">Přidej první účet nebo produkt.</p>`)}${tlacitkaPridat}`;
  const banky = seskupPodleBank(polozky);
  const zobr = nastaveniRozlozeni(ctx.cfg.rozlozeni, null, 'ucty', zarizeni()).zobrazeni || 'banky';
  const prep = segment('ucty.zobrazeni', zobr, ZOBRAZENI_UCTU);
  if (zobr === 'dlazdice') return html`${uctyDlazdice(ctx, banky, prep)}${tlacitkaPridat}`;
  const obsah = zobr === 'seznam' ? uctySeznamDetail(ctx, banky) : uctyPoBankach(ctx, banky);
  return html`<div class="ucty-zobr">${prep}</div>${obsah}${tlacitkaPridat}`;
}

function uctyPoBankach(ctx, banky) {
  const vybrana = banky.find((b) => b.banka === ctx.ui.banka) || banky[0];
  return html`
    <div class="banks" role="tablist" aria-label="Banky a instituce">${banky.map((b) => html`<button type="button" role="tab" aria-selected="${String(b === vybrana)}" class="bankbtn ${b === vybrana ? 'on' : ''}" data-akce="ucty.banka" data-hodnota="${b.banka}">${odznak(b.banka)}<span>${b.banka}</span></button>`)}</div>
    <section class="card"><div class="chead"><h2>${vybrana.banka} celkem</h2><span class="num big2 ${vybrana.celkem < 0 ? 'neg' : ''}">${kc(vybrana.celkem)}</span></div></section>
    <div class="accs">${vybrana.polozky.map((p) => {
      const otevreny = ctx.ui.ucet === p.id;
      return html`<div class="acc ${otevreny ? 'on' : ''}">
        <button type="button" class="accbtn" data-akce="ucty.rozbal" data-id="${p.id}" aria-expanded="${String(otevreny)}">
          <span class="arow"><span class="an">${p.nazev}</span><span class="num av ${p.hodnota < 0 ? 'neg' : ''}">${p.hodnotaText || kc(p.hodnota)}</span></span>
          ${p.pod ? html`<span class="as ${p.podTrida || ''}">${p.pod}</span>` : ''}
        </button>
        ${otevreny ? html`<div class="ad">${detailPolozky(p)}${tlacitkaPolozky(p)}</div>` : ''}
      </div>`;
    })}</div>`;
}

/* ---------- Zápis ---------- */
function stavyForm(ctx) {
  const pole = z(ctx, 'stavy');
  if (!pole.length) return karta('blue', 'Stavy', html`<p class="muted">Zatím nemáš žádné účty ani produkty. Přidej je v záložce Účty.</p>`);
  const skupiny = [];
  pole.forEach((p) => { let s = skupiny.find((x) => x.n === p.skupina); if (!s) { s = { n: p.skupina, pole: [] }; skupiny.push(s); } s.pole.push(p); });
  return html`<form class="card c-blue" data-akce="stavy.ulozit" autocomplete="off">
    <div class="formbar"><div><h2>Stavy účtů a produktů</h2><div class="muted small">Zapiš aktuální hodnoty. Uloží se jen změněná políčka, historie zůstane.</div></div>
      <div class="field" style="min-width:180px"><label for="sDatum">Ke dni</label><input id="sDatum" name="datum" type="date" value="${ctx.dnes}" required></div></div>
    ${skupiny.map((s) => html`<h3>${s.n}</h3><div class="form">${s.pole.map((p) => html`
      <div class="field"><label for="s_${p.klic}">${p.label}</label>
        <input id="s_${p.klic}" name="h_${p.klic}" inputmode="decimal" value="${cislo(p.hodnota)}" data-puvodni="${cislo(p.hodnota)}">
        <span class="hint">${p.napoveda || (p.k_datu ? 'naposledy ' + datum(p.k_datu) : 'zatím nezadáno')}</span></div>
      ${p.druha ? html`<div class="field"><label for="s2_${p.klic}">${p.druha.label}</label>
        <input id="s2_${p.klic}" name="d_${p.klic}" inputmode="decimal" value="${cislo(p.druha.hodnota)}" data-puvodni="${cislo(p.druha.hodnota)}">
        ${p.druha.napoveda ? html`<span class="hint">${p.druha.napoveda}</span>` : ''}</div>` : ''}`)}</div>`)}
    <div class="formbar"><span></span><button type="submit">Uložit stavy</button></div>
  </form>`;
}

export function zapisTab(ctx) {
  const ed = renderEditor(ctx);
  if (ed) return ed;
  const sekce = [];
  if (z(ctx, 'stavy').length || ctx.zapnuto('ucty')) sekce.push({ id: 'stavy', nazev: 'Stavy', poradi: 20, render: stavyForm });
  sekce.push(...ctx.moduly.flatMap((m) => m.zapis || []));
  sekce.sort(podlePoradi);
  if (!sekce.length) return karta('', 'Zápis', html`<p class="muted">Zapni v Nastavení aspoň jeden modul.</p>`);
  const aktivni = sekce.find((s) => s.id === ctx.ui.zapis) || sekce[0];
  return html`${sekce.length > 1 ? segment('app.zapisSub', aktivni.id, sekce.map((s) => [s.id, s.nazev])) : ''}${aktivni.render(ctx)}`;
}

/* ---------- Plány ---------- */
export function planySekce(ctx) {
  const s = [];
  if (z(ctx, 'vyhled').length) s.push({ id: 'vyhled', nazev: 'Výhled' });
  s.push({ id: 'grafy', nazev: 'Grafy' });
  s.push({ id: 'kolace', nazev: 'Koláče' });
  s.push(...ctx.moduly.flatMap((m) => m.planySub || []));
  return s;
}
function grafyVse(ctx) {
  const g = z(ctx, 'grafy');
  if (z(ctx, 'jmeni').length) g.push({ poradi: 5, id: 'gJmeni', nadpis: 'Čisté jmění v čase', pod: 'na konci měsíce, poslední 2 roky', barva: 'purple',
    kresli: (C, el) => { const r = cisteJmeniVCase(ctx, 24); cary(C, el, r.map((b) => popisMesice(b.datum)), [{ nazev: 'Čisté jmění', data: r.map((b) => b.hodnota), barva: cv('c-purple'), vypln: true }]); } });
  return g.sort(podlePoradi);
}
function kolaceVse(ctx) {
  const k = z(ctx, 'kolace');
  const jm = z(ctx, 'jmeni').filter((p) => p.hodnota > 0);
  if (jm.length) {
    const sk = new Map();
    jm.forEach((p) => sk.set(p.skupina, (sk.get(p.skupina) || 0) + p.hodnota));
    k.push({ poradi: 10, nadpis: 'Rozložení majetku', pod: 'kde máš peníze', barva: 'teal', popis: 'Celkem',
      polozky: [...sk.entries()].map(([nazev, hodnota]) => ({ nazev, hodnota })).sort((a, b) => b.hodnota - a.hodnota) });
    const inv = jm.filter((p) => p.skupina === 'Investice');
    if (inv.length > 1) k.push({ poradi: 30, nadpis: 'Investice podle hodnoty', pod: 'fondy, dluhopisy, pojištění', barva: 'blue', popis: 'Investice',
      polozky: inv.map((p) => ({ nazev: p.nazev, hodnota: p.hodnota })).sort((a, b) => b.hodnota - a.hodnota) });
  }
  return k.sort(podlePoradi);
}
export const popisMesice = (d) => MESICE[Number(d.slice(5, 7)) - 1].slice(0, 3) + ' ' + d.slice(2, 4);

const ENTITY = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
/** Text prvního nadpisu karty (pro název dlaždice). */
function nadpisZHtml(s) {
  const m = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(s);
  return m ? m[1].replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITY[e]).replace(/\s+/g, ' ').trim() : '';
}
const normalizujId = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function planyTab(ctx) {
  const ed = renderEditor(ctx);
  if (ed) return ed;
  const sekce = planySekce(ctx);
  const akt = sekce.find((s) => s.id === ctx.ui.plany) || sekce[0];
  let obsah;
  if (akt.id === 'vyhled') {
    const dl = ctx.moduly.flatMap((m) => (m.vyhled ? m.vyhled(ctx) : []).map((v, i) => {
      const s = v.html && v.html.s ? v.html.s : String(v.html || '');
      return { id: v.id || m.id + '-' + i, nazev: v.nazev || nadpisZHtml(s) || m.nazev, barva: v.barva || (/class="card c-(\w+)/.exec(s) || [])[1] || '',
        poradi: v.poradi, souhrn: v.souhrn || { hodnota: '', pod: 'klepni pro detail' }, html: v.html };
    })).sort(podlePoradi);
    obsah = vykresliDlazdice(ctx, 'plany-vyhled', dl, { minSirka: 440 });
  } else if (akt.id === 'grafy') {
    const g = grafyVse(ctx);
    obsah = g.length ? vykresliDlazdice(ctx, 'plany-grafy', g.map((x, i) => ({ id: x.id, nazev: x.nadpis, barva: x.barva || 'blue', poradi: i,
      souhrn: { hodnota: '', pod: (x.pod ? x.pod + ' · ' : '') + 'klepni pro graf' },
      html: html`<div class="card c-${x.barva || 'blue'}"><h2>${x.nadpis}</h2>${x.pod ? html`<div class="muted small">${x.pod}</div>` : ''}
      <div class="chart" style="${x.vyska ? 'height:' + x.vyska + 'px' : ''}"><canvas id="${x.id}" role="img" aria-label="${x.nadpis}"></canvas></div></div>` })), { minSirka: 440 })
      : karta('', 'Grafy', html`<p class="muted">Grafy se objeví, až budou data.</p>`);
  } else if (akt.id === 'kolace') {
    const k = kolaceVse(ctx);
    obsah = k.length ? vykresliDlazdice(ctx, 'plany-kolace', k.map((x, i) => ({ id: 'kolac-' + normalizujId(x.nadpis), nazev: x.nadpis, barva: x.barva || 'blue', poradi: i,
      souhrn: { hodnota: '', pod: (x.pod ? x.pod + ' · ' : '') + 'klepni pro koláč' },
      html: html`<div class="card c-${x.barva || 'blue'}"><h2>${x.nadpis}</h2><div class="muted small">${x.pod || ''}</div>
      <div class="donut"><canvas id="kolac${i}" role="img" aria-label="${x.nadpis}"></canvas></div></div>` })), { minSirka: 300 })
      : karta('', 'Koláče', html`<p class="muted">Koláče se objeví, až budou data.</p>`);
  } else obsah = akt.render(ctx);
  return html`${sekce.length > 1 ? segment('plany.sub', akt.id, sekce.map((s) => [s.id, s.nazev])) : ''}${obsah}`;
}

/** Po vykreslení: nakreslit grafy aktuální záložky. */
export async function poRenderu(ctx, tabId) {
  znicGrafy();
  if (tabId !== 'plany' || ctx.ui.editor) return;
  const sekce = planySekce(ctx);
  const akt = sekce.find((s) => s.id === ctx.ui.plany) || sekce[0];
  const ukoly = [];
  if (akt.id === 'grafy') grafyVse(ctx).forEach((g) => ukoly.push((C) => { const el = document.getElementById(g.id); if (el) g.kresli(C, el); }));
  else if (akt.id === 'kolace') kolaceVse(ctx).forEach((k, i) => ukoly.push((C) => { const el = document.getElementById('kolac' + i); if (el && k.polozky.length) kolac(C, el, k.polozky, k.popis || ''); }));
  else if (akt.poRenderu) ukoly.push((C) => akt.poRenderu(ctx, C));
  if (!ukoly.length) return;
  try {
    const C = await nactiChart();
    ukoly.forEach((u) => { try { u(C); } catch (e) { console.error(e); } });
  } catch (e) { ctx.zprava(e.message, true); }
}

/* ---------- akce ---------- */
/** Operace z formuláře stavů: { pridat: tab, radek } nebo { uprav: [tab, id, zmeny] }. */
async function provedOperace(ctx, ops) {
  const pridat = new Map();
  for (const o of ops) if (o.pridat) { if (!pridat.has(o.pridat)) pridat.set(o.pridat, []); pridat.get(o.pridat).push(o.radek); }
  for (const o of ops) if (o.uprav) await ctx.store.uprav(...o.uprav);
  for (const [tab, radky] of pridat) await ctx.store.pridejVice(tab, radky);
}
/** Pomocník pro moduly: nová hodnota ruční položky = úprava řádku + záznam do historie. */
export function opsHodnoty(tab, id, pole, hodnota, datumZmeny) {
  return [{ uprav: [tab, id, { [pole]: hodnota, k_datu: datumZmeny }] }, { pridat: 'historie', radek: { datum: datumZmeny, polozka: tab + ':' + id, hodnota } }];
}

export const zalozkyAkce = {
  'ucty.banka': (ctx, el) => { ctx.ui.banka = el.dataset.hodnota; ctx.ui.ucet = ''; },
  'ucty.rozbal': (ctx, el) => { ctx.ui.ucet = ctx.ui.ucet === el.dataset.id ? '' : el.dataset.id; },
  'ucty.vyber': (ctx, el) => { ctx.ui.ucet = el.dataset.id; if (zarizeni() === 'mobil') window.scrollTo(0, 0); },
  'ucty.zobrazeni': async (ctx, el) => { await ulozVolbu(ctx, 'ucty', 'zobrazeni', el.dataset.hodnota); },
  'plany.sub': (ctx, el) => { ctx.ui.plany = el.dataset.hodnota; },
  'stavy.ulozit': async (ctx, el, f) => {
    const ops = [];
    let n = 0;
    for (const p of z(ctx, 'stavy')) {
      const a = el.querySelector('[name="h_' + p.klic + '"]'), b = el.querySelector('[name="d_' + p.klic + '"]');
      const zmenaA = a && a.value.trim() !== a.dataset.puvodni.trim();
      const zmenaB = b && b.value.trim() !== b.dataset.puvodni.trim();
      if (!zmenaA && !zmenaB) continue;
      const va = precti(a.value), vb = b ? precti(b.value) : null;
      if ((va !== null && isNaN(va)) || (vb !== null && isNaN(vb))) throw new Error('U „' + p.label + '“ není číslo.');
      if (va === null) continue;
      ops.push(...p.uloz(va, vb, f.datum));
      n++;
    }
    if (!n) { ctx.zprava('Nic se nezměnilo.'); return; }
    await provedOperace(ctx, ops);
    ctx.zprava('Uloženo ' + n + ' ' + (n === 1 ? 'hodnota' : n < 5 ? 'hodnoty' : 'hodnot') + '.');
  },
  'editor.otevrit': (ctx, el) => {
    ctx.ui.editor = { tab: el.dataset.tab, id: el.dataset.id || '', predvyplnit: el.dataset.predvyplnit ? JSON.parse(el.dataset.predvyplnit) : null };
    window.scrollTo(0, 0);
  },
  'editor.zavrit': (ctx) => { ctx.ui.editor = null; },
  'editor.ulozit': async (ctx, el, f) => {
    const tab = el.dataset.tab;
    const def = definiceEditoru(ctx, tab);
    const zaznam = prectiEditor(def, f);
    const stary = f.id ? ctx.data(tab).find((x) => x.id === f.id) : null;
    const docasne = {};
    def.pole.filter((p) => p.docasne).forEach((p) => { docasne[p.n] = zaznam[p.n]; delete zaznam[p.n]; });
    if (def.historie && stary && zaznam[def.historie] !== stary[def.historie] && (!('k_datu' in zaznam) || zaznam.k_datu === stary.k_datu)) zaznam.k_datu = ctx.dnes;
    if (def.historie && !stary && 'k_datu' in zaznam && !zaznam.k_datu) zaznam.k_datu = ctx.dnes;
    let ulozeny;
    if (stary) ulozeny = await ctx.store.uprav(tab, f.id, zaznam);
    else ulozeny = await ctx.store.pridej(tab, { ...(ctx.store.maTabulku(tab) && !('aktivni' in zaznam) ? { aktivni: true } : {}), ...zaznam });
    if (def.historie && ulozeny[def.historie] !== null && ulozeny[def.historie] !== undefined && (!stary || stary[def.historie] !== ulozeny[def.historie]) && ctx.store.maTabulku('historie')) {
      await ctx.store.pridej('historie', { datum: ulozeny.k_datu || ctx.dnes, polozka: tab + ':' + ulozeny.id, hodnota: ulozeny[def.historie] });
    }
    if (def.poUlozeni) await def.poUlozeni(ctx, ulozeny, stary, docasne);
    ctx.ui.editor = null;
    ctx.zprava('Uloženo.');
  },
  'editor.smazat': async (ctx, el) => {
    const tab = el.dataset.tab, def = definiceEditoru(ctx, tab);
    const zaznam = ctx.data(tab).find((x) => x.id === el.dataset.id);
    if (!zaznam) return;
    const nazev = zaznam.nazev || zaznam.polozka || 'záznam';
    if (def.mazani === 'skryt') {
      if (!ctx.potvrd('Skrýt „' + nazev + '“? Zmizí z přehledů, data v tabulce zůstanou (vrátíš ho změnou sloupce „aktivni“ na TRUE).')) return false;
      await ctx.store.uprav(tab, zaznam.id, { aktivni: false });
    } else {
      if (!ctx.potvrd('Smazat „' + nazev + '“? Řádek se z tabulky odstraní.')) return false;
      await ctx.store.smaz(tab, zaznam.id);
    }
    ctx.ui.editor = null;
    ctx.zprava('Hotovo.');
  }
};
