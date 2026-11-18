/* Modul Útraty za měsíc: období od výplaty do výplaty, výdaje, převody na/ze spořicího, kolik zbývá. */
import { html, raw, karta, dlazdice, trida } from '../html.js';
import { kc, sk, cislo, datumKratce, precti, MESICE, TYPY_POHYBU } from '../texty.js';
import { seznamObdobi, klicObdobi } from '../vypocty/obdobi.js';
import { zmenaSporiciho, jeVydaj } from '../vypocty/utraty.js';
import { zustatekK } from '../vypocty/ucty.js';
import { sloupce, cv } from '../grafy.js';
import { vykresliDlazdice } from '../rozlozeni.js';
import { pridejMesice } from '../vypocty/datumy.js';

const predchoziKlic = (klic) => pridejMesice(klic + '-01', -1).slice(0, 7);

/** Popisek hlavního čísla podle stavu období. */
function popisZbyva(C) {
  if (C.aktualni) return 'Zbývá z výplaty teď';
  if (C.uzavrene) return C.zbyva >= 0 ? 'Zbylo z výplaty' : 'Utraceno navíc';
  return 'Zbude z výplaty (plán)';
}
const zaObdobi = (C) => (C.aktualni ? 'od výplaty' : 'za období');

/**
 * Dvě velká čísla vedle sebe: výsledek předchozího období a zbývá z výplaty ve vybraném období.
 * P = předchozí období, C = vybrané (na Přehledu aktuální).
 */
function dveCisla(ctx, P, C, nadpisMinule = 'Minulé období') {
  const minule = P.zbyva >= 0 ? 'zbylo' : 'utraceno navíc';
  return html`<div class="dve-cisla">
    <div class="dc"><span class="l">${nadpisMinule} · ${minule}</span>
      <span class="v num ${trida(P.zbyva)}">${sk(P.zbyva)}</span>
      <span class="p">${P.hranice.popisek}${P.odhad ? ' · výplata odhadem' : ''}</span>
      <span class="p">na spořicí přibylo za období <b class="num ${trida(P.naSporiciZObdobi)}">${sk(P.naSporiciZObdobi)}</b></span></div>
    <div class="dc hl"><span class="l">${popisZbyva(C)}</span>
      <span class="v num ${trida(C.zbyva)}">${sk(C.zbyva)}${C.odhad ? html` <span class="small muted">odhad</span>` : ''}</span>
      <span class="p">${C.hranice.popisek}</span>
      ${ctx.zapnuto('trvale') && C.trvCeka > 0 ? html`<span class="p">po všech trvalých platbách <b class="num ${trida(C.zbyvaPoVsech)}">${sk(C.zbyvaPoVsech)}</b> <span class="muted">(čeká −${kc(C.trvCeka)})</span></span>` : ''}
      <span class="p">na spořicí přibylo ${zaObdobi(C)} <b class="num ${trida(C.naSporiciZObdobi)}">${sk(C.naSporiciZObdobi)}</b></span></div>
  </div>`;
}

const BARVY = ['var(--c-blue)', 'var(--c-teal)', 'var(--c-green)', 'var(--c-purple)', 'var(--c-amber)', 'var(--c-red)', '#E879A6', '#8FA3B8'];
const znak = (typ) => (TYPY_POHYBU.find((t) => t.id === typ) || { znak: '−' }).znak;

function radekPohybu(x, smazat = true) {
  const vydaj = jeVydaj(x.typ);
  const stitek = vydaj ? (x.kategorie || 'Ostatní') + (x.typ === 'Ze spořicího' ? ' · ze spořicího' : '') : x.typ.toLowerCase();
  return html`<div class="mrow"><span class="d">${datumKratce(x.datum)}</span>
    <span class="n">${x.popis || x.typ} <span class="st ${vydaj ? 'st-dopln' : 'st-src'}">${stitek}</span>${x.zdroj === 'banka' ? html` <span class="st st-src">banka</span>` : ''}
      ${x.poznamka ? html`<span class="note">${x.poznamka}</span>` : ''}</span>
    <span class="a ${x.typ === 'Příjem' ? 'pos' : vydaj ? 'neg' : ''}">${znak(x.typ)}${kc(x.castka)}</span>
    ${smazat ? html`<button type="button" class="xbtn" data-akce="utraty.smazat" data-id="${x.id}" aria-label="Smazat ${x.popis || x.typ}">×</button>` : ''}</div>`;
}

