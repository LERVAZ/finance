/* Měsíční přehled útrat. Čisté funkce bez DOM a bez tabulky. */
import { hraniceObdobi, datumVObdobi, klicObdobi, kalendarVyplat, jeVyplata } from './obdobi.js';

const soucet = (arr) => arr.reduce((s, x) => s + (Number(x.castka) || 0), 0);

/** Jak pohyb mění zůstatek spořicího účtu. */
export function zmenaSporiciho(typ, castka) {
  const c = Math.abs(Number(castka) || 0);
  if (typ === 'Na spořicí') return c;
  if (typ === 'Ze spořicího' || typ === 'Převod ze spořicího') return -c;
  return 0;
}
/** Je pohyb útrata? (Výdaj z běžného i výdaj placený ze spořicího.) */
export const jeVydaj = (typ) => typ === 'Výdaj' || typ === 'Ze spořicího';

/**
 * Trvalé platby, které jdou z výplaty v daném období (bez příjmů), s datem a stavem odešlo / čeká.
 * ucetVyplaty: id účtu, na který chodí výplata; prázdné = všechny trvalé platby.
 */
export function trvaleVObdobi({ trvale, klic, vyplataDen, dnes, ucetVyplaty }) {
  const aktualni = klicObdobi(dnes, vyplataDen);
  return trvale
    .filter((x) => x.aktivni !== false && x.typ !== 'Příjem' && (!ucetVyplaty || !x.ucet_id || x.ucet_id === ucetVyplaty))
    .map((x) => {
      const d = datumVObdobi(Number(x.den) || 0, klic, vyplataDen);
      return { ...x, datum: d, odeslo: d ? d <= dnes : klic < aktualni };
    })
    .sort((a, b) => (a.datum || '9') < (b.datum || '9') ? -1 : (a.datum || '9') > (b.datum || '9') ? 1 : 0);
}

/**
 * Souhrn období od výplaty do výplaty.
 * vstup: { klic, vyplataDen (číslo nebo kalendář výplat), dnes, trvale[], pohyby[], ucetVyplaty, vyplataOcekavana }
 * zbyva = příjmy − trvalé, které už odešly − výdaje (u uzavřeného období = konečný výsledek);
 * zbyvaPoVsech = příjmy − všechny trvalé − výdaje. Převody na/ze spořicího se neodečítají.
 */
export function souhrnObdobi(v) {
  v = { ...v, vyplataDen: kalendarVyplat(v.vyplataDen, v.pohyby, v.vyplataOcekavana) };
  const b = hraniceObdobi(v.klic, v.vyplataDen);
  const trv = v.trvale ? trvaleVObdobi(v) : [];
  const poh = (v.pohyby || []).filter((p) => p.datum && p.datum >= b.zacatek && p.datum <= b.konec)
    .sort((a, c) => (a.datum < c.datum ? 1 : a.datum > c.datum ? -1 : 0));
  let prijmy = soucet(poh.filter((p) => p.typ === 'Příjem'));
  let odhad = false;
  const vyplata = poh.filter((p) => jeVyplata(p, v.vyplataOcekavana)).sort((a, c) => (a.datum < c.datum ? -1 : 1))[0] || null;
  if (!vyplata && v.vyplataOcekavana) { prijmy += Number(v.vyplataOcekavana) || 0; odhad = true; }
  const trvSoucet = soucet(trv);
  const trvOdeslo = soucet(trv.filter((x) => x.odeslo));
  const vydaje = soucet(poh.filter((p) => jeVydaj(p.typ)));
  const naSporici = soucet(poh.filter((p) => p.typ === 'Na spořicí'));
  const zeSporiciho = soucet(poh.filter((p) => p.typ === 'Ze spořicího' || p.typ === 'Převod ze spořicího'));
  const kategorie = {};
  const pridej = (k, c) => { k = k || 'Ostatní'; kategorie[k] = (kategorie[k] || 0) + (Number(c) || 0); };
  trv.forEach((x) => pridej(x.kategorie, x.castka));
  poh.filter((p) => jeVydaj(p.typ)).forEach((p) => pridej(p.kategorie, p.castka));
  const zbyvaPoVsech = prijmy - trvSoucet - vydaje;
  const zbyva = prijmy - trvOdeslo - vydaje;
  const naSporiciZObdobi = naSporici - zeSporiciho;
  return {
    hranice: b, trvale: trv, pohyby: poh, prijmy, odhad, vyplata, trvSoucet, trvOdeslo, trvCeka: trvSoucet - trvOdeslo, vydaje, naSporici, zeSporiciho,
    zbyva, zbyvaPoVsech, naSporiciZObdobi, naBeznem: zbyvaPoVsech - naSporiciZObdobi,
    uzavrene: b.konec < v.dnes, aktualni: b.zacatek <= v.dnes && v.dnes <= b.konec,
    kategorie: Object.entries(kategorie).map(([nazev, castka]) => ({ nazev, castka })).sort((a, c) => c.castka - a.castka)
  };
}
