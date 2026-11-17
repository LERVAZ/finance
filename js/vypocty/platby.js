/* Nejbližší platby: co přijde a odejde od zítřka do stejného dne příštího měsíce (včetně), podle účtů. */
import { iso, rozloz, dniVMesici, pridejMesice } from './datumy.js';
import { hraniceObdobi, klicObdobi } from './obdobi.js';

/** Datum s daným dnem v měsíci v okně (od, do] – pro tento a příští měsíc. */
function dnyVOkne(den, od, doDatum) {
  const vysledek = [];
  let [y, m] = rozloz(od);
  for (let i = 0; i < 3; i++) {
    const d = iso(y, m, Math.min(den, dniVMesici(y, m)));
    if (d > od && d <= doDatum) vysledek.push(d);
    m++; if (m > 12) { m = 1; y++; }
  }
  return vysledek;
}

/**
 * Vrátí seřazené položky { d, nazev, castka, smer: 'prijem'|'vydaj'|'prevod', ucet_id, na_ucet_id, zdroj }.
 * trvale = řádky trvale_platby, dluhopisy + dluhopisVynosy = pevný výnos, vyplata = { castka, ucet_id }.
 */
export function nejblizsiPlatby({ dnes, vyplataDen, trvale = [], dluhopisy = [], dluhopisVynosy = [], vyplata = null }) {
  const doDatum = pridejMesice(dnes, 1);
  const out = [];
  trvale.filter((t) => t.aktivni !== false && Number(t.den) >= 1).forEach((t) => {
    const smer = t.typ === 'Příjem' ? 'prijem' : t.typ === 'Převod' && t.na_ucet_id ? 'prevod' : 'vydaj';
    dnyVOkne(Number(t.den), dnes, doDatum).forEach((d) => out.push({ d, nazev: t.nazev, castka: Number(t.castka) || 0, smer,
      ucet_id: t.ucet_id || '', na_ucet_id: smer === 'prevod' ? t.na_ucet_id : '', zdroj: 'trvale' }));
  });
  dluhopisy.filter((x) => x.aktivni !== false && x.prvni_vynos && Number(x.vynos_mesicne)).forEach((x) => {
    const den = rozloz(x.prvni_vynos)[2];
    dnyVOkne(den, dnes, doDatum).forEach((d) => {
      if (d < x.prvni_vynos || (x.splatnost && d > x.splatnost)) return;
      // v tom měsíci už výnos zapsaný → nečekáme další
      if (dluhopisVynosy.some((v) => v.dluhopis_id === x.id && String(v.datum || '').slice(0, 7) === d.slice(0, 7))) return;
      // výnos už je zapsaný i jako trvalá platba (příjem) → nepočítat dvakrát
      if (trvale.some((t) => t.aktivni !== false && t.typ === 'Příjem' && (String(t.nazev || '').toLowerCase().includes(String(x.nazev || '').toLowerCase())
        || (Number(t.castka) === Number(x.vynos_mesicne) && (t.ucet_id || '') === (x.ucet_id || ''))))) return;
      out.push({ d, nazev: 'Výnos ' + x.nazev, castka: Number(x.vynos_mesicne), smer: 'prijem', ucet_id: x.ucet_id || '', na_ucet_id: '', zdroj: 'dluhopis' });
    });
  });
  if (vyplata && Number(vyplata.castka)) {
    let klic = klicObdobi(dnes, vyplataDen);
    for (let i = 0; i < 3; i++) {
      const d = hraniceObdobi(klic, vyplataDen).zacatek;
      if (d > dnes && d <= doDatum) out.push({ d, nazev: 'Výplata', castka: Number(vyplata.castka), smer: 'prijem', ucet_id: vyplata.ucet_id || '', na_ucet_id: '', zdroj: 'vyplata' });
      klic = pridejMesice(klic + '-01', 1).slice(0, 7);
    }
  }
  return out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.smer === 'prijem' ? -1 : 0) - (b.smer === 'prijem' ? -1 : 0)));
}

/**
 * Rozdělí položky podle účtů. Převod je v účtu odkud jako výdaj a v účtu kam jako příjem.
 * Vrací [{ ucet_id, polozky: [{ ...p, plus: bool, protiucet }], prijmy, vydaje, bilance }] v pořadí prvního výskytu (účet výplaty první).
 */
export function podleUctu(polozky, ucetVyplaty = '') {
  const m = new Map();
  const skupina = (id) => { if (!m.has(id)) m.set(id, { ucet_id: id, polozky: [], prijmy: 0, vydaje: 0, bilance: 0 }); return m.get(id); };
  if (ucetVyplaty && polozky.some((p) => p.ucet_id === ucetVyplaty)) skupina(ucetVyplaty);
  const pridej = (id, p, plus, protiucet) => {
    const g = skupina(id);
    g.polozky.push({ ...p, plus, protiucet });
    if (plus) g.prijmy += p.castka; else g.vydaje += p.castka;
    g.bilance = g.prijmy - g.vydaje;
  };
  polozky.forEach((p) => {
    if (p.smer === 'prevod') { pridej(p.ucet_id, p, false, p.na_ucet_id); pridej(p.na_ucet_id, p, true, p.ucet_id); }
    else pridej(p.ucet_id, p, p.smer === 'prijem', '');
  });
  return [...m.values()];
}
