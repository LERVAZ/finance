/* Modul Trvalé platby: den, částka, kategorie, z jakého účtu (a u převodu na jaký). */
import { html, karta } from '../html.js';
import { kc, cislo, datumKratce, precti, TYPY_TRVALYCH } from '../texty.js';
import { pridejMesice } from '../vypocty/datumy.js';
import { nejblizsiPlatby, podleUctu } from '../vypocty/platby.js';

function nazevUctu(ctx, id) {
  const u = ctx.data('ucty').find((x) => x.id === id);
  return u ? u.banka + ' – ' + u.nazev : '';
}

function form(ctx, t) {
  const nove = !t;
  t = t || { den: '', nazev: '', castka: '', kategorie: '', ucet_id: ctx.cfg.ucet_vyplaty || '', na_ucet_id: '', typ: 'Výdaj', aktivni: true, poznamka: '' };
  const ucty = ctx.zapnuto('ucty') ? ctx.data('ucty').filter((u) => u.aktivni !== false) : [];
  const volby = (vybrany, prazdne) => [html`<option value="">${prazdne}</option>`, ...ucty.map((u) => html`<option value="${u.id}" ${u.id === vybrany ? 'selected' : ''}>${u.banka} – ${u.nazev}</option>`)];
  return html`<form class="card c-amber" data-akce="trvale.ulozit" autocomplete="off">
    <h2>${nove ? 'Nová trvalá platba' : 'Upravit trvalou platbu'}</h2>
    <input type="hidden" name="id" value="${t.id || ''}">
    <div class="form">
      <div class="field"><label for="tN">Název</label><input id="tN" name="nazev" required value="${t.nazev}" placeholder="např. Nájem, Elektřina"></div>
      <div class="field"><label for="tA">Částka</label><input id="tA" name="castka" inputmode="decimal" required value="${cislo(t.castka)}"></div>
      <div class="field"><label for="tD">Den v měsíci</label><input id="tD" name="den" inputmode="numeric" value="${t.den ?? ''}" placeholder="prázdné = bez pevného dne"></div>
      <div class="field"><label for="tT">Typ</label><select id="tT" name="typ">${TYPY_TRVALYCH.map((x) => html`<option ${x === t.typ ? 'selected' : ''}>${x}</option>`)}</select></div>
      <div class="field"><label for="tK">Kategorie</label><select id="tK" name="kategorie">${ctx.kategorie().map((k) => html`<option ${k === t.kategorie ? 'selected' : ''}>${k}</option>`)}</select></div>
      ${ucty.length ? html`<div class="field"><label for="tU">Z účtu</label><select id="tU" name="ucet_id">${volby(t.ucet_id, '—')}</select></div>
        <div class="field"><label for="tNa">Na účet (jen u převodu na vlastní účet)</label><select id="tNa" name="na_ucet_id">${volby(t.na_ucet_id, '—')}</select></div>` : ''}
      <div class="field"><label for="tP">Poznámka</label><input id="tP" name="poznamka" value="${t.poznamka || ''}"></div>
      <label class="check"><input type="checkbox" name="aktivni" ${t.aktivni !== false ? 'checked' : ''}> Platba je aktivní</label>
    </div>
    <div class="formbar">
      ${nove ? '' : html`<button type="button" class="btn2" data-akce="trvale.smazat" data-id="${t.id}">Smazat</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn2" data-akce="trvale.zrusit">Zrušit</button>
      <button type="submit">Uložit</button>
    </div>
  </form>`;
}

function zapis(ctx) {
  if (ctx.ui.trvaleForm) return form(ctx, ctx.ui.trvaleForm === 'nova' ? null : ctx.data('trvale_platby').find((x) => x.id === ctx.ui.trvaleForm));
  const vse = [...ctx.data('trvale_platby')].sort((a, b) => (Number(a.den) || 99) - (Number(b.den) || 99));
  const skupiny = new Map();
  vse.forEach((x) => { const k = nazevUctu(ctx, x.ucet_id) || 'Bez účtu'; if (!skupiny.has(k)) skupiny.set(k, []); skupiny.get(k).push(x); });
  return html`<section class="card c-amber"><div class="chead"><h2>Trvalé platby</h2>
      <button type="button" class="slim" data-akce="trvale.nova">+ Přidat</button></div>
    ${vse.length ? [...skupiny.entries()].map(([ucet, polozky]) => html`<h3>${ucet}</h3><div class="mlist">${polozky.map((x) => html`<button type="button" class="mrow rowbtn ${x.aktivni === false ? 'off' : ''}" data-akce="trvale.upravit" data-id="${x.id}">
        <span class="d">${x.den ? x.den + '.' : 'měs.'}</span>
        <span class="n">${x.nazev}<span class="note">${x.typ}${x.kategorie ? ' · ' + x.kategorie : ''}${x.na_ucet_id ? ' → ' + nazevUctu(ctx, x.na_ucet_id) : ''}${x.aktivni === false ? ' · neaktivní' : ''}</span></span>
        <span class="a ${x.typ === 'Příjem' ? 'pos' : ''}">${x.typ === 'Příjem' ? '+' : '−'}${kc(x.castka)}</span></button>`)}</div>`)
      : html`<p class="muted">Zatím žádné. Přidej nájem, energie, telefon, pojistky…</p>`}
    <div class="note">Klepnutím na platbu ji upravíš.</div></section>`;
}

function karty(ctx) {
  // nejbližší platby: měsíc dopředu, rozdělené podle účtů (převod je u obou účtů)
  const polozky = nejblizsiPlatby({ dnes: ctx.dnes, vyplataDen: ctx.vyplataDen(), trvale: ctx.data('trvale_platby'),
    dluhopisy: ctx.zapnuto('dluhopis') ? ctx.data('dluhopisy') : [], dluhopisVynosy: ctx.data('dluhopis_vynosy'),
    vyplata: { castka: ctx.cfg.vyplata_castka, ucet_id: ctx.cfg.ucet_vyplaty || '' } });
  if (!polozky.length) return [];
  const skupiny = podleUctu(polozky, ctx.cfg.ucet_vyplaty || '');
  const jedna = skupiny.length === 1;
  const kratce = (id) => { const u = ctx.data('ucty').find((x) => x.id === id); return u ? u.nazev : ''; };
  const prvni = polozky[0];
  const plus = prvni.smer === 'prijem';
  return [{ id: 'platby', nazev: 'Nejbližší platby', barva: 'amber', poradi: 40,
    souhrn: { hodnota: (plus ? '+' : '−') + kc(prvni.castka), trida: plus ? 'pos' : '', pod: datumKratce(prvni.d) + ' ' + prvni.nazev },
    html: karta('amber', 'Nejbližší platby', html`<div class="platbyUcty">${skupiny.map((g) => html`<div>
    ${jedna ? '' : html`<h3 class="ucetHlava"><span>${nazevUctu(ctx, g.ucet_id) || 'Bez účtu'}</span>
      <span class="num ${g.bilance >= 0 ? 'pos' : ''}" title="co přijde minus co odejde">${g.bilance >= 0 ? '+' : '−'}${kc(Math.abs(g.bilance))}</span></h3>`}
    <div class="mlist">${g.polozky.map((p) => html`<div class="mrow">
      <span class="d">${datumKratce(p.d)}</span>
      <span class="n">${p.nazev}${p.protiucet && kratce(p.protiucet) ? html`<span class="note">${p.plus ? '← z: ' : '→ na: '}${kratce(p.protiucet)}</span>` : ''}</span>
      <span class="a ${p.plus ? 'pos' : ''}">${p.plus ? '+' : '−'}${kc(p.castka)}</span></div>`)}</div></div>`)}</div>
    <div class="note">Měsíc dopředu, do ${datumKratce(pridejMesice(ctx.dnes, 1))}${jedna ? '' : ' Číslo u účtu = co na něj přijde minus co z něj odejde.'}</div>`) }];
}

const akce = {
  'trvale.nova': (ctx) => { ctx.ui.trvaleForm = 'nova'; },
  'trvale.upravit': (ctx, el) => { ctx.ui.trvaleForm = el.dataset.id; },
  'trvale.zrusit': (ctx) => { ctx.ui.trvaleForm = ''; },
  'trvale.ulozit': async (ctx, el, f) => {
    const castka = precti(f.castka);
    if (castka === null || isNaN(castka)) throw new Error('Částka musí být číslo.');
    const den = f.den.trim() === '' ? null : Number(f.den);
    if (den !== null && !(den >= 1 && den <= 31 && Number.isInteger(den))) throw new Error('Den musí být číslo 1–31 nebo prázdné.');
    const z = { nazev: f.nazev.trim(), castka: Math.abs(castka), den, typ: f.typ, kategorie: f.kategorie || '',
      ucet_id: f.ucet_id || '', na_ucet_id: f.typ === 'Převod' ? (f.na_ucet_id || '') : '', aktivni: !!f.aktivni, poznamka: f.poznamka.trim() };
    if (f.id) await ctx.store.uprav('trvale_platby', f.id, z);
    else await ctx.store.pridej('trvale_platby', z);
    ctx.ui.trvaleForm = '';
    ctx.zprava('Uloženo: ' + z.nazev + '.');
  },
  'trvale.smazat': async (ctx, el) => {
    const t = ctx.data('trvale_platby').find((x) => x.id === el.dataset.id);
    if (!t || !ctx.potvrd('Smazat trvalou platbu „' + t.nazev + '“? Řádek se z tabulky odstraní. (Když ji chceš jen pozastavit, odškrtni „aktivní“.)')) return;
    await ctx.store.smaz('trvale_platby', t.id);
    ctx.ui.trvaleForm = '';
    ctx.zprava('Smazáno.');
  }
};

export default {
  id: 'trvale',
  nazev: 'Trvalé platby',
  popis: 'Pravidelné platby s dnem v měsíci. V útratách se odškrtávají podle data.',
  ikona: 'trvale',
  vychozi: true,
  tabulky: ['trvale_platby'],
  zapis: [{ id: 'trvale', nazev: 'Trvalé platby', poradi: 30, render: zapis }],
  karty,
  kolace: (ctx) => {
    // kam jdou příjmy: trvalé platby z výplaty po kategoriích (+ ostatní výdaje a zbytek z aktuálního období)
    const ucet = ctx.cfg.ucet_vyplaty;
    const t = ctx.data('trvale_platby').filter((x) => x.aktivni !== false && x.typ !== 'Příjem' && (!ucet || !x.ucet_id || x.ucet_id === ucet));
    if (!t.length) return [];
    const m = new Map();
    t.forEach((x) => { const k = x.typ === 'Investice' ? 'Investice a spoření' : (x.kategorie || 'Ostatní'); m.set(k, (m.get(k) || 0) + (Number(x.castka) || 0)); });
    const polozky = [...m.entries()].map(([nazev, hodnota]) => ({ nazev, hodnota })).sort((a, b) => b.hodnota - a.hodnota);
    if (ctx.zapnuto('utraty')) {
      const C = ctx.obdobi(ctx.aktualniKlic);
      if (C.vydaje) polozky.push({ nazev: 'Ostatní výdaje', hodnota: C.vydaje });
      if (C.zbyva > 0) polozky.push({ nazev: 'Zbývá', hodnota: C.zbyva, barva: getComputedStyle(document.documentElement).getPropertyValue('--green').trim() });
    }
    return [{ poradi: 20, nadpis: 'Kam jdou příjmy', pod: 'trvalé platby z výplaty' + (ctx.zapnuto('utraty') ? ' a tento měsíc' : ''), barva: 'green', popis: 'Měsíčně', polozky }];
  },
  akce
};