function zalozka(ctx) {
  const aktualni = ctx.aktualniKlic;
  const klic = ctx.ui.obdobi || aktualni;
  const C = ctx.obdobi(klic);
  const sporici = ctx.cfg.ucet_sporici ? ctx.uctyPrehled().find((u) => u.id === ctx.cfg.ucet_sporici) : null;
  const moznosti = seznamObdobi(aktualni, 12, 1);
  const vyber = html`<label class="sr-only" for="mPer">Období</label><select id="mPer" class="ut-obdobi" data-zmena="utraty.obdobi">${moznosti.map((k) => {
      const [y, m] = k.split('-').map(Number);
      return html`<option value="${k}" ${k === klic ? 'selected' : ''}>${MESICE[m - 1]} ${y}${k === aktualni ? ' (aktuální)' : ''}</option>`;
    })}</select>
    <button type="button" class="slim" data-akce="prejdi" data-tab="zapis" data-sub="platba">+ Zapsat platbu</button>`;
  const dl = [];
  const P = ctx.obdobi(predchoziKlic(klic));
  dl.push({ id: 'souhrn', nazev: 'Měsíční přehled', barva: 'teal', poradi: 10,
    souhrn: { hodnota: sk(C.zbyva), trida: trida(C.zbyva), pod: popisZbyva(C).toLowerCase() + ' · ' + C.hranice.popisek },
    html: karta('teal', 'Měsíční přehled', html`<div class="muted small">Od výplaty do výplaty · ${C.hranice.popisek}</div>
    ${dveCisla(ctx, P, C, 'Předchozí období')}
    <div class="mtiles">
      ${dlazdice('Výplata / příjmy', raw(kc(C.prijmy) + (C.odhad ? ' <span class="small muted">odhad</span>' : '')), 'var(--green)')}
      ${ctx.zapnuto('trvale') ? dlazdice(C.trvCeka ? 'Trvalé odešly (z ' + kc(C.trvSoucet) + ')' : 'Trvalé platby odešly', '−' + kc(C.trvOdeslo)) : ''}
      ${dlazdice('Ostatní výdaje', '−' + kc(C.vydaje), C.vydaje ? 'var(--red)' : '')}
      ${sporici ? dlazdice(sporici.nazev + ' teď', kc(sporici.zustatek), 'var(--c-blue)') : ''}
    </div>
    <div class="small muted">Na spořicí převedeno ${kc(C.naSporici)}, zpět ze spořicího ${kc(C.zeSporiciho)} (převody se jako útrata nepočítají).
      ${C.uzavrene && Math.round(C.naBeznem) ? html` Rozdíl proti „zbylo“ ${sk(C.naBeznem)} zůstal na běžném účtu, nebo chybí zapsaný převod.` : ''}
      ${C.odhad ? html` · <button type="button" class="linkbtn" data-akce="utraty.zapsatVyplatu">zapsat skutečnou výplatu</button>` : ''}</div>`) });
  if (ctx.zapnuto('trvale')) {
    const odeslo = C.trvale.filter((x) => x.odeslo).length;
    dl.push({ id: 'trvale', nazev: 'Trvalé platby', barva: 'amber', poradi: 20,
      souhrn: { hodnota: '−' + kc(C.trvSoucet), pod: odeslo + ' z ' + C.trvale.length + ' odešlo' },
      html: karta('amber', 'Trvalé platby', html`<div class="mlist">${C.trvale.length ? C.trvale.map((x) => html`<div class="mrow ${x.odeslo ? 'done' : ''}">
          <span class="d">${x.datum ? datumKratce(x.datum) : 'měs.'}</span><span class="n">${x.nazev}${x.poznamka ? html`<span class="note">${x.poznamka}</span>` : ''}</span>
          <span class="a">−${kc(x.castka)}</span><span class="st ${x.odeslo ? 'st-ok' : 'st-blizi'}">${x.odeslo ? 'odešlo' : 'čeká'}</span></div>`)
        : html`<div class="muted small">Žádné trvalé platby z výplaty.</div>`}</div>`, html`<span class="num">−${kc(C.trvSoucet)}</span>`) });
  }
  dl.push({ id: 'pohyby', nazev: 'Další platby a převody', barva: 'red', poradi: 30,
    souhrn: { hodnota: '−' + kc(C.vydaje), trida: C.vydaje ? 'neg' : '', pod: C.pohyby.length + (C.pohyby.length === 1 ? ' pohyb' : C.pohyby.length < 5 && C.pohyby.length ? ' pohyby' : ' pohybů') },
    html: karta('red', 'Další platby a převody', html`<div class="mlist">${C.pohyby.length ? C.pohyby.map((x) => radekPohybu(x)) : html`<div class="muted small" style="padding:10px 0">Zatím nic.</div>`}</div>`) });
  if (C.kategorie.length) {
    dl.push({ id: 'kategorie', nazev: 'Kam šly peníze', barva: 'purple', poradi: 40,
      souhrn: { hodnota: kc(C.kategorie[0].castka), pod: 'nejvíc: ' + C.kategorie[0].nazev },
      html: karta('purple', 'Kam šly peníze', html`<div class="hbars">${C.kategorie.map((c, i) => html`<div class="hbar"><span>${c.nazev}</span>
      <span class="track"><div style="width:${(c.castka / C.kategorie[0].castka * 100).toFixed(1)}%;background:${BARVY[i % BARVY.length]}"></div></span><span class="num r">${kc(c.castka)}</span></div>`)}</div>`) });
  }
  return vykresliDlazdice(ctx, 'utraty', dl, { vedle: vyber });
}

