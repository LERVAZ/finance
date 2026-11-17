/* Dluhopis / pevný výnos, roční platby, roční zdroje, životní pojištění, daňové odpočty, historie hodnot. */
import { rozloz, pridejMesice, iso, dniVMesici } from './datumy.js';

const mesicuMezi = (a, b) => { const [y1, m1] = rozloz(a), [y2, m2] = rozloz(b); return (y2 - y1) * 12 + (m2 - m1); };

/* ---------- dluhopis / pevný výnos ---------- */
/** Termíny výplat výnosu: měsíčně od prvního výnosu do splatnosti (včetně). */
export function terminyVynosu(d) {
  if (!d.prvni_vynos || !d.splatnost) return [];
  const out = [];
  const den = Number(rozloz(d.prvni_vynos)[2]);
  for (let i = 0, t = d.prvni_vynos; t.slice(0, 7) <= d.splatnost.slice(0, 7) && i < 1200; i++) {
    out.push(t);
    const [y, m] = rozloz(pridejMesice(d.prvni_vynos.slice(0, 8) + '01', i + 1));
    t = iso(y, m, Math.min(den, dniVMesici(y, m)));
  }
  return out;
}
export function souhrnDluhopisu(d, vynosy, dnes) {
  const terminy = terminyVynosu(d);
  const skutecne = vynosy.filter((v) => v.dluhopis_id === d.id && v.datum);
  const vyn = Number(d.vynos_mesicne) || 0;
  let pripsano, vydelano, letos;
  if (skutecne.length) {
    pripsano = skutecne.length;
    vydelano = skutecne.reduce((t, v) => t + (Number(v.castka) || 0), 0);
    letos = skutecne.filter((v) => v.datum.slice(0, 4) === dnes.slice(0, 4)).reduce((t, v) => t + (Number(v.castka) || 0), 0);
  } else {
    const prosle = terminy.filter((t) => t <= dnes);
    pripsano = prosle.length;
    vydelano = pripsano * vyn;
    letos = prosle.filter((t) => t.slice(0, 4) === dnes.slice(0, 4)).length * vyn;
  }
  const pocet = terminy.length;
  const posledniVynos = skutecne.length ? Number([...skutecne].sort((a, b) => (a.datum < b.datum ? -1 : 1)).pop().castka) || 0
    : (terminy.filter((t) => t <= dnes).length ? vyn : 0);
  const zbyvaVyplat = Math.max(0, pocet - pripsano);
  const vklad = Number(d.vklad) || 0;
  return {
    ...d, pocet, pripsano, vydelano, letos, odhad: !skutecne.length,
    zbyva: zbyvaVyplat * vyn, celkem: vydelano + zbyvaVyplat * vyn,
    prubeh: pocet ? pripsano / pocet : null,
    zbyvaMes: d.splatnost ? Math.max(0, mesicuMezi(dnes.slice(0, 7), d.splatnost.slice(0, 7))) : null,
    pa: vklad ? vyn * 12 / vklad : null,
    vydelanoPct: vklad ? vydelano / vklad : null,
    // výkonnost jako u fondů: poslední výnos a letošní výnosy vůči vkladu
    mesicPct: vklad ? posledniVynos / vklad : null,
    letosPct: vklad ? letos / vklad : null,
    splaceno: d.splatnost ? d.splatnost < dnes : false
  };
}

/* ---------- roční platby ---------- */
/** Další termín roční platby: { dalsi: 'yyyy-mm', zaMes, stav }. */
export function dalsiTermin(p, dnes) {
  const [cy, cm] = rozloz(dnes);
  const mesic = Number(p.mesic) || 0;
  const interval = Math.max(1, Number(p.kazdych_let) || 1);
  const upozornit = p.upozornit_mesicu === null || p.upozornit_mesicu === undefined || p.upozornit_mesicu === '' ? 1 : Number(p.upozornit_mesicu);
  if (!mesic) return { dalsi: null, zaMes: null, stav: 'doplň měsíc' };
  let y;
  if (interval > 1 && p.posledni_rok) {
    y = Number(p.posledni_rok) + interval;
    while (y < cy || (y === cy && mesic < cm)) y += interval;
  } else {
    y = mesic >= cm ? cy : cy + 1;
  }
  const zaMes = (y - cy) * 12 + (mesic - cm);
  const stav = zaMes === 0 ? 'tento měsíc' : zaMes <= upozornit ? 'blíží se' : 'v pořádku';
  return { dalsi: y + '-' + String(mesic).padStart(2, '0'), zaMes, stav };
}
export function souhrnRocnich(platby, dnes) {
  const aktivni = platby.filter((p) => p.aktivni !== false);
  const polozky = aktivni.map((p) => ({ ...p, ...dalsiTermin(p, dnes), rocne: (Number(p.castka) || 0) / Math.max(1, Number(p.kazdych_let) || 1) }))
    .sort((a, b) => (a.zaMes === null ? 999 : a.zaMes) - (b.zaMes === null ? 999 : b.zaMes));
  const rocne = polozky.reduce((t, p) => t + p.rocne, 0);
  return { polozky, rocne, mesicne: rocne / 12, blizi: polozky.filter((p) => p.stav === 'tento měsíc' || p.stav === 'blíží se') };
}

