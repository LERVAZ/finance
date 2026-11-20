/* Napojení na banku: návrh, co s pohybem staženým z banky udělat.
   Čisté funkce (bez tabulky a UI), aby šly testovat.

   Pohyb z banky (list banka_pohyby): { id, ucet_uid, datum, castka (+ příjem / − výdaj), protistrana, protiucet, popis, stav }
   Návrh: { akce, typ, kategorie, popis, par, trvala, duvod }
     akce 'zapsat'   – zapsat jako nový pohyb (typ + kategorie)
          'sparovat' – už je zapsaný ručně (par = pohyb), jen se propojí
          'trvala'   – je to trvalá platba, ta se počítá z trvalých plateb → nezapisovat
          'vlastni'  – převod mezi vlastními účty, který se nezapisuje
*/
import { pridejDny } from './datumy.js';

export const STAVY_HOTOVE = ['zapsano', 'sparovano', 'trvala', 'ignorovano'];
export const OKNO_PAROVANI = 4;   // ± dní mezi zaúčtováním v bance a ručním zápisem
export const OKNO_TRVALE = 4;     // ± dní kolem dne trvalé platby
export const VAROVAT_SOUHLAS = 14; // dní před koncem souhlasu nabídnout obnovení

export const cekajici = (bankaPohyby) => (bankaPohyby || []).filter((t) => t.id && !STAVY_HOTOVE.includes(String(t.stav || '').trim()));

