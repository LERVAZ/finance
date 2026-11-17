/* Modul Investice a fondy: vloženo, hodnota, zisk Kč i %, výkonnost očištěná o vklady. */
import { html, karta, trida, raw } from '../html.js';
import { kc, sk, pct, cislo, datum } from '../texty.js';
import { souhrnInvestice, portfolio } from '../vypocty/investice.js';
import { cary, sloupce, cv, PALETA } from '../grafy.js';
import { popisMesice } from '../zalozky.js';

export const souhrny = (ctx) => ctx.pamet.inv || (ctx.pamet.inv = ctx.data('investice').filter((i) => i.aktivni !== false && i.id)
  .sort((a, b) => (Number(a.poradi) || 0) - (Number(b.poradi) || 0)).map((i) => souhrnInvestice(i, ctx.data('investice_historie'), ctx.dnes)));
const pf = (ctx) => ctx.pamet.pf || (ctx.pamet.pf = portfolio(souhrny(ctx).filter((s) => s.rada.length)));
const ziskText = (s) => (s.zisk === null ? '' : sk(s.zisk) + (s.ziskPct === null ? '' : ' · ' + pct(s.ziskPct, 1, true)));

const editor = {
  nadpisNovy: 'Nová investice', nadpis: 'Upravit investici', barva: 'teal', mazani: 'skryt',
  pole: [
    { n: 'nazev', l: 'Název', typ: 'text', povinne: true, placeholder: 'např. Fondy' },
    { n: 'instituce', l: 'Banka / instituce', typ: 'text', povinne: true },
    { n: 'mesicni_vklad', l: 'Pravidelný vklad měsíčně', typ: 'castka' },
    { n: 'od', l: 'Investuji od', typ: 'datum' },
    { n: 'hodnota', l: 'Hodnota dnes', typ: 'castka', docasne: true },
    { n: 'vlozeno', l: 'Celkem vloženo', typ: 'castka', docasne: true },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ],
  poUlozeni: async (ctx, i, stary, d) => {
    if (!stary && d.hodnota !== null && d.hodnota !== undefined) await ctx.store.pridej('investice_historie', { datum: ctx.dnes, investice_id: i.id, hodnota: d.hodnota, vlozeno: d.vlozeno });
    if (!stary) ctx.ui.banka = i.instituce;
  }
};

function polozky(ctx) {
  return souhrny(ctx).map((s) => ({
    id: s.id, banka: s.instituce, poradi: 300, nazev: s.nazev, hodnota: s.hodnota || 0, hodnotaText: kc(s.hodnota),
    pod: 'vloženo ' + kc(s.vlozeno) + (s.ziskPct !== null ? ' · ' + pct(s.ziskPct, 1, true) : ''), podTrida: trida(s.zisk),
    detail: [['Zisk celkem', sk(s.zisk), trida(s.zisk)], ['Poslední měsíc', pct(s.mesic, 2, true), trida(s.mesic)], ['Letos', pct(s.letos, 1, true), trida(s.letos)],
      ['Měsíční vklad', kc(s.mesicni_vklad)], ['Stav k', s.k_datu ? datum(s.k_datu) : '–']],
    tlacitka: [{ text: 'Upravit', akce: 'editor.otevrit', data: { tab: 'investice', id: s.id } }, { text: 'Zapsat hodnotu', akce: 'prejdi', data: { tab: 'zapis', sub: 'stavy' } }]
  }));
}

function stavy(ctx) {
  return souhrny(ctx).map((s) => {
    const novyMesic = s.k_datu && s.k_datu.slice(0, 7) < ctx.dnes.slice(0, 7);
    const navrh = s.vlozeno !== null && novyMesic && s.mesicni_vklad ? s.vlozeno + Number(s.mesicni_vklad) : s.vlozeno;
    return {
      klic: 'i_' + s.id, skupina: 'Investice', label: s.nazev + ' – hodnota', hodnota: s.hodnota, k_datu: s.k_datu,
      druha: { label: s.nazev + ' – celkem vloženo', hodnota: navrh, napoveda: novyMesic && s.mesicni_vklad ? 'navrženo: minule ' + kc(s.vlozeno) + ' + ' + kc(s.mesicni_vklad) : 'minule ' + kc(s.vlozeno) },
      uloz: (v, vl, d) => [{ pridat: 'investice_historie', radek: { datum: d, investice_id: s.id, hodnota: v, vlozeno: vl !== null ? vl : navrh } }]
    };
  });
}