function zapisPlatby(ctx) {
  const kategorie = ctx.kategorie();
  const posledni = [...ctx.data('pohyby')].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0)).slice(0, 20);
  const p = ctx.ui.predvyplnit || {};
  return html`<form class="card c-teal" data-akce="utraty.pridat" autocomplete="off">
    <h2>Nová platba nebo převod</h2>
    <div class="form5">
      <div class="field"><label for="pT">Typ</label><select id="pT" name="typ" data-zmena="utraty.typ">${TYPY_POHYBU.map((t) => html`<option value="${t.id}" ${t.id === (p.typ || 'Výdaj') ? 'selected' : ''}>${t.popis}</option>`)}</select></div>
      <div class="field"><label for="pN">Za co</label><input id="pN" name="popis" value="${p.popis || ''}" placeholder="např. nákup, telefon…"></div>
      <div class="field"><label for="pA">Částka</label><input id="pA" name="castka" inputmode="decimal" required value="${p.castka ? cislo(p.castka) : ''}" placeholder="0"></div>
      <div class="field"><label for="pK">Kategorie</label><select id="pK" name="kategorie" ${p.typ && !jeVydaj(p.typ) ? 'disabled' : ''}>${kategorie.map((k) => html`<option>${k}</option>`)}</select></div>
      <div class="field"><label for="pD">Datum</label><input id="pD" name="datum" type="date" required value="${p.datum || ctx.dnes}"></div>
      <button type="submit">Přidat</button>
    </div>
  </form>
  <section class="card"><h2>Poslední pohyby</h2><div class="mlist">${posledni.length ? posledni.map((x) => radekPohybu(x)) : html`<div class="muted small">Zatím nic zapsaného.</div>`}</div></section>`;
}

function karty(ctx) {
  const C = ctx.obdobi(ctx.aktualniKlic);
  const P = ctx.obdobi(predchoziKlic(ctx.aktualniKlic));
  return [{ id: 'mesic', nazev: 'Výplata', barva: 'green', poradi: 20,
    souhrn: { hodnota: sk(C.zbyva), trida: trida(C.zbyva), pod: 'zbývá z výplaty · do ' + datumKratce(C.hranice.konec) },
    html: karta('green', 'Výplata', html`${dveCisla(ctx, P, C)}
    <div class="split"><span>útraty <b class="num ${C.vydaje ? 'neg' : ''}">${C.vydaje ? '−' : ''}${kc(C.vydaje)}</b></span>
      ${ctx.zapnuto('trvale') ? html`<span>trvalé <b class="num">−${kc(C.trvSoucet)}</b></span>` : ''}</div>
    <button type="button" class="btn2 slim" data-akce="prejdi" data-tab="utraty">Útraty za měsíc →</button>`) }];
}

/** Pohyb na spořicí / ze spořicího: zapíše nový stav spořicího účtu (historie zůstane čitelná). */
async function upravSporici(ctx, delta, kDatu, popis) {
  const id = ctx.cfg.ucet_sporici;
  if (!delta || !id || !ctx.zapnuto('ucty') || !ctx.store.maTabulku('stavy')) return '';
  const pred = zustatekK(ctx.data('stavy'), id);
  if (!pred) return ' Spořicí účet nemá zadaný zůstatek, zůstatek se neupravil.';
  const d = pred.datum > kDatu ? pred.datum : kDatu;
  await ctx.store.pridej('stavy', { datum: d, ucet_id: id, zustatek: pred.zustatek + delta, zdroj: 'pohyb', poznamka: popis });
  return ' Spořicí účet ' + sk(delta) + '.';
}

