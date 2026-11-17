/* Investice: zisk v Kč i %, měsíční výkonnost očištěná o vklady, výkonnost letos, portfolio. */

/** Body historie jedné investice seřazené podle data; v jednom měsíci platí poslední záznam. */
export function rada(historie, id) {
  const m = new Map();
  historie.filter((x) => x.investice_id === id && x.datum && x.hodnota !== null && x.hodnota !== undefined)
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0))
    .forEach((x) => m.set(x.datum.slice(0, 7), { datum: x.datum, mesic: x.datum.slice(0, 7), hodnota: Number(x.hodnota), vlozeno: x.vlozeno === null || x.vlozeno === undefined ? null : Number(x.vlozeno) }));
  // chybějící „vloženo“ převezme z předchozího bodu
  let posl = null;
  return [...m.values()].map((b) => { if (b.vlozeno === null) b.vlozeno = posl; posl = b.vlozeno; return b; });
}

/**
 * Výnos za období očištěný o vklady – stejně jako stará tabulka (vklad se počítá ke konci měsíce):
 * r = (V1 − V0 − vklad) / V0. Když na začátku nic nebylo, počítá se z vkladu.
 */
export function vynosObdobi(v0, v1, vklad) {
  if (v0 > 0) return (v1 - v0 - vklad) / v0;
  return vklad > 0 ? (v1 - vklad) / vklad : null;
}

/** Měsíční výkonnost k jednotlivým bodům řady (první bod nemá). */
export function mesicniVykonnost(r) {
  return r.map((b, i) => {
    if (!i) return { ...b, vykon: null };
    const p = r[i - 1];
    const vklad = b.vlozeno !== null && p.vlozeno !== null ? b.vlozeno - p.vlozeno : 0;
    return { ...b, vykon: vynosObdobi(p.hodnota, b.hodnota, vklad) };
  });
}

/** Řetězení výnosů za kalendářní rok (časově vážený výnos). */
export function vykonLetos(rv, rok) {
  const body = rv.filter((b) => b.mesic.slice(0, 4) === String(rok) && b.vykon !== null);
  if (!body.length) return null;
  return body.reduce((t, b) => t * (1 + b.vykon), 1) - 1;
}

/** Souhrn investice. */
export function souhrnInvestice(inv, historie, dnes) {
  const r = mesicniVykonnost(rada(historie, inv.id));
  const posl = r[r.length - 1] || null;
  const hodnota = posl ? posl.hodnota : null;
  const vlozeno = posl ? posl.vlozeno : null;
  const zisk = hodnota !== null && vlozeno !== null ? hodnota - vlozeno : null;
  return {
    ...inv, rada: r, hodnota, vlozeno, k_datu: posl ? posl.datum : null, zisk,
    ziskPct: zisk !== null && vlozeno ? zisk / vlozeno : null,
    mesic: posl ? posl.vykon : null,
    letos: vykonLetos(r, dnes.slice(0, 4))
  };
}

/** Portfolio: součet investic po měsících (chybějící měsíc = poslední známá hodnota). */
export function portfolio(souhrny) {
  const mesice = [...new Set(souhrny.flatMap((s) => s.rada.map((b) => b.mesic)))].sort();
  const posledni = new Map();
  const r = [];
  for (const m of mesice) {
    for (const s of souhrny) { const b = s.rada.find((x) => x.mesic === m); if (b) posledni.set(s.id, b); }
    if (posledni.size < souhrny.length) continue; // počkat, až jsou známé všechny investice
    let hodnota = 0, vlozeno = 0;
    for (const b of posledni.values()) { hodnota += b.hodnota; vlozeno += b.vlozeno || 0; }
    r.push({ mesic: m, datum: m + '-28', hodnota, vlozeno });
  }
  return mesicniVykonnost(r);
}
