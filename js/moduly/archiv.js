/* Modul Archiv / projekty: jednorázové akce (stavba, rekonstrukce, refinancování) s rozpadem nákladů. */
import { html, karta, segment, dlazdice } from '../html.js';
import { kc, datum } from '../texty.js';
import { kolac } from '../grafy.js';

const projekty = (ctx) => [...new Set(ctx.data('archiv').map((x) => x.projekt).filter(Boolean))];

function rozbor(ctx, projekt) {
  const pol = ctx.data('archiv').filter((x) => x.projekt === projekt)
    .sort((a, b) => (Number(a.poradi) || 0) - (Number(b.poradi) || 0) || ((a.datum || '') < (b.datum || '') ? -1 : 1));
  const skupiny = [];
  pol.forEach((p) => {
    const k = p.skupina || 'Ostatní';
    let s = skupiny.find((x) => x.nazev === k);
    if (!s) { s = { nazev: k, polozky: [], naklad: 0, ostatni: 0 }; skupiny.push(s); }
    s.polozky.push(p);
    if (p.je_naklad === false) s.ostatni += Number(p.castka) || 0; else s.naklad += Number(p.castka) || 0;
  });
  return { skupiny, naklady: skupiny.reduce((t, s) => t + s.naklad, 0), ostatni: skupiny.reduce((t, s) => t + s.ostatni, 0) };
}

const editor = {
  nadpisNovy: 'Nová položka archivu', nadpis: 'Upravit položku', barva: 'purple', mazani: 'smazat',
  pole: [
    { n: 'projekt', l: 'Projekt', typ: 'text', povinne: true, placeholder: 'např. Stavba domu' },
    { n: 'skupina', l: 'Skupina', typ: 'text', placeholder: 'např. Pozemek, Stavba, Vybavení' },
    { n: 'polozka', l: 'Položka', typ: 'text', povinne: true },
    { n: 'castka', l: 'Částka', typ: 'castka' },
    { n: 'datum', l: 'Datum', typ: 'datum' },
    { n: 'je_naklad', l: 'Je to náklad (odškrtni např. u vrácení dluhu)', typ: 'bool' },
    { n: 'poradi', l: 'Pořadí', typ: 'cislo' },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ],
  poUlozeni: async (ctx, z) => { ctx.ui.projekt = z.projekt; ctx.ui.plany = 'archiv'; }
};

function render(ctx) {
  const pr = projekty(ctx);
  if (!pr.length) return karta('purple', 'Archiv', html`<p class="muted">Zatím prázdný. Sem patří jednorázové akce s rozpadem nákladů – stavba, rekonstrukce, refinancování…</p>
    <button type="button" data-akce="editor.otevrit" data-tab="archiv">+ Přidat položku</button>`);
  const akt = pr.includes(ctx.ui.projekt) ? ctx.ui.projekt : pr[0];
  const R = rozbor(ctx, akt);
  return html`${pr.length > 1 ? segment('archiv.projekt', akt, pr.map((p) => [p, p])) : ''}
    <section class="row"><div class="card c-purple" style="flex:3 1 560px"><div class="chead"><h2>${akt}</h2><span class="num big2">${kc(R.naklady)}</span></div>
      <div class="mtiles">${R.skupiny.filter((s) => s.naklad).map((s) => dlazdice(s.nazev, kc(s.naklad)))}</div>
      <div>${R.skupiny.map((s) => html`<details class="sec"><summary><span class="n">${s.nazev}</span><span class="num">${kc(s.naklad + s.ostatni)}</span></summary>
        ${s.polozky.map((p) => html`<button type="button" class="mrow rowbtn" data-akce="editor.otevrit" data-tab="archiv" data-id="${p.id}"><span class="n">${p.polozka}${p.datum ? html` <span class="muted small">${datum(p.datum)}</span>` : ''}
          ${p.je_naklad === false ? html` <span class="st st-src">není náklad</span>` : ''}${p.poznamka ? html`<span class="note">${p.poznamka}</span>` : ''}</span>
          <span class="a">${p.castka === null ? html`<span class="muted">–</span>` : kc(p.castka)}</span></button>`)}</details>`)}</div>
      ${R.ostatni ? html`<div class="note">Mimo náklady (vrácení dluhu apod.): ${kc(R.ostatni)}</div>` : ''}
      <div class="hbtns"><button type="button" class="btn2 slim" data-akce="editor.otevrit" data-tab="archiv" data-predvyplnit="${JSON.stringify({ projekt: akt, je_naklad: true })}">+ Položka</button>
        <button type="button" class="btn2 slim" data-akce="editor.otevrit" data-tab="archiv">+ Nový projekt</button></div></div>
    <div class="card c-purple" style="flex:2 1 320px"><h2>Rozpad nákladů</h2><div class="muted small">podle skupin</div>
      <div class="donut"><canvas id="gArchiv" role="img" aria-label="Rozpad nákladů"></canvas></div></div></section>`;
}

export default {
  id: 'archiv',
  nazev: 'Archiv a projekty',
  popis: 'Jednorázové akce (stavba, rekonstrukce, refinancování) s rozpadem nákladů.',
  ikona: 'tabulka',
  tabulky: ['archiv'],
  editory: { archiv: editor },
  planySub: [{ id: 'archiv', nazev: 'Archiv', render,
    poRenderu: (ctx, C) => {
      const pr = projekty(ctx);
      const el = document.getElementById('gArchiv');
      if (!el || !pr.length) return;
      const R = rozbor(ctx, pr.includes(ctx.ui.projekt) ? ctx.ui.projekt : pr[0]);
      const p = R.skupiny.filter((s) => s.naklad > 0).map((s) => ({ nazev: s.nazev, hodnota: s.naklad }));
      if (p.length) kolac(C, el, p, 'Celkem');
    } }],
  akce: { 'archiv.projekt': (ctx, el) => { ctx.ui.projekt = el.dataset.hodnota; } }
};
