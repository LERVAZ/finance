/* Převod hodnot mezi aplikací a buňkami tabulky.
   Datum se do tabulky zapisuje jako sériové číslo dne s formátem d.m.yyyy (čitelné pro člověka, nezávislé na lokalizaci).
   Čte se jako UNFORMATTED_VALUE + SERIAL_NUMBER a podle schématu se převede zpět na 'yyyy-mm-dd'. */
import { naSeriove, normalizujDatum } from '../vypocty/datumy.js';
import { precti } from '../texty.js';
import { typSloupce } from '../schema.js';

export function doBunky(typ, v) {
  if (v === undefined || v === null || v === '') return '';
  switch (typ) {
    case 'datum': { const d = normalizujDatum(v); return d ? naSeriove(d) : ''; }
    case 'cislo': case 'castka': { const n = Number(v); return isFinite(n) ? n : ''; }
    case 'bool': return v === true || v === 'true' || v === 'TRUE';
    case 'json': return typeof v === 'object' ? JSON.stringify(v) : v;
    default: return String(v);
  }
}

export function zBunky(typ, v) {
  if (v === undefined || v === null || v === '') return null;
  switch (typ) {
    case 'datum': return normalizujDatum(v);
    case 'cislo': case 'castka': {
      const n = typeof v === 'number' ? v : precti(v);
      return n === null || isNaN(n) ? null : n;
    }
    case 'bool': return v === true || /^(true|pravda|ano|1)$/i.test(String(v).trim());
    case 'json': {
      if (typeof v === 'string' && /^\s*[[{"]/.test(v)) { try { return JSON.parse(v); } catch (e) { return v; } }
      return v;
    }
    default: return String(v);
  }
}

/** Objekt → pole buněk v pořadí hlavičky listu (neznámé sloupce zůstanou prázdné). */
export function objektNaRadek(tab, hlavicka, obj) {
  return hlavicka.map((h) => (h in obj ? doBunky(typSloupce(tab, h), obj[h]) : ''));
}

/** Řádek tabulky → objekt podle hlavičky. Sloupce, které schéma nezná, se ponechají jako text. */
export function radekNaObjekt(tab, hlavicka, radek) {
  const o = {};
  hlavicka.forEach((h, i) => { if (h) o[h] = zBunky(typSloupce(tab, h), radek[i]); });
  return o;
}

export const prazdnyRadek = (radek) => !radek || radek.every((v) => v === '' || v === null || v === undefined);

/** Index sloupce → písmeno (0 → A, 26 → AA). */
export function pismeno(i) {
  let s = '';
  i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
