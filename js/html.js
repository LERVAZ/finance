/* Malý pomocník na skládání HTML: všechno vložené se escapuje, pokud to není raw(). */
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s ?? ''));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function val(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(val).join('');
  return esc(v);
}
export function html(strings, ...vals) {
  let o = '';
  strings.forEach((s, i) => { o += s; if (i < vals.length) o += val(vals[i]); });
  return new Raw(o);
}

const IKONY = {
  prehled: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  ucty: 'M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18M12 3l9 5H3z',
  utraty: 'M12 3v9l7 4M21 12a9 9 0 1 1-9-9',
  zapis: 'M12 5v14M5 12h14',
  trvale: 'M4 7h16M4 12h16M4 17h10M18 15l2 2-2 2',
  plany: 'M4 19V5M4 19h16M8 15l4-5 3 3 5-7',
  nastaveni: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  obnovit: 'M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5',
  zamek: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
  tabulka: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16'
};
export function ikona(nazev, vel = 22) {
  return raw('<svg width="' + vel + '" height="' + vel + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (IKONY[nazev] || IKONY.prehled) + '"></path></svg>');
}

/** Karta s barevným proužkem. */
export function karta(barva, nadpis, telo, vpravo, barvaHex) {
  return html`<section class="card ${barva ? 'c-' + barva : ''}" ${barvaHex ? raw('style="--c:' + barvaHex.replace(/[^#0-9a-fA-F]/g, '') + '"') : ''}>${nadpis ? html`<div class="chead"><h2>${nadpis}</h2>${vpravo || ''}</div>` : ''}${telo}</section>`;
}
/** Řádek seznamu: název + podnázev vlevo, hodnota (+ druhá hodnota) vpravo. */
export function radek(nazev, pod, hodnota, hodnota2, trida2) {
  return html`<div class="lrow"><span class="n">${nazev}${pod ? html`<span class="s">${pod}</span>` : ''}</span><span class="v"><span class="num">${hodnota}</span>${hodnota2 ? html`<span class="num small ${trida2 || ''}">${hodnota2}</span>` : ''}</span></div>`;
}
export const trida = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero');
/** Přepínač pod-záložek. akce = název akce, hodnota se předá v data-hodnota. */
export function segment(akce, aktivni, polozky) {
  return html`<div class="seg" role="tablist">${polozky.map(([id, nazev]) => html`<button type="button" role="tab" aria-selected="${String(id === aktivni)}" class="${id === aktivni ? 'on' : ''}" data-akce="${akce}" data-hodnota="${id}">${nazev}</button>`)}</div>`;
}
export function dlazdice(popis, hodnota, barva) {
  return html`<div class="mtile"><span class="l">${popis}</span><span class="v" style="color:${barva || 'var(--ink)'}">${hodnota}</span></div>`;
}
