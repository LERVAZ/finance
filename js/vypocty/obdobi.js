/* Období „od výplaty do výplaty“.
   Klíč období 'yyyy-mm' = měsíc, ve kterém období začíná (den výplaty).
   Když měsíc nemá tolik dní (výplata 31.), počítá se poslední den měsíce. */
import { iso, rozloz, dniVMesici, pridejDny, pad2 } from './datumy.js';

export function denVyplaty(y, m, vyplataDen) { return Math.min(Math.max(1, vyplataDen | 0), dniVMesici(y, m)); }

const dalsi = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);
const predchozi = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);

/* Kalendář výplat: { den, vyplaty: ['yyyy-mm-dd', …] }. Kde se dřív předával jen výplatní den (číslo),
   jde předat i kalendář – období pak začíná dnem, kdy výplata skutečně přišla. */
const bezDiakritiky = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const SLOVA_VYPLATY = /vyplat|mzd|(^|[^a-z])plat([^a-z]|$)/;
const SLOVA_JINE = /bicz|vynos|urok/;
export const OKNO_VYPLATY = 10;

/** Je pohyb výplata? Příjem s „výplata / mzda / plat“, nebo příjem bez „BICZ / výnos / úrok“ s aspoň 60 % očekávané výplaty. */
export function jeVyplata(p, ocekavana) {
  if (!p || p.typ !== 'Příjem' || !p.datum) return false;
  const t = bezDiakritiky(p.popis);
  if (SLOVA_VYPLATY.test(t)) return true;
  const o = Number(ocekavana) || 0;
  return o > 0 && !SLOVA_JINE.test(t) && Math.abs(Number(p.castka) || 0) >= 0.6 * o;
}

/** Kalendář z pohybů: data zapsaných výplat (seřazená). */
export function kalendarVyplat(vyplataDen, pohyby = [], ocekavana = 0) {
  if (vyplataDen && typeof vyplataDen === 'object') return vyplataDen;
  const vyplaty = [...new Set((pohyby || []).filter((p) => jeVyplata(p, ocekavana)).map((p) => String(p.datum).slice(0, 10)))].sort();
  return { den: Number(vyplataDen) || 1, vyplaty };
}
const kal = (v) => (v && typeof v === 'object' ? v : { den: Number(v) || 1, vyplaty: [] });

/** Den, kdy období (klíč yyyy-mm) začíná: nejdřívější zapsaná výplata ±10 dní kolem výplatního dne, jinak výplatní den. */
export function zacatekObdobi(klic, vyplataDen) {
  const k = kal(vyplataDen);
  const [y, m] = rozloz(klic);
  const plan = iso(y, m, denVyplaty(y, m, k.den));
  const od = pridejDny(plan, -OKNO_VYPLATY), po = pridejDny(plan, OKNO_VYPLATY);
  const v = k.vyplaty.find((d) => d >= od && d <= po);
  return v || plan;
}

const klicPosun = (klic, n) => { let [y, m] = rozloz(klic); for (let i = 0; i < Math.abs(n); i++) [y, m] = n > 0 ? dalsi(y, m) : predchozi(y, m); return y + '-' + pad2(m); };

/** Do kterého období patří datum (začátek ≤ datum < začátek dalšího). */
export function klicObdobi(datum, vyplataDen) {
  let k = datum.slice(0, 7);
  if (datum >= zacatekObdobi(klicPosun(k, 1), vyplataDen)) return klicPosun(k, 1);
  if (datum < zacatekObdobi(k, vyplataDen)) k = klicPosun(k, -1);
  return k;
}

/** Začátek, konec (včetně) a popisek období. */
export function hraniceObdobi(klic, vyplataDen) {
  const [y, m] = rozloz(klic);
  const [ny, nm] = dalsi(y, m);
  const zacatek = zacatekObdobi(klic, vyplataDen);
  const konec = pridejDny(zacatekObdobi(ny + '-' + pad2(nm), vyplataDen), -1);
  const [ky, km, kd] = rozloz(konec);
  const [zy, zm, zd] = rozloz(zacatek);
  return { klic, zacatek, konec, y, m, ny, nm,
    popisek: zd + '. ' + zm + '. ' + (zy !== ky ? zy + ' ' : '') + '– ' + kd + '. ' + km + '. ' + ky };
}

/** Seznam klíčů období: od (aktuální + dopredu) zpět o `pocet` období. */
export function seznamObdobi(aktualniKlic, pocet = 12, dopredu = 1) {
  const out = [];
  let [y, m] = rozloz(aktualniKlic);
  for (let i = 0; i < dopredu; i++) [y, m] = dalsi(y, m);
  for (let i = 0; i < pocet + dopredu; i++) { out.push(y + '-' + pad2(m)); [y, m] = predchozi(y, m); }
  return out;
}

/** Konkrétní datum trvalé platby (den v měsíci) uvnitř období. */
export function datumVObdobi(den, klic, vyplataDen) {
  if (!den) return null;
  const b = hraniceObdobi(klic, vyplataDen);
  const [zy, zm, zd] = rozloz(b.zacatek);
  const doZacatku = den >= zd;
  const [y, m] = doZacatku ? [zy, zm] : (zm === 12 ? [zy + 1, 1] : [zy, zm + 1]);
  const d = iso(y, m, Math.min(den, dniVMesici(y, m)));
  // pojistka pro krajní případy (např. den 30 a výplata 31. v únoru)
  if (d < b.zacatek) return b.zacatek;
  if (d > b.konec) return b.konec;
  return d;
}
