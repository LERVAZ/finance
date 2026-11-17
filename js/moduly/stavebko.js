/* Modul Stavební spoření: naspořeno, cíl, měsíční vklad, poplatky. Provázané s hypotékou: datum převodu a scénáře. */
import { html, karta } from '../html.js';
import { kc, pct, datum } from '../texty.js';
import { postupStavebka, mesicText } from '../vypocty/hypoteka.js';
import { opsHodnoty } from '../zalozky.js';
import { hypoteky, vypocet } from './hypoteka.js';

const aktivni = (ctx) => ctx.data('stavebko').filter((s) => s.aktivni !== false && s.id);
/** Hypotéka, se kterou je stavebko provázané (jen když je modul Hypotéka zapnutý). */
const hypotekaK = (ctx, s) => (ctx.zapnuto('hypoteka') ? hypoteky(ctx).find((h) => h.stavebko_id === s.id) : null);

const editor = {
  nadpisNovy: 'Nové stavební spoření', nadpis: 'Upravit stavební spoření', barva: 'green', mazani: 'skryt', historie: 'nasporeno',
  pole: [
    { n: 'nazev', l: 'Název', typ: 'text', povinne: true, placeholder: 'např. Stavební spoření' },
    { n: 'instituce', l: 'Stavební spořitelna', typ: 'text', povinne: true },
    { n: 'nasporeno', l: 'Naspořeno', typ: 'castka', povinne: true },
    { n: 'k_datu', l: 'Ke dni', typ: 'datum' },
    { n: 'cilova_castka', l: 'Cílová částka', typ: 'castka' },
    { n: 'prideleni_pct', l: 'Přidělení při naspoření', typ: 'procenta', napoveda: '% z cílové částky, typicky 20–40 %' },
    { n: 'vklad_mesicne', l: 'Vklad měsíčně', typ: 'castka' },
    { n: 'poplatky_rocne', l: 'Poplatky ročně', typ: 'castka' },
    { n: 'urok_pa', l: 'Úrok z vkladů', typ: 'procenta' },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ],
  poznamkaFormulare: 'S hypotékou ho provážeš v editoru hypotéky (pole „Provázané stavební spoření“).'
};

function info(ctx, s) {
  const p = postupStavebka(s);
  const h = hypotekaK(ctx, s);
  const r = h ? vypocet(ctx, h) : null;
  return { p, h, r };
}

function karty(ctx) {
  return aktivni(ctx).map((s) => {
    const { p, h, r } = info(ctx, s);
    const splneno = Math.max(0, Math.min(1, p.splneno || 0));
    return { id: 'stavebko-' + s.id, nazev: s.nazev || 'Stavební spoření', barva: 'green', poradi: 50,
      souhrn: { hodnota: kc(p.nasporeno), pod: 'z ' + kc(p.prah) + (r && r.A.prevod ? ' · převod ' + mesicText(r.A.prevod) : '') },
      html: karta('green', h ? 'Stavebko → úrok ' + pct((h.sazba_po || h.sazba) / 100, 2) : s.nazev, html`
      <div class="bar" role="img" aria-label="Naspořeno ${Math.round(splneno * 100)} procent"><div style="width:${(splneno * 100).toFixed(1)}%"></div></div>
      <div class="split"><span class="num">${kc(p.nasporeno)}</span><span class="num muted">z ${kc(p.prah)}</span></div>
      ${r && r.A.prevod ? html`<div class="muted small">Převod: ${r.B ? 'plán A ' + mesicText(r.A.prevod) + ' · plán B ' + mesicText(r.B.prevod) : mesicText(r.A.prevod)}</div>` : ''}`) };
  });
}

function vyhled(ctx) {
  return aktivni(ctx).map((s) => {
    const { p, r } = info(ctx, s);
    const splneno = Math.max(0, Math.min(1, p.splneno || 0));
    const kv = [['Splněno', pct(p.splneno, 1)], ['Zbývá naspořit', kc(p.zbyva)], ['Měsíčně (po poplatku)', kc(p.vkladCisty)], ['Poplatky za rok', kc(s.poplatky_rocne)]];
    if (r && r.A.prevod) { kv.push(['Převod' + (r.B ? ' – plán A' : ''), html`<b>${mesicText(r.A.prevod)}</b>`]); if (r.B) kv.push(['Převod – plán B', html`<b>${mesicText(r.B.prevod)}</b>`]); }
    return { poradi: 15, html: karta('green', s.nazev, html`<div class="num" style="font-size:24px">${kc(p.nasporeno)} <span class="muted" style="font-size:15px">/ ${kc(p.prah)}</span></div>
      <div class="bar"><div style="width:${(splneno * 100).toFixed(1)}%"></div></div>
      <div class="kv">${kv.map(([l, v]) => html`<div><span class="muted">${l}</span><span class="num">${v}</span></div>`)}</div>`) };
  });
}

export default {
  id: 'stavebko',
  nazev: 'Stavební spoření',
  popis: 'Naspořeno, cíl, vklad, poplatky. S hypotékou spočítá datum převodu na nižší sazbu.',
  ikona: 'ucty',
  tabulky: ['stavebko', 'historie'],
  editory: { stavebko: editor },
  polozky: (ctx) => aktivni(ctx).map((s) => {
    const { p, r } = info(ctx, s);
    return { id: s.id, banka: s.instituce, poradi: 550, nazev: s.nazev, hodnota: Number(s.nasporeno) || 0,
      pod: (p.prah ? 'cíl ' + kc(p.prah) + ' · ' + pct(p.splneno, 1) : 'stavební spoření'),
      detail: [['Měsíčně (po poplatku)', kc(p.vkladCisty)], ['Zbývá naspořit', kc(p.zbyva)], ['Stav k', s.k_datu ? datum(s.k_datu) : '–'],
        ...(r && r.A.prevod ? [['Převod' + (r.B ? ' – plán A / B' : ''), mesicText(r.A.prevod) + (r.B ? ' / ' + mesicText(r.B.prevod) : '')]] : [])],
      tlacitka: [{ text: 'Upravit', akce: 'editor.otevrit', data: { tab: 'stavebko', id: s.id } }] };
  }),
  stavy: (ctx) => aktivni(ctx).map((s) => ({ klic: 's_' + s.id, skupina: 'Hypotéka a stavebko', label: s.nazev + ' – naspořeno', hodnota: s.nasporeno, k_datu: s.k_datu,
    uloz: (v, _b, d) => opsHodnoty('stavebko', s.id, 'nasporeno', v, d) })),
  pridat: () => [{ text: 'Stavební spoření', akce: 'editor.otevrit', data: { tab: 'stavebko' } }],
  karty, vyhled,
  jmeni: (ctx) => aktivni(ctx).map((s) => ({ nazev: s.nazev, hodnota: Number(s.nasporeno) || 0, skupina: 'Stavební spoření' })),
  akce: {}
};