const akce = {
  'utraty.obdobi': (ctx, el) => { ctx.ui.obdobi = el.value; },
  'utraty.typ': (ctx, el) => { const k = el.form.querySelector('[name="kategorie"]'); if (k) k.disabled = !jeVydaj(el.value); return false; },
  'utraty.zapsatVyplatu': (ctx) => {
    const klic = ctx.ui.obdobi || ctx.aktualniKlic;
    ctx.ui.predvyplnit = { typ: 'Příjem', popis: 'Výplata', castka: ctx.cfg.vyplata_castka || '', datum: ctx.obdobi(klic).hranice.zacatek };
    ctx.prejdi('zapis', 'platba');
  },
  'utraty.pridat': async (ctx, el, f) => {
    const castka = precti(f.castka);
    if (castka === null || isNaN(castka) || !f.datum) throw new Error('Vyplň datum a částku.');
    if (f.typ === 'Ze spořicího' && !f.popis.trim()) throw new Error('U výdaje ze spořicího napiš, za co to bylo.');
    const z = { datum: f.datum, popis: f.popis.trim(), castka: Math.abs(castka), typ: f.typ,
      kategorie: jeVydaj(f.typ) ? (f.kategorie || 'Ostatní') : '', ucet_id: ctx.cfg.ucet_sporici && zmenaSporiciho(f.typ, 1) ? ctx.cfg.ucet_sporici : '', zdroj: 'ručně' };
    await ctx.store.pridej('pohyby', z);
    const sp = await upravSporici(ctx, zmenaSporiciho(z.typ, z.castka), z.datum, (z.popis || z.typ));
    ctx.ui.predvyplnit = null;
    ctx.ui.obdobi = klicObdobi(z.datum, ctx.kalendar());
    ctx.zprava('Přidáno: ' + (z.popis || z.typ) + ' ' + kc(z.castka) + '.' + sp);
  },
  'utraty.smazat': async (ctx, el) => {
    const p = ctx.data('pohyby').find((x) => x.id === el.dataset.id);
    if (!p) return;
    if (!ctx.potvrd('Smazat „' + (p.popis || p.typ) + '“ ' + kc(p.castka) + ' z ' + datumKratce(p.datum) + '? Řádek se z tabulky odstraní.')) return;
    await ctx.store.smaz('pohyby', p.id);
    const sp = await upravSporici(ctx, -zmenaSporiciho(p.typ, p.castka), ctx.dnes, 'zrušeno: ' + (p.popis || p.typ));
    ctx.zprava('Smazáno.' + sp);
  }
};

export default {
  id: 'utraty',
  nazev: 'Útraty za měsíc',
  popis: 'Období od výplaty do výplaty: výdaje, převody na spořicí a kolik zbývá.',
  ikona: 'utraty',
  vychozi: true,
  tabulky: ['pohyby'],
  zalozka: { id: 'utraty', nazev: 'Útraty', titulek: 'Útraty za měsíc', ikona: 'utraty', poradi: 30, render: zalozka },
  zapis: [{ id: 'platba', nazev: 'Platby', poradi: 10, render: zapisPlatby }],
  karty,
  grafy: (ctx) => {
    if (!ctx.data('pohyby').length) return [];
    return [{ poradi: 40, id: 'gUtraty', nadpis: 'Útraty po měsících', pod: 'od výplaty do výplaty, posledních 12 období', barva: 'green',
      kresli: (C, el) => {
        const klice = seznamObdobi(ctx.aktualniKlic, 12, 0).reverse();
        const o = klice.map((k) => ctx.obdobi(k));
        const rady = [{ nazev: 'Ostatní výdaje', data: o.map((x) => x.vydaje), barva: cv('c-red') }];
        if (ctx.zapnuto('trvale')) rady.unshift({ nazev: 'Trvalé platby', data: o.map((x) => x.trvSoucet), barva: cv('c-blue') });
        sloupce(C, el, klice.map((k) => MESICE[Number(k.slice(5)) - 1].slice(0, 3) + ' ' + k.slice(2, 4)), rady, { skladany: true });
      } }];
  },
  akce
};