function vyhled(ctx) {
  const S = souhrny(ctx);
  if (!S.length) return [];
  const p = pf(ctx);
  const posl = p[p.length - 1];
  const radky = S.map((s) => ({ nazev: s.nazev, vlozeno: s.vlozeno, hodnota: s.hodnota, zisk: s.zisk, ziskPct: s.ziskPct, letos: s.letos }));
  if (S.length > 1 && posl) {
    const z = posl.hodnota - posl.vlozeno;
    const letos = p.filter((b) => b.mesic.slice(0, 4) === ctx.dnes.slice(0, 4) && b.vykon !== null).reduce((t, b) => t * (1 + b.vykon), 1) - 1;
    radky.push({ nazev: 'Celkem', vlozeno: posl.vlozeno, hodnota: posl.hodnota, zisk: z, ziskPct: posl.vlozeno ? z / posl.vlozeno : null, letos, celkem: true });
  }
  const chip = (n, d) => (n === null || n === undefined ? html`<span class="muted">–</span>` : html`<span class="chip ${trida(n)}">${pct(n, d, true)}</span>`);
  return [{ poradi: 30, html: html`<section class="card c-blue"><h2>Investice</h2><div class="scroll"><table><thead><tr><th></th><th class="r">Vloženo</th><th class="r">Hodnota</th><th class="r">Zisk</th><th class="r">%</th><th class="r">Letos</th></tr></thead><tbody>
    ${radky.map((r) => html`<tr class="${r.celkem ? 'total' : ''}"><td>${r.nazev}</td><td class="r num">${kc(r.vlozeno)}</td><td class="r num">${kc(r.hodnota)}</td>
      <td class="r num ${trida(r.zisk)}">${sk(r.zisk)}</td><td class="r">${chip(r.ziskPct, 1)}</td><td class="r">${chip(r.letos, 1)}</td></tr>`)}</tbody></table></div>
    <div class="note">Výkonnost je očištěná o vklady: vklad v měsíci se nepočítá jako zisk.</div></section>` }];
}

function grafy(ctx) {
  const S = souhrny(ctx).filter((s) => s.rada.length > 1);
  if (!S.length) return [];
  const p = pf(ctx).slice(-36);
  return [
    { poradi: 20, id: 'gInvMesic', nadpis: 'Investice – měsíční výkonnost', pod: 'všechny investice dohromady, očištěno o vklady', barva: 'teal',
      kresli: (C, el) => { const b = p.filter((x) => x.vykon !== null); sloupce(C, el, b.map((x) => popisMesice(x.mesic + '-01')), [{ nazev: 'Výkonnost', data: b.map((x) => x.vykon), barvy: b.map((x) => (x.vykon >= 0 ? cv('green') : cv('red'))) }], { format: 'pct' }); } },
    { poradi: 21, id: 'gInvStart', nadpis: 'Investice – zisk od začátku', pod: 'kolik % jsi vydělal na vložených penězích', barva: 'teal',
      kresli: (C, el) => {
        const mesice = [...new Set(S.flatMap((s) => s.rada.map((b) => b.mesic)))].sort().slice(-60);
        const pal = PALETA();
        const rady = S.map((s, i) => ({ nazev: s.nazev, barva: pal[(i + 4) % pal.length], data: mesice.map((m) => { const b = s.rada.find((x) => x.mesic === m); return b && b.vlozeno ? (b.hodnota - b.vlozeno) / b.vlozeno : null; }) }));
        if (S.length > 1) rady.unshift({ nazev: 'Celkem', barva: cv('ink'), data: mesice.map((m) => { const b = pf(ctx).find((x) => x.mesic === m); return b && b.vlozeno ? (b.hodnota - b.vlozeno) / b.vlozeno : null; }) });
        cary(C, el, mesice.map((m) => popisMesice(m + '-01')), rady, 'pct');
      } }
  ];
}

export default {
  id: 'investice',
  nazev: 'Investice a fondy',
  popis: 'Vloženo, hodnota, zisk v Kč i %, měsíční a roční výkonnost očištěná o vklady.',
  ikona: 'plany',
  tabulky: ['investice', 'investice_historie'],
  editory: { investice: editor },
  polozky, stavy, vyhled, grafy,
  pridat: () => [{ text: 'Investice', akce: 'editor.otevrit', data: { tab: 'investice' } }],
  jmeni: (ctx) => souhrny(ctx).filter((s) => s.hodnota !== null).map((s) => ({ nazev: s.nazev, pod: s.instituce + ' · vloženo ' + kc(s.vlozeno), hodnota: s.hodnota,
    hodnota2: ziskText(s), trida2: trida(s.zisk), skupina: 'Investice' })),
  akce: {}
};
export { raw, cislo };
