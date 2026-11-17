/* Hypotéka a stavební spoření: měsíční simulace splácení a porovnání scénářů.
   Model (záměrně jednoduchý a vysvětlitelný):
   - každý měsíc: úrok = dluh × sazba / 12, dluh = dluh + úrok − splátka,
   - stavebko: + měsíční vklad − poplatky/12, úrok stavebka měsíčně,
   - jakmile naspořeno ≥ cílová částka × podíl pro přidělení, „převod“: naspořené se odečte z dluhu,
     sazba se změní na sazbu po převodu a splátka se přepočítá (anuita do splatnosti), jinak zůstane,
   - jednorázové vklady (např. peníze z dluhopisu po splatnosti) jdou do stavebka, bez stavebka přímo do dluhu. */
import { pridejMesice, rozloz, pad2 } from './datumy.js';

export const mesic = (iso) => iso.slice(0, 7);
export const dalsiMesic = (m) => pridejMesice(m + '-01', 1).slice(0, 7);
export function mesicuMezi(odMesic, doMesic) {
  const [y1, m1] = rozloz(odMesic), [y2, m2] = rozloz(doMesic);
  return (y2 - y1) * 12 + (m2 - m1);
}
/** 'yyyy-mm' → '06/2036' */
export const mesicText = (m) => (m ? m.slice(5, 7) + '/' + m.slice(0, 4) : '–');

export function anuita(dluh, sazbaPa, mesicu) {
  if (mesicu <= 0) return dluh;
  const r = sazbaPa / 100 / 12;
  if (!r) return dluh / mesicu;
  return dluh * r / (1 - Math.pow(1 + r, -mesicu));
}

export function prahPrideleni(s) {
  if (!s) return null;
  if (s.cilova_castka && s.prideleni_pct) return s.cilova_castka * s.prideleni_pct / 100;
  return s.cilova_castka || null;
}

/**
 * Simulace od měsíce po k_datu hypotéky.
 * h: { zustatek, k_datu, sazba, sazba_po, splatka, splatnost }
 * s: { nasporeno, vklad_mesicne, poplatky_rocne, urok_pa, cilova_castka, prideleni_pct } | null
 * jednorazove: [{ mesic: 'yyyy-mm', castka }]
 */
export function simuluj({ h, s = null, jednorazove = [], vynos = null, maxMesicu = 600 }) {
  // vynos(m): měsíční výnos investice, který po převodu jde navíc do splácení (dřív platil vklady do stavebka)
  let dluh = Number(h.zustatek) || 0;
  let sazba = Number(h.sazba) || 0;
  let splatka = Number(h.splatka) || 0;
  let spor = s ? Number(s.nasporeno) || 0 : 0;
  const prah = prahPrideleni(s);
  const vklad = s ? Number(s.vklad_mesicne) || 0 : 0;
  const poplatek = s ? (Number(s.poplatky_rocne) || 0) / 12 : 0;
  const urokS = s ? (Number(s.urok_pa) || 0) / 100 / 12 : 0;
  const splatnost = h.splatnost ? mesic(h.splatnost) : null;
  let m = mesic(h.k_datu);
  let prevod = null, dluhPo = null, splatkaPo = null, splaceno = null, uroky = 0;
  const urokyRoky = {};
  const rada = [];
  const vystupy = []; // měsíční výdaje (splátka + vklad do stavebka), pro porovnání scénářů
  for (let i = 0; i < maxMesicu && dluh > 0.5; i++) {
    m = dalsiMesic(m);
    const navic = jednorazove.filter((j) => j.mesic === m).reduce((t, j) => t + (Number(j.castka) || 0), 0);
    let vkladTed = 0;
    if (s && !prevod) {
      vkladTed = vklad;
      spor += spor * urokS + vklad - poplatek + navic;
    } else if (navic) {
      dluh -= navic;
    }
    const urok = Math.max(0, dluh) * sazba / 100 / 12;
    uroky += urok;
    urokyRoky[m.slice(0, 4)] = (urokyRoky[m.slice(0, 4)] || 0) + urok;
    const navicKSplatce = prevod && vynos ? vynos(m) : 0;
    const platba = Math.min(splatka + navicKSplatce, dluh + urok);
    dluh = dluh + urok - platba;
    if (s && !prevod && prah && spor >= prah) {
      prevod = m;
      dluh = Math.max(0, dluh - spor);
      spor = 0;
      sazba = Number(h.sazba_po) || sazba;
      if (splatnost && mesicuMezi(m, splatnost) > 0) splatka = anuita(dluh, sazba, mesicuMezi(m, splatnost));
      dluhPo = dluh;
      splatkaPo = splatka + (vynos ? vynos(dalsiMesic(m)) : 0);
    }
    rada.push({ mesic: m, dluh: Math.max(0, dluh), sporeni: spor });
    vystupy.push({ mesic: m, platba, vklad: vkladTed, splatkaCelkem: splatka + navicKSplatce });
    if (dluh <= 0.5) splaceno = m;
  }
  return { prevod, dluhPo, splatkaPo, splaceno, uroky, urokyRoky, rada, vystupy, prah };
}

