/* Modul Hypotéka: zůstatek, sazba, splátka, scénáře splacení, úroky celkem. Volitelně provázaná se stavebním spořením. */
import { html, karta, trida } from '../html.js';
import { kc, sk, pct, datum } from '../texty.js';
import { simuluj, scenare, mesicText } from '../vypocty/hypoteka.js';
import { opsHodnoty } from '../zalozky.js';
import { cary, cv } from '../grafy.js';
import { souhrny as dluhopisy } from './dluhopis.js';

export const hypoteky = (ctx) => ctx.data('hypoteka').filter((h) => h.aktivni !== false && h.id);
const stavebkoK = (ctx, h) => (h.stavebko_id && ctx.zapnuto('stavebko') ? ctx.data('stavebko').find((s) => s.id === h.stavebko_id && s.aktivni !== false) : null);

/** Jednorázová částka pro scénář B: dluhopis podle nastavení, jinak první, který ještě není splatný. */
function jednorazova(ctx) {
  if (!ctx.zapnuto('dluhopis')) return null;
  const vse = dluhopisy(ctx).filter((d) => d.splatnost && d.splatnost > ctx.dnes);
  const d = vse.find((x) => x.id === ctx.cfg.scenar_dluhopis_id) || vse[0];
  if (!d) return null;
  const c = ctx.cfg;
  return { nazev: d.nazev, datum: d.splatnost, castka: Number(d.vklad) || 0, vynos_mesicne: Number(d.vynos_mesicne) || 0,
    castka_a: c.scenar_a_castka !== undefined && c.scenar_a_castka !== null && c.scenar_a_castka !== '' ? Number(c.scenar_a_castka) : undefined,
    vynos_a: c.scenar_a_vynos !== undefined && c.scenar_a_vynos !== null && c.scenar_a_vynos !== '' ? Number(c.scenar_a_vynos) : undefined };
}

/** Výpočet pro hypotéku: scénáře A/B (když je s čím počítat), jinak jeden výhled. Výsledek se pamatuje do dalšího vykreslení. */
export function vypocet(ctx, h) {
  const k = 'hyp_' + h.id;
  if (ctx.pamet[k]) return ctx.pamet[k];
  const s = stavebkoK(ctx, h);
  const j = jednorazova(ctx);
  const hh = { ...h, k_datu: h.k_datu || ctx.dnes };
  const r = j ? { ...scenare({ h: hh, s, jednorazova: j }), j, s } : { A: simuluj({ h: hh, s }), B: null, j: null, s };
  return (ctx.pamet[k] = r);
}

const editor = {
  nadpisNovy: 'Nová hypotéka / úvěr', nadpis: 'Upravit hypotéku', barva: 'amber', mazani: 'skryt', historie: 'zustatek',
  pole: [
    { n: 'nazev', l: 'Název', typ: 'text', povinne: true, placeholder: 'např. Hypotéka' },
    { n: 'banka', l: 'Banka', typ: 'text', povinne: true },
    { n: 'zustatek', l: 'Zbývá splatit', typ: 'castka', povinne: true },
    { n: 'k_datu', l: 'Zůstatek ke dni', typ: 'datum' },
    { n: 'sazba', l: 'Úroková sazba', typ: 'procenta', povinne: true },
    { n: 'splatka', l: 'Měsíční splátka', typ: 'castka', povinne: true },
    { n: 'sazba_po', l: 'Sazba po převodu stavebka', typ: 'procenta', napoveda: 'jen když je hypotéka provázaná se stavebním spořením' },
    { n: 'splatnost', l: 'Konec splatnosti', typ: 'datum', napoveda: 'když je vyplněný, splátka se po převodu přepočítá do tohoto data' },
    { n: 'stavebko_id', l: 'Provázané stavební spoření', typ: 'select', moznosti: (ctx) => [['', '—'], ...ctx.data('stavebko').filter((s) => s.aktivni !== false).map((s) => [s.id, s.nazev])] },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ]
};