/* ---------- roční zdroje (vratky, přeplatky, bonus) ---------- */
export const DRUHY_ZDROJU = [
  { nazev: 'Vratka daně', mesic: 4 }, { nazev: 'Přeplatek vody', mesic: 2 },
  { nazev: 'Přeplatek elektřiny', mesic: 9 }, { nazev: 'Bonus', mesic: 12 }
];
export function souhrnZdroju(zaznamy, druhy, rocniPlatby, dnes) {
  const [cy, cm] = rozloz(dnes);
  const roky = [...new Set(zaznamy.map((z) => Number(z.rok)).filter(Boolean))].sort();
  const hodnota = (rok, druh) => {
    const z = zaznamy.filter((x) => Number(x.rok) === rok && x.druh === druh && x.castka !== null && x.castka !== undefined);
    return z.length ? z.reduce((t, x) => t + Number(x.castka), 0) : null;
  };
  const platby = rocniPlatby.filter((p) => p.aktivni !== false);
  const polozky = druhy.map((d) => {
    const letos = hodnota(cy, d.nazev);
    const posledniRok = [...roky].reverse().find((r) => hodnota(r, d.nazev) !== null);
    const ocekavam = letos !== null ? letos : posledniRok ? hodnota(posledniRok, d.nazev) : null;
    const platim = platby.filter((p) => p.zdroj === d.nazev).reduce((t, p) => t + (Number(p.castka) || 0) / Math.max(1, Number(p.kazdych_let) || 1), 0);
    const zbude = ocekavam === null ? null : ocekavam - platim;
    const pristiRok = d.mesic >= cm && letos === null ? cy : cy + 1;
    return { ...d, letos, ocekavam, odhad: letos === null, platim, zbude,
      stav: ocekavam === null ? 'doplň částku' : zbude >= 0 ? 'pokryje' : 'nepokryje',
      pristi: d.mesic ? String(d.mesic).padStart(2, '0') + '/' + pristiRok : '–' };
  });
  const sum = (k) => polozky.reduce((t, p) => t + (p[k] || 0), 0);
  return {
    polozky, celkem: { ocekavam: sum('ocekavam'), platim: sum('platim'), zbude: sum('ocekavam') - sum('platim') },
    historie: roky.map((r) => ({ rok: r, hodnoty: druhy.map((d) => hodnota(r, d.nazev)) }))
  };
}

/* ---------- životní pojištění ---------- */
export function souhrnPojisteni(p, dnes) {
  const mesicu = p.od ? Math.max(0, mesicuMezi(p.od.slice(0, 7), dnes.slice(0, 7)) + 1) : null;
  const zaplaceno = mesicu !== null ? mesicu * (Number(p.mesicni_platba) || 0) : null;
  // investovaná část: známý základ k datu + měsíční investiční část od té doby, jinak měsíce od začátku × investiční část
  const investovano = p.vlozeno_zaklad !== null && p.vlozeno_zaklad !== undefined && p.vlozeno_zaklad !== '' && p.vlozeno_k_datu
    ? Number(p.vlozeno_zaklad) + Math.max(0, mesicuMezi(p.vlozeno_k_datu.slice(0, 7), dnes.slice(0, 7))) * (Number(p.investicni_cast) || 0)
    : mesicu !== null ? mesicu * (Number(p.investicni_cast) || 0) : null;
  const hodnota = p.odkupne === null || p.odkupne === undefined ? null : Number(p.odkupne);
  const zisk = hodnota !== null && investovano ? hodnota - investovano : null;
  return { ...p, mesicu, zaplaceno, investovano, hodnota, zisk, ziskPct: zisk !== null && investovano ? zisk / investovano : null };
}

/* ---------- daně ---------- */
export const DANE_VYCHOZI = {
  2026: { sazba_pct: 15, limit_uroky: 150000, limit_penzijni_zivotni: 48000, penzijni_nad: 12000 }
};
export function parametryDani(parametry, rok) {
  const p = parametry && typeof parametry === 'object' ? parametry : DANE_VYCHOZI;
  const roky = Object.keys(p).map(Number).filter((r) => r <= rok).sort((a, b) => b - a);
  const r = roky.length ? roky[0] : Math.min(...Object.keys(p).map(Number));
  return { rok: r, ...p[r] };
}
/** Odhad vratky daně ze odpočtů. */
export function odhadVratky({ parametry, rok, urokyHypoteky = 0, zivotni = 0, penzijni = 0 }) {
  const P = parametryDani(parametry, rok);
  const uroky = Math.min(Math.max(0, urokyHypoteky), P.limit_uroky);
  const penz = Math.max(0, penzijni - (P.penzijni_nad || 0));
  const ostatni = Math.min(Math.max(0, zivotni) + penz, P.limit_penzijni_zivotni);
  const zaklad = uroky + ostatni;
  return { parametry: P, uroky, ostatni, zivotni, penzijni: penz, zaklad, vratka: zaklad * P.sazba_pct / 100,
    vratkaUroky: uroky * P.sazba_pct / 100, vratkaOstatni: ostatni * P.sazba_pct / 100 };
}

/* ---------- historie hodnot ručních položek (hypotéka, stavebko, pojištění, majetek) ---------- */
export function hodnotaK(historie, polozka, datum) {
  let posl = null;
  for (const h of historie) if (h.polozka === polozka && h.datum && h.datum <= datum && (!posl || h.datum >= posl.datum)) posl = h;
  return posl ? Number(posl.hodnota) : null;
}