/**
 * Scénáře s jednorázovou částkou (typicky dluhopis po splatnosti), stejně jako ve staré tabulce („Plán A“, „Plán B“):
 *  A – částku znovu investuji: výnos plyne dál; dokud se spoří stavebko, platí vklady, po převodu jde navíc do splácení,
 *  B – částku po splatnosti vložím do stavebka (přebytek do hypotéky); výnos skončí splatností.
 * Čistá pozice k pozdějšímu z obou dat splacení = investice (jistina, jen A) + naspořeno po splacení
 * (po splacení se „splátka celkem“ odkládá stranou).
 * jednorazova: { datum, castka, vynos_mesicne, castka_a?, vynos_a? } – castka_a / vynos_a = co a s jakým výnosem znovu investuji v A.
 */
export function scenare({ h, s = null, jednorazova = null }) {
  const j = jednorazova;
  const splat = j ? mesic(j.datum) : null;
  const vynosA = j ? (m) => (m <= splat ? Number(j.vynos_mesicne) || 0 : Number(j.vynos_a ?? j.vynos_mesicne) || 0) : null;
  const vynosB = j ? (m) => (m <= splat ? Number(j.vynos_mesicne) || 0 : 0) : null;
  const A = simuluj({ h, s, vynos: vynosA });
  const B = simuluj({ h, s, vynos: vynosB, jednorazove: j ? [{ mesic: splat, castka: j.castka }] : [] });
  const konec = [A.splaceno, B.splaceno].filter(Boolean).sort().pop() || null;
  const pozice = (sim, investice) => {
    if (!konec || !sim.splaceno) return null;
    const posledni = sim.vystupy[sim.vystupy.length - 1];
    const poSplaceni = mesicuMezi(sim.splaceno, konec) * (posledni ? posledni.splatkaCelkem : 0);
    return investice + poSplaceni;
  };
  const vysledek = (sim) => ({ prevod: sim.prevod, dluhPo: sim.dluhPo, splatkaPo: sim.splatkaPo, splaceno: sim.splaceno,
    uroky: sim.uroky, rada: sim.rada, urokyRoky: sim.urokyRoky });
  const vysledek2 = (sim, investice) => ({ ...vysledek(sim), pozice: pozice(sim, investice) });
  const a = vysledek2(A, j ? Number(j.castka_a ?? j.castka) || 0 : 0), b = vysledek2(B, 0);
  return { A: a, B: b, konec, rozdil: a.pozice !== null && b.pozice !== null ? a.pozice - b.pozice : null };
}

/** Kolik % cílové částky pro přidělení je naspořeno. */
export function postupStavebka(s) {
  const prah = prahPrideleni(s);
  const n = Number(s.nasporeno) || 0;
  return { prah, nasporeno: n, splneno: prah ? n / prah : null, zbyva: prah ? Math.max(0, prah - n) : null,
    vkladCisty: (Number(s.vklad_mesicne) || 0) - (Number(s.poplatky_rocne) || 0) / 12 };
}
export { pad2 };
