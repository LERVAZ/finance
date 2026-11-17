/* Modul Roční zdroje: vratka daně, přeplatky, bonus – a jestli pokryjí roční platby. */
import { html } from '../html.js';
import { kc, sk, cislo, precti } from '../texty.js';
import { souhrnZdroju } from '../vypocty/produkty.js';
import { druhyZdroju } from './rocni.js';
import { sloupce, cv } from '../grafy.js';

const STAVY = { pokryje: 'st-ok', nepokryje: 'st-tento', 'doplň částku': 'st-dopln' };
const souhrn = (ctx) => ctx.pamet.zdroje || (ctx.pamet.zdroje = souhrnZdroju(ctx.data('rocni_zdroje'), druhyZdroju(ctx), ctx.zapnuto('rocni') ? ctx.data('rocni_platby') : [], ctx.dnes));

function vyhled(ctx) {
  const s = souhrn(ctx);
  return [{ poradi: 55, html: html`<section class="card c-green"><div class="chead"><h2>Roční zdroje</h2><span class="muted small">zbude <b class="num">${sk(s.celkem.zbude)}</b></span></div>
    <div class="mlist">${s.polozky.map((z) => html`<div class="mrow"><span class="n">${z.nazev}<span class="note">${z.pristi}${ctx.zapnuto('rocni') ? ' · platím z toho ' + (z.platim ? kc(z.platim) : '–') : ''}${z.odhad && z.ocekavam !== null ? ' · odhad podle minulého roku' : ''}</span></span>
      <span class="a ${z.ocekavam < 0 ? 'neg' : ''}">${z.ocekavam !== null ? sk(z.ocekavam) : '–'}</span>
      ${ctx.zapnuto('rocni') ? html`<span class="st ${STAVY[z.stav]}">${z.stav}</span>` : ''}</div>`)}</div>
    <div class="hbtns"><button type="button" class="btn2 slim" data-akce="prejdi" data-tab="zapis" data-sub="zdroje">Zapsat částky</button></div></section>` }];
}

function zapis(ctx) {
  const rok = Number(ctx.ui.zdrojeRok) || Number(ctx.dnes.slice(0, 4));
  const roky = [];
  for (let r = Number(ctx.dnes.slice(0, 4)) + 1; r >= Number(ctx.dnes.slice(0, 4)) - 6; r--) roky.push(r);
  const hodnota = (druh) => {
    const z = ctx.data('rocni_zdroje').filter((x) => Number(x.rok) === rok && x.druh === druh);
    return z.length ? z.reduce((t, x) => t + (Number(x.castka) || 0), 0) : null;
  };
  return html`<form class="card c-green" data-akce="zdroje.ulozit" autocomplete="off">
    <div class="formbar"><div><h2>Roční zdroje</h2><div class="muted small">Vratka daně, přeplatky, bonus. Nedoplatek piš s minusem.</div></div>
      <div class="field" style="min-width:140px"><label for="zRok">Rok</label><select id="zRok" name="rok" data-zmena="zdroje.rok">${roky.map((r) => html`<option ${r === rok ? 'selected' : ''}>${r}</option>`)}</select></div></div>
    <div class="form">${druhyZdroju(ctx).map((d, i) => html`<div class="field"><label for="z${i}">${d.nazev}</label>
      <input id="z${i}" name="z${i}" inputmode="decimal" value="${cislo(hodnota(d.nazev))}" placeholder="zatím nepřišlo"></div>`)}</div>
    <div class="formbar"><span></span><button type="submit">Uložit</button></div></form>`;
}

const akce = {
  'zdroje.rok': (ctx, el) => { ctx.ui.zdrojeRok = el.value; },
  'zdroje.ulozit': async (ctx, el, f) => {
    const rok = Number(f.rok);
    let n = 0;
    const nove = [];
    for (const [i, d] of druhyZdroju(ctx).entries()) {
      const v = precti(f['z' + i]);
      if (v !== null && isNaN(v)) throw new Error('U „' + d.nazev + '“ není číslo.');
      const existujici = ctx.data('rocni_zdroje').filter((x) => Number(x.rok) === rok && x.druh === d.nazev);
      if (existujici.length) {
        if (existujici.length === 1 && existujici[0].castka !== v) { await ctx.store.uprav('rocni_zdroje', existujici[0].id, { castka: v }); n++; }
      } else if (v !== null) { nove.push({ rok, druh: d.nazev, castka: v }); n++; }
    }
    if (nove.length) await ctx.store.pridejVice('rocni_zdroje', nove);
    ctx.zprava(n ? 'Uloženo.' : 'Nic se nezměnilo.');
  }
};

export default {
  id: 'zdroje',
  nazev: 'Roční zdroje',
  popis: 'Vratka daně, přeplatky, bonus – porovnání s ročními platbami.',
  ikona: 'plany',
  tabulky: ['rocni_zdroje'],
  vyhled,
  zapis: [{ id: 'zdroje', nazev: 'Roční zdroje', poradi: 60, render: zapis }],
  grafy: (ctx) => {
    const s = souhrn(ctx);
    if (!s.historie.length) return [];
    return [{ poradi: 60, id: 'gZdroje', nadpis: 'Roční zdroje po letech', pod: 'vratky, přeplatky a bonus', barva: 'green',
      kresli: (C, el) => {
        const b = [cv('c-purple'), cv('c-blue'), cv('c-amber'), cv('c-green'), cv('c-teal'), cv('c-red')];
        sloupce(C, el, s.historie.map((h) => String(h.rok)), druhyZdroju(ctx).map((d, i) => ({ nazev: d.nazev, data: s.historie.map((h) => h.hodnoty[i] || 0), barva: b[i % b.length] })), { skladany: true });
      } }];
  },
  akce
};
