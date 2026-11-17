/* Období „od výplaty do výplaty“.
   Klíč období 'yyyy-mm' = měsíc, ve kterém období začíná (den výplaty).
   Když měsíc nemá tolik dní (výplata 31.), počítá se poslední den měsíce. */
import { iso, rozloz, dniVMesici, pridejDny, pad2 } from './datumy.js';

export function denVyplaty(y, m, vyplataDen) { return Math.min(Math.max(1, vyplataDen | 0), dniVMesici(y, m)); }

const dalsi = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);
const predchozi = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);

/** Do kterého období patří datum. */
export function klicObdobi(datum, vyplataDen) {
  let [y, m, d] = rozloz(datum);
  if (d < denVyplaty(y, m, vyplataDen)) [y, m] = predchozi(y, m);
  return y + '-' + pad2(m);
}

/** Začátek, konec (včetně) a popisek období. */
export function hraniceObdobi(klic, vyplataDen) {
  const [y, m] = rozloz(klic);
  const [ny, nm] = dalsi(y, m);
  const zacatek = iso(y, m, denVyplaty(y, m, vyplataDen));
  const konec = pridejDny(iso(ny, nm, denVyplaty(ny, nm, vyplataDen)), -1);
  const [, km, kd] = rozloz(konec);
  const [ky] = rozloz(konec);
  const [, , zd] = rozloz(zacatek);
  return { klic, zacatek, konec, y, m, ny, nm,
    popisek: zd + '. ' + m + '. – ' + kd + '. ' + km + '. ' + ky };
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
  const doZacatku = den >= denVyplaty(b.y, b.m, vyplataDen);
  const [y, m] = doZacatku ? [b.y, b.m] : [b.ny, b.nm];
  const d = iso(y, m, Math.min(den, dniVMesici(y, m)));
  // pojistka pro krajní případy (např. den 30 a výplata 31. v únoru)
  if (d < b.zacatek) return b.zacatek;
  if (d > b.konec) return b.konec;
  return d;
}