function scenarTabulka(ctx, h, r) {
  const radek = (l, a, b) => html`<div class="muted">${l}</div><div class="v num">${a}</div>${r.B ? html`<div class="v num">${b}</div>` : ''}`;
  const A = r.A, B = r.B;
  return html`<div class="scen ${B ? '' : 'jeden'}"><div></div><div class="h v">${B ? 'A: ' + r.j.nazev + ' znovu investuji' : 'Výhled'}</div>${B ? html`<div class="h v">B: ${r.j.nazev} do ${r.s ? 'stavebka' : 'hypotéky'}</div>` : ''}
    ${r.s ? radek('Převod na ' + pct((h.sazba_po || h.sazba) / 100, 2), mesicText(A.prevod), B && mesicText(B.prevod)) : ''}
    ${r.s ? radek('Dluh po odečtení stavebka', kc(A.dluhPo), B && kc(B.dluhPo)) : ''}
    ${r.s ? radek('Splátka po převodu', kc(A.splatkaPo), B && kc(B.splatkaPo)) : ''}
    ${radek('Hypotéka splacena', html`<b>${mesicText(A.splaceno)}</b>`, B && html`<b>${mesicText(B.splaceno)}</b>`)}
    ${radek('Úroky celkem', kc(A.uroky), B && kc(B.uroky))}
    ${B ? radek('Čistá pozice na konci', kc(A.pozice), kc(B.pozice)) : ''}</div>
    ${B ? html`<div class="small">Rozdíl A − B: <span class="chip ${trida(r.rozdil)}">${sk(r.rozdil)}</span> <span class="muted">${r.rozdil > 0 ? '(vychází lépe A)' : r.rozdil < 0 ? '(vychází lépe B)' : ''}</span></div>
      <div class="note">A: výnos investice platí vklady do stavebka, po převodu jde navíc do splácení. B: po splatnosti jde částka do ${r.s ? 'stavebka (přebytek do hypotéky)' : 'hypotéky'}, výnos skončí.
        Čistá pozice k ${mesicText(r.konec)} = investice (v A) + co se naspoří po splacení hypotéky.</div>` : ''}`;
}

function vyhled(ctx) {
  return hypoteky(ctx).map((h) => ({ poradi: 10, html: karta('amber', h.nazev + ' – výhled', scenarTabulka(ctx, h, vypocet(ctx, h))) }));
}

function grafy(ctx) {
  return hypoteky(ctx).slice(0, 1).map((h) => ({ poradi: 10, id: 'gHyp', nadpis: 'Dluh: ' + h.nazev + (vypocet(ctx, h).B ? ' – A vs. B' : ''), pod: vypocet(ctx, h).B ? 'A: znovu investuji · B: do ' + (vypocet(ctx, h).s ? 'stavebka' : 'hypotéky') : 'výhled splácení', barva: 'amber',
    kresli: (C, el) => {
      const r = vypocet(ctx, h);
      const rocne = (rada) => rada.filter((b, i) => i % 12 === 0 || i === rada.length - 1);
      const a = rocne(r.A.rada), b = r.B ? rocne(r.B.rada) : [];
      const delsi = a.length >= b.length ? a : b;
      const pad = (x) => delsi.map((_, i) => (x[i] ? x[i].dluh : null));
      const rady = [{ nazev: r.B ? 'A: znovu investuji' : 'Dluh', data: pad(a), barva: cv('c-blue') }];
      if (r.B) rady.push({ nazev: 'B: do ' + (r.s ? 'stavebka' : 'hypotéky'), data: pad(b), barva: cv('c-amber'), carkovane: true });
      cary(C, el, delsi.map((x) => x.mesic.slice(0, 4)), rady);
    } }));
}

export default {
  id: 'hypoteka',
  nazev: 'Hypotéka',
  popis: 'Zůstatek, sazba, splátka, scénáře splacení a úroky celkem. Volitelně se stavebním spořením.',
  ikona: 'prehled',
  tabulky: ['hypoteka', 'historie'],
  editory: { hypoteka: editor },
  polozky: (ctx) => hypoteky(ctx).map((h) => {
    const r = vypocet(ctx, h);
    return { id: h.id, banka: h.banka, poradi: 600, nazev: h.nazev, hodnota: -(Number(h.zustatek) || 0),
      pod: 'sazba ' + pct(h.sazba / 100, 2) + ' · splátka ' + kc(h.splatka),
      detail: [['Úrok měsíčně cca', kc((Number(h.zustatek) || 0) * (Number(h.sazba) || 0) / 100 / 12)], ['Zůstatek ke dni', h.k_datu ? datum(h.k_datu) : '–'],
        ...(r.A.prevod ? [['Převod' + (r.B ? ' – plán A / B' : ''), mesicText(r.A.prevod) + (r.B ? ' / ' + mesicText(r.B.prevod) : '')]] : []),
        ['Splaceno' + (r.B ? ' – plán A / B' : ''), mesicText(r.A.splaceno) + (r.B ? ' / ' + mesicText(r.B.splaceno) : '')]],
      tlacitka: [{ text: 'Upravit', akce: 'editor.otevrit', data: { tab: 'hypoteka', id: h.id } }, { text: 'Výhled', akce: 'prejdi', data: { tab: 'plany' } }] };
  }),
  stavy: (ctx) => hypoteky(ctx).map((h) => ({ klic: 'h_' + h.id, skupina: 'Hypotéka a stavebko', label: h.nazev + ' – zbývá splatit', hodnota: h.zustatek, k_datu: h.k_datu,
    uloz: (v, _b, d) => opsHodnoty('hypoteka', h.id, 'zustatek', v, d) })),
  pridat: () => [{ text: 'Hypotéka', akce: 'editor.otevrit', data: { tab: 'hypoteka' } }],
  vyhled, grafy,
  jmeni: (ctx) => hypoteky(ctx).map((h) => ({ nazev: h.nazev, hodnota: -(Number(h.zustatek) || 0), skupina: 'Dluhy' })),
  akce: {}
};
