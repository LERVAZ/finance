/* Práce s datem. Uvnitř aplikace je datum vždy text 'yyyy-mm-dd' (bez časových pásem). */

export const pad2 = (n) => (n < 10 ? '0' : '') + n;
export const iso = (y, m, d) => y + '-' + pad2(m) + '-' + pad2(d);
export const rozloz = (s) => s.split('-').map(Number);

/** Počet dní v měsíci (m = 1–12). */
export function dniVMesici(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

/** Dnešní datum v daném časovém pásmu. */
export function dnes(pasmo = 'Europe/Prague', ted = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: pasmo, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(ted);
}

/** Posun o n měsíců, den se ořízne na konec měsíce. */
export function pridejMesice(s, n) {
  let [y, m, d] = rozloz(s);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return iso(y, m, Math.min(d, dniVMesici(y, m)));
}
export function pridejDny(s, n) {
  const [y, m, d] = rozloz(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Sériové číslo dne jako v Google tabulkách (1899-12-30 = 0). */
export function naSeriove(s) {
  const [y, m, d] = rozloz(s);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}
export function zeSerioveho(n) {
  const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(n)) * 86400000);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
/** Přijme cokoli, co může přijít z tabulky (sériové číslo, ISO text, „17.11.2026“), vrátí ISO nebo null. */
export function normalizujDatum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) return zeSerioveho(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  if (/^\d+(\.\d+)?$/.test(s)) return zeSerioveho(Number(s));
  return null;
}