const bezDiakritiky = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Klíč protistrany pro učení kategorií: malá písmena, bez diakritiky, čísel a interpunkce. */
export function klicProtistrany(t) {
  const s = bezDiakritiky(t.protistrana || t.popis || '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.split(' ').slice(0, 3).join(' ');
}
const iban = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();
const rozdilDni = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const den = (iso) => Number(String(iso).slice(8, 10));

/** Popis, který se zapíše do pohybu. */
export function popisPohybu(t) {
  const p = String(t.protistrana || '').trim();
  const r = String(t.popis || '').trim();
  if (p && r && !bezDiakritiky(r).includes(bezDiakritiky(p))) return (p + ' – ' + r).slice(0, 120);
  return (p || r || 'Platba z banky').slice(0, 120);
}

/** Najde ručně zapsaný pohyb se stejnou částkou do ± OKNO_PAROVANI dní (nejbližší datum). */
export function najdiPar(t, pohyby, pouzite = new Set()) {
  const c = Math.abs(Number(t.castka) || 0);
  let nej = null, nejD = Infinity;
  for (const p of pohyby || []) {
    if (!p.id || p.banka_tx_id || pouzite.has(p.id) || !p.datum) continue;
    if (Math.abs((Number(p.castka) || 0) - c) > 0.5) continue;
    const prijem = p.typ === 'Příjem';
    if (prijem !== (Number(t.castka) > 0)) continue;
    const d = Math.abs(rozdilDni(p.datum, t.datum));
    if (d <= OKNO_PAROVANI && d < nejD) { nej = p; nejD = d; }
  }
  return nej;
}

/** Trvalá platba se stejnou částkou a dnem ± OKNO_TRVALE (z účtu, kam patří, pokud ho známe). */
export function najdiTrvalou(t, trvale, ucetId) {
  const c = Math.abs(Number(t.castka) || 0);
  const plus = Number(t.castka) > 0;
  return (trvale || []).find((x) => {
    if (x.aktivni === false) return false;
    if (Math.abs((Number(x.castka) || 0) - c) > 0.5) return false;
    if ((x.typ === 'Příjem') !== plus) return false;
    if (ucetId && x.ucet_id && x.ucet_id !== ucetId && x.na_ucet_id !== ucetId) return false;
    if (!x.den) return true;
    const d = Math.abs(den(t.datum) - Number(x.den));
    return Math.min(d, 31 - d) <= OKNO_TRVALE;
  }) || null;
}

/** Kategorie podle toho, jak uživatel dřív zařadil platby stejné protistraně. */
export function naucKategorie(bankaPohyby, pohyby) {
  const podleId = new Map((pohyby || []).map((p) => [p.id, p]));
  const out = new Map();
  [...(bankaPohyby || [])].filter((t) => t.pohyb_id && podleId.has(t.pohyb_id))
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
    .forEach((t) => { const p = podleId.get(t.pohyb_id); const k = klicProtistrany(t); if (k && p.kategorie) out.set(k, p.kategorie); });
  return out;
}

/**
 * Návrh pro jeden bankovní pohyb.
 * kontext: { pohyby, trvale, bankaUcty, ucty, ucetSporici, kategorie (Map z naucKategorie), pouzite (Set id spárovaných pohybů) }
 */
export function navrhni(t, k) {
  const bu = (k.bankaUcty || []).find((u) => u.id === t.ucet_uid) || {};
  const ucetId = bu.ucet_id || '';
  const ucet = (k.ucty || []).find((u) => u.id === ucetId);
  const zeSporiciho = !!ucet && (ucet.typ === 'sporici' || ucetId === k.ucetSporici);
  const plus = Number(t.castka) > 0;
  const popis = popisPohybu(t);
  const zaklad = { popis, kategorie: '', par: null, trvala: null };

  // 1) převod mezi vlastními připojenými účty
  const proti = (k.bankaUcty || []).find((u) => u.iban && iban(u.iban) === iban(t.protiucet));
  if (proti) {
    const cil = (k.ucty || []).find((u) => u.id === proti.ucet_id);
    const naSporici = !!cil && (cil.typ === 'sporici' || cil.id === k.ucetSporici);
    if (!plus && naSporici && !zeSporiciho) return { ...zaklad, akce: 'zapsat', typ: 'Na spořicí', duvod: 'převod na vlastní spořicí účet' };
    return { ...zaklad, akce: 'vlastni', typ: '', duvod: plus ? 'příchozí převod z vlastního účtu' : 'převod na vlastní účet' };
  }

  // 2) už zapsané ručně
  const par = najdiPar(t, k.pohyby, k.pouzite);
  if (par) return { ...zaklad, akce: 'sparovat', typ: par.typ, kategorie: par.kategorie || '', par, duvod: 'už zapsáno ručně ' + par.datum.slice(8, 10).replace(/^0/, '') + '. ' + Number(par.datum.slice(5, 7)) + '.' };

  // 3) trvalá platba (počítá se z trvalých plateb, zapsat by ji odečetlo dvakrát)
  const trvala = najdiTrvalou(t, k.trvale, ucetId);
  if (trvala) return { ...zaklad, akce: 'trvala', typ: '', trvala, duvod: 'trvalá platba „' + trvala.nazev + '“' };

  // 4) běžný příjem / výdaj
  const kat = (k.kategorie && k.kategorie.get(klicProtistrany(t))) || '';
  if (plus) return { ...zaklad, akce: 'zapsat', typ: 'Příjem', duvod: 'příjem' };
  return { ...zaklad, akce: 'zapsat', typ: zeSporiciho ? 'Ze spořicího' : 'Výdaj', kategorie: kat, duvod: kat ? 'kategorie podle dřívějších plateb' : 'výdaj' };
}

/** Návrhy pro všechny čekající pohyby (nejstarší první); jeden ruční pohyb se spáruje nejvýš jednou. */
export function navrhy(k) {
  const pouzite = new Set();
  const kategorie = naucKategorie(k.bankaPohyby, k.pohyby);
  return cekajici(k.bankaPohyby).sort((a, b) => String(a.datum).localeCompare(String(b.datum))).map((t) => {
    const n = navrhni(t, { ...k, kategorie, pouzite });
    if (n.par) pouzite.add(n.par.id);
    return { t, n };
  });
}

/** Stav napojení pro kartu: souhlas (nejbližší konec), poslední stažení, chyby. */
export function stavNapojeni(bankaUcty, dnes) {
  const ucty = (bankaUcty || []).filter((u) => u.id);
  if (!ucty.length) return { pripojeno: false, ucty: [] };
  const souhlasy = ucty.map((u) => u.souhlas_do).filter(Boolean).sort();
  const souhlasDo = souhlasy[0] || null;
  const zbyvaDni = souhlasDo ? rozdilDni(souhlasDo, dnes) : null;
  const stazeno = ucty.map((u) => String(u.stazeno || '')).filter(Boolean).sort().pop() || null;
  return {
    pripojeno: true, ucty, souhlasDo, zbyvaDni,
    obnovit: zbyvaDni !== null && zbyvaDni <= VAROVAT_SOUHLAS,
    vyprselo: zbyvaDni !== null && zbyvaDni < 0,
    stazeno, chyby: ucty.filter((u) => u.chyba).map((u) => ({ nazev: u.nazev || u.id, chyba: u.chyba })),
    nesparovane: ucty.filter((u) => !u.ucet_id).length,
    stare: stazeno ? String(stazeno).slice(0, 10) < pridejDny(dnes, -2) : false
  };
}
