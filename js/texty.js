/* Jazyk, měna a formáty na jednom místě. Pro jinou měnu / jazyk se mění jen tento soubor. */

export const JAZYK = 'cs';
export const LOCALE = 'cs-CZ';
export const MENA = 'Kč';
export const CASOVE_PASMO = 'Europe/Prague';

const NBSP = ' ';
const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** 1234567 → „1 234 567 Kč“ (nezlomitelné mezery, ať se částka nerozdělí na dva řádky). */
export function kc(n) {
  if (n === null || n === undefined || n === '' || !isFinite(n)) return '–';
  return nf0.format(Math.round(n)) + NBSP + MENA;
}
/** Částka se znaménkem: +1 200 Kč / −1 200 Kč. */
export function sk(n) {
  if (n === null || n === undefined || !isFinite(n)) return '–';
  const r = Math.round(n);
  return (r > 0 ? '+' : r < 0 ? '−' : '') + kc(Math.abs(r));
}
/** Číslo bez měny (do políček formuláře). */
export function cislo(n) {
  if (n === null || n === undefined || n === '' || !isFinite(n)) return '';
  return nf0.format(Math.round(n));
}
/** 0.038 → „3,8 %“ (zlomek). */
export function pct(n, des = 1, znamenko = false) {
  if (n === null || n === undefined || !isFinite(n)) return '–';
  const s = Math.abs(n * 100).toLocaleString(LOCALE, { minimumFractionDigits: des, maximumFractionDigits: des }) + NBSP + '%';
  if (!znamenko) return (n < 0 ? '−' : '') + s;
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
}
/** Přečte číslo napsané člověkem: „1 234,50 Kč“, „−500“, „12.5“. Prázdné → null, nesmysl → NaN. */
export function precti(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').replace(/[\s  ]|Kč|%/g, '').replace(/[−–]/g, '-').replace(',', '.');
  return s === '' ? null : Number(s);
}

export const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
/** 'yyyy-mm' → 'říjen 2026'. */
export const mesicRok = (m) => (m ? MESICE[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4) : '');
export const MESICE_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

/** '2026-11-17' → „17. 11. 2026“ */
export function datum(iso) {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-').map(Number);
  return d + '. ' + m + '. ' + y;
}
/** '2026-11-17' → „17. 11.“ */
export function datumKratce(iso) {
  if (!iso) return '–';
  const [, m, d] = iso.split('-').map(Number);
  return d + '. ' + m + '.';
}

/** Typy pohybů v modulu Útraty. Klíč se ukládá do tabulky, popis se ukazuje. */
export const TYPY_POHYBU = [
  { id: 'Výdaj', popis: 'Výdaj z běžného účtu', znak: '−' },
  { id: 'Ze spořicího', popis: 'Výdaj placený ze spořicího', znak: '−' },
  { id: 'Na spořicí', popis: 'Převod na spořicí', znak: '→ ' },
  { id: 'Převod ze spořicího', popis: 'Převod ze spořicího (není výdaj)', znak: '← ' },
  { id: 'Příjem', popis: 'Příjem (výplata apod.)', znak: '+' }
];
/** Typy trvalých plateb. */
export const TYPY_TRVALYCH = ['Výdaj', 'Investice', 'Převod', 'Příjem'];

export const KATEGORIE_VYCHOZI = ['Bydlení', 'Jídlo', 'Domácnost', 'Doprava', 'Telefon a internet', 'Děti', 'Zdraví', 'Oblečení',
  'Zábava', 'Dárky', 'Pojištění', 'Investice', 'Ostatní'];

export const TYPY_UCTU = [
  { id: 'bezny', nazev: 'Běžný účet' },
  { id: 'sporici', nazev: 'Spořicí účet' }
];
