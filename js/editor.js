/* Společný editor záznamů: modul popíše pole a editor vykreslí formulář, přečte ho a uloží.
   Definice: { nadpis, pole: [...], historie?: 'nazev pole s hodnotou', mazani: 'smazat' | 'skryt' | null, poUlozeni?(ctx, novy, stary) }
   Pole: { n, l, typ: text|castka|cislo|procenta|datum|mesic|bool|select|textarea, povinne?, moznosti?: (ctx) => [[hodnota, popis]],
           napoveda?, placeholder?, vychozi?: (ctx) => hodnota, sirka?: 2 } */
import { html } from './html.js';
import { cislo, precti, MESICE } from './texty.js';

function vstup(ctx, p, v) {
  const id = 'ed_' + p.n;
  const ph = p.placeholder || '';
  if (p.typ === 'bool') return html`<label class="check"><input type="checkbox" name="${p.n}" ${v !== false && v !== null && v !== undefined ? 'checked' : ''}> ${p.l}</label>`;
  let ctrl;
  if (p.typ === 'select') {
    ctrl = html`<select id="${id}" name="${p.n}">${(p.moznosti ? p.moznosti(ctx) : []).map(([h, popis]) => html`<option value="${h}" ${String(h) === String(v ?? '') ? 'selected' : ''}>${popis}</option>`)}</select>`;
  } else if (p.typ === 'mesic') {
    ctrl = html`<select id="${id}" name="${p.n}"><option value="">nevím</option>${MESICE.map((m, i) => html`<option value="${i + 1}" ${Number(v) === i + 1 ? 'selected' : ''}>${m}</option>`)}</select>`;
  } else if (p.typ === 'textarea') {
    ctrl = html`<textarea id="${id}" name="${p.n}" rows="3" placeholder="${ph}">${v ?? ''}</textarea>`;
  } else if (p.typ === 'datum') {
    ctrl = html`<input id="${id}" name="${p.n}" type="date" value="${v || ''}" ${p.povinne ? 'required' : ''}>`;
  } else {
    const ciselne = p.typ === 'castka' || p.typ === 'cislo' || p.typ === 'procenta';
    const hodnota = p.typ === 'castka' ? cislo(v) : v === null || v === undefined ? '' : String(v).replace('.', ',');
    ctrl = html`<input id="${id}" name="${p.n}" class="${ciselne ? '' : 'txt'}" ${ciselne ? html`inputmode="decimal"` : ''} value="${hodnota}" placeholder="${ph}" ${p.povinne ? 'required' : ''} autocomplete="off">`;
  }
  return html`<div class="field ${p.sirka === 2 ? 'span2' : ''}"><label for="${id}">${p.l}${p.typ === 'procenta' ? ' (%)' : ''}</label>${ctrl}${p.napoveda ? html`<span class="hint">${p.napoveda}</span>` : ''}</div>`;
}

export function formularEditoru(ctx, def, tab, zaznam) {
  const novy = !zaznam;
  const z = zaznam || Object.fromEntries(def.pole.map((p) => [p.n, p.vychozi ? p.vychozi(ctx) : p.typ === 'bool' ? true : '']));
  return html`<form class="card c-${def.barva || 'blue'}" data-akce="editor.ulozit" data-tab="${tab}" autocomplete="off">
    <h2>${novy ? def.nadpisNovy || 'Nový záznam' : def.nadpis || 'Upravit'}</h2>
    <input type="hidden" name="id" value="${z.id || ''}">
    <div class="form">${def.pole.filter((p) => !(p.docasne && !novy)).map((p) => vstup(ctx, p, z[p.n]))}</div>
    ${def.poznamkaFormulare ? html`<p class="note">${def.poznamkaFormulare}</p>` : ''}
    <div class="formbar">
      ${!novy && def.mazani ? html`<button type="button" class="btn2" data-akce="editor.smazat" data-tab="${tab}" data-id="${z.id}">${def.mazani === 'skryt' ? 'Skrýt' : 'Smazat'}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn2" data-akce="editor.zavrit">Zrušit</button>
      <button type="submit">Uložit</button>
    </div>
  </form>`;
}

/** Přečte a ověří hodnoty formuláře podle definice. */
export function prectiEditor(def, f) {
  const o = {};
  for (const p of def.pole) {
    if (!(p.n in f) && p.typ !== 'bool') continue; // pole, které formulář neukázal (např. jen pro nový záznam)
    let v = f[p.n];
    if (p.typ === 'bool') { o[p.n] = !!v; continue; }
    v = typeof v === 'string' ? v.trim() : v;
    if (v === '' || v === undefined || v === null) {
      if (p.povinne) throw new Error('Vyplň: ' + p.l + '.');
      o[p.n] = null;
      continue;
    }
    if (p.typ === 'castka' || p.typ === 'cislo' || p.typ === 'procenta' || p.typ === 'mesic') {
      const n = precti(v);
      if (n === null || isNaN(n)) throw new Error('„' + p.l + '“ musí být číslo.');
      o[p.n] = n;
    } else o[p.n] = v;
  }
  return o;
}
