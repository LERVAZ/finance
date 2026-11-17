/* Modul Pevný výnos / dluhopis: vklad, měsíční výnos, splatnost, kolik už přišlo. */
import { html, trida } from '../html.js';
import { kc, sk, pct, datum } from '../texty.js';
import { souhrnDluhopisu } from '../vypocty/produkty.js';

export const souhrny = (ctx) => ctx.pamet.dl || (ctx.pamet.dl = ctx.data('dluhopisy').filter((d) => d.aktivni !== false && d.id)
  .map((d) => souhrnDluhopisu(d, ctx.data('dluhopis_vynosy'), ctx.dnes)));

const editor = {
  nadpisNovy: 'Nový dluhopis / pevný výnos', nadpis: 'Upravit dluhopis', barva: 'purple', mazani: 'skryt',
  pole: [
    { n: 'nazev', l: 'Název', typ: 'text', povinne: true },
    { n: 'emitent', l: 'Emitent / kde', typ: 'text' },
    { n: 'vklad', l: 'Vklad', typ: 'castka', povinne: true },
    { n: 'datum_vkladu', l: 'Datum vkladu', typ: 'datum' },
    { n: 'vynos_mesicne', l: 'Výnos měsíčně (čistý)', typ: 'castka', povinne: true },
    { n: 'prvni_vynos', l: 'První výnos', typ: 'datum', povinne: true, napoveda: 'podle dne se počítají další výplaty' },
    { n: 'splatnost', l: 'Splatnost', typ: 'datum', povinne: true },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ]
};
const editorVynosu = {
  nadpisNovy: 'Připsaný výnos', nadpis: 'Upravit výnos', barva: 'purple', mazani: 'smazat',
  pole: [
    { n: 'dluhopis_id', l: 'Dluhopis', typ: 'select', moznosti: (ctx) => ctx.data('dluhopisy').map((d) => [d.id, d.nazev]) },
    { n: 'datum', l: 'Datum', typ: 'datum', povinne: true },
    { n: 'castka', l: 'Částka', typ: 'castka', povinne: true },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ],
  poznamkaFormulare: 'Když nezapíšeš žádný výnos, aplikace počítá s výnosem podle plánu. Jakmile zapíšeš první, počítá jen se zapsanými.'
};

function detail(s) {
  return [['Výnos ročně', pct(s.pa, 2)], ['Vyděláno' + (s.odhad ? ' (podle plánu)' : ''), sk(s.vydelano), 'pos'], ['Letos', kc(s.letos)], ['Ještě přijde', kc(s.zbyva)],
    ['Připsáno výnosů', s.pripsano + ' z ' + s.pocet], ['Splatnost', datum(s.splatnost)]];
}

function vyhled(ctx) {
  return souhrny(ctx).map((s) => ({ poradi: 25, html: html`<section class="card c-purple"><h2>${s.nazev} – pevný výnos</h2>
    <div class="num" style="font-size:24px"><span class="pos">${kc(s.vydelano)}</span> <span class="muted" style="font-size:15px">vyděláno z ${kc(s.celkem)}</span></div>
    <div class="bar"><div style="width:${((s.prubeh || 0) * 100).toFixed(1)}%"></div></div>
    <div class="kv">${[['Vloženo', kc(s.vklad)], ['Splatnost', datum(s.splatnost)], ['Připsáno výnosů', s.pripsano + ' z ' + s.pocet], ['Zbývá do splatnosti', (s.zbyvaMes ?? '–') + ' měsíců'],
      ['Vyděláno letos', kc(s.letos)], ['Ještě přijde', kc(s.zbyva)]].map(([l, v]) => html`<div><span class="muted">${l}</span><span class="num">${v}</span></div>`)}</div>
    ${s.odhad ? html`<div class="note">Počítáno podle plánu (${kc(s.vynos_mesicne)} měsíčně). Skutečné výnosy můžeš zapsat tlačítkem níže.</div>` : ''}
    <div class="hbtns"><button type="button" class="btn2 slim" data-akce="editor.otevrit" data-tab="dluhopis_vynosy" data-predvyplnit="${JSON.stringify({ dluhopis_id: s.id, datum: ctx.dnes, castka: s.vynos_mesicne })}">Zapsat výnos</button></div></section>` }));
}

export default {
  id: 'dluhopis',
  nazev: 'Pevný výnos / dluhopis',
  popis: 'Vklad, měsíční výnos, splatnost a kolik už přišlo.',
  ikona: 'plany',
  tabulky: ['dluhopisy', 'dluhopis_vynosy'],
  editory: { dluhopisy: editor, dluhopis_vynosy: editorVynosu },
  polozky: (ctx) => souhrny(ctx).map((s) => ({ id: s.id, banka: s.emitent || s.nazev, poradi: 400, nazev: s.nazev, hodnota: s.vklad || 0,
    pod: 'pevný výnos ' + pct(s.pa, 2) + ' · splatnost ' + datum(s.splatnost), detail: detail(s),
    tlacitka: [{ text: 'Upravit', akce: 'editor.otevrit', data: { tab: 'dluhopisy', id: s.id } },
      { text: 'Zapsat výnos', akce: 'editor.otevrit', data: { tab: 'dluhopis_vynosy', predvyplnit: JSON.stringify({ dluhopis_id: s.id, datum: ctx.dnes, castka: s.vynos_mesicne }) } }] })),
  pridat: () => [{ text: 'Dluhopis', akce: 'editor.otevrit', data: { tab: 'dluhopisy' } }],
  vyhled,
  jmeni: (ctx) => souhrny(ctx).filter((s) => !s.splaceno).map((s) => ({ nazev: s.nazev, pod: 'pevný výnos · splatnost ' + datum(s.splatnost), hodnota: Number(s.vklad) || 0,
    hodnota2: sk(s.vydelano) + (s.vydelanoPct !== null ? ' · ' + pct(s.vydelanoPct, 1, true) : ''), trida2: trida(s.vydelano), skupina: 'Investice' })),
  akce: {}
};
