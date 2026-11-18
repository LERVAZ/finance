/* Účty: zůstatky z historie stavů, souhrny podle banky, výnos spořicích účtů, toky z trvalých plateb. */

/** Seřadí stavy jednoho účtu podle data (stabilně – při stejném datu platí později zapsaný řádek). */
function stavyUctu(stavy, id) {
  return stavy.map((s, i) => ({ s, i })).filter((x) => x.s.ucet_id === id && x.s.datum && x.s.zustatek !== null && x.s.zustatek !== undefined && x.s.zustatek !== '')
    .sort((a, b) => (a.s.datum < b.s.datum ? -1 : a.s.datum > b.s.datum ? 1 : a.i - b.i)).map((x) => x.s);
}

/** Poslední známý zůstatek účtu k datu (včetně). */
export function zustatekK(stavy, id, kDatu) {
  const s = stavyUctu(stavy, id).filter((x) => !kDatu || x.datum <= kDatu);
  return s.length ? { zustatek: Number(s[s.length - 1].zustatek), datum: s[s.length - 1].datum } : null;
}

/** Srážková daň z úroků (15 %). */
export const SRAZKOVA_DAN = 0.15;

/** Aktuální zůstatek a změna proti poslednímu stavu před začátkem tohoto měsíce. Úrok spořicího účtu je už po dani. */
export function prehledUctu(ucet, stavy, dnes) {
  const ted = zustatekK(stavy, ucet.id);
  const zacatekMesice = dnes.slice(0, 8) + '01';
  const s = stavyUctu(stavy, ucet.id).filter((x) => x.datum < zacatekMesice);
  const minule = s.length ? Number(s[s.length - 1].zustatek) : null;
  const urok = Number(ucet.urok_pa) || 0;
  const zustatek = ted ? ted.zustatek : null;
  return {
    ...ucet, zustatek, k_datu: ted ? ted.datum : null, minule,
    zmena: zustatek !== null && minule !== null ? zustatek - minule : null,
    vynosMesicne: ucet.typ === 'sporici' && zustatek ? zustatek * (urok / 100) / 12 * (1 - SRAZKOVA_DAN) : null,
    // odhad ke konci měsíce: platí, když peníze zůstanou na účtu celý měsíc (banka počítá z denních zůstatků)
    odhadKonecMesice: ucet.typ === 'sporici' && zustatek ? zustatek + zustatek * (urok / 100) / 12 * (1 - SRAZKOVA_DAN) : null
  };
}

/** Účty seskupené podle banky (pořadí bank podle prvního účtu). */
export function podleBanky(prehledy) {
  const banky = [];
  const mapa = new Map();
  [...prehledy].sort((a, b) => (Number(a.poradi) || 0) - (Number(b.poradi) || 0)).forEach((u) => {
    const k = (u.banka || 'Ostatní').trim();
    if (!mapa.has(k)) { const b = { banka: k, ucty: [], celkem: 0 }; mapa.set(k, b); banky.push(b); }
    const b = mapa.get(k);
    b.ucty.push(u);
    b.celkem += u.zustatek || 0;
  });
  return banky;
}

/**
 * Měsíční tok účtu podle trvalých plateb:
 * přichází = příjmy na účet + převody z jiných účtů (na_ucet_id), odchází = ostatní platby z účtu.
 */
export function tokUctu(id, trvale) {
  const aktivni = trvale.filter((x) => x.aktivni !== false);
  const prichazi = aktivni.filter((x) => (x.ucet_id === id && x.typ === 'Příjem') || (x.na_ucet_id === id && x.ucet_id !== id));
  const odchazi = aktivni.filter((x) => x.ucet_id === id && x.typ !== 'Příjem');
  const s = (a) => a.reduce((t, x) => t + (Number(x.castka) || 0), 0);
  return { prichazi, odchazi, prichaziCelkem: s(prichazi), odchaziCelkem: s(odchazi), zustava: s(prichazi) - s(odchazi) };
}
