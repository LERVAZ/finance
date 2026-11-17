/* Vzhled bank a institucí: barva značky a zkratka do kulatého odznaku (místo loga).
   Instituci najde v katalogu (názvy + přezdívky), barva je podle skupiny (např. Raiffeisenbank i její stavebko = rb).
   Barvy jsou přibližné barvy značek; neznámé instituce dostanou stálou barvu z palety podle názvu. */
import { najdi, normalizuj, JISTE } from './vypocty/katalog.js';
import { html } from './html.js';

/** Barva a zkratka podle skupiny / id z katalogu. */
const ZNACKY = {
  cs: ['#2870ED', 'ČS'], rb: ['#FFE600', 'RB'], csob: ['#0067B1', 'ČSOB'], kb: ['#E9041E', 'KB'], moneta: ['#E3001B', 'M'],
  fio: ['#1C5DA8', 'Fio'], airbank: ['#6ABF4B', 'AB'], unicredit: ['#E2001A', 'UC'], mbank: ['#D2001F', 'mB'], revolut: ['#191C1F', 'R'],
  creditas: ['#00205B', 'CR'], partners: ['#1E2A4A', 'P'], trinity: ['#0A3D62', 'TB'], jt: ['#1D2B4F', 'J&T'], jt_is: ['#1D2B4F', 'J&T'],
  max: ['#00A0DF', 'MAX'], oberbank: ['#004F9F', 'OB'], wise: ['#9FE870', 'W'], mpss: ['#0071BC', 'MP'], cmss: ['#0067B1', 'ČMSS'],
  burinka: ['#2870ED', 'B'], conseq: ['#003A70', 'C'], amundi: ['#00205B', 'A'], generali: ['#C21B17', 'G'], generali_inv: ['#C21B17', 'G'],
  portu: ['#00B386', 'P'], fondee: ['#F2A900', 'F'], xtb: ['#0A0A0A', 'XTB'], t212: ['#0E5FD8', 'T212'], patria: ['#004B87', 'PF'],
  ibkr: ['#D81222', 'IB'], anycoin: ['#F7931A', 'AC'], nn: ['#EE7F00', 'NN'], kooperativa: ['#003C7E', 'K'], allianz: ['#003781', 'A'],
  uniqa: ['#1A3E89', 'U'], metlife: ['#0090DA', 'ML'], simplea: ['#E5007D', 'S'], direct: ['#00A651', 'D'], slavia: ['#D7141A', 'S']
};
const PALETA = ['#4C8DF6', '#2EC4B6', '#A78BFA', '#F0B04A', '#F2685C', '#45C483', '#E879F9', '#38BDF8'];

let KATALOG = null;
const pamet = new Map();

export async function nactiKatalogBank() {
  try { const r = await fetch('data/katalog.json'); if (r.ok) { KATALOG = await r.json(); pamet.clear(); } } catch (e) { /* bez katalogu jen paleta */ }
}
export function nastavKatalogBank(k) { KATALOG = k; pamet.clear(); }

/** Tmavý nebo světlý text podle jasu pozadí. */
export function textNa(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111' : '#fff';
}

function zkratkaZNazvu(nazev) {
  const slova = String(nazev || '?').replace(/[^\p{L}\p{N}& ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!slova.length) return '?';
  if (slova.length === 1) return slova[0].slice(0, 2).toUpperCase();
  return (slova[0][0] + slova[1][0]).toUpperCase();
}

/** { barva, text, zkratka } pro název banky / instituce. */
export function vzhledBanky(nazev) {
  const klic = normalizuj(nazev || '');
  if (pamet.has(klic)) return pamet.get(klic);
  let znacka = null;
  if (KATALOG && klic) {
    const s = najdi(KATALOG, klic);
    if (s && s.skore >= JISTE) znacka = ZNACKY[s.instituce.id] || ZNACKY[s.instituce.skupina] || null;
  }
  let barva, zkratka;
  if (znacka) [barva, zkratka] = znacka;
  else {
    let h = 0; for (const ch of klic) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    barva = PALETA[h % PALETA.length]; zkratka = zkratkaZNazvu(nazev);
  }
  const v = { barva, text: textNa(barva), zkratka };
  pamet.set(klic, v);
  return v;
}

/** Kulatý odznak se zkratkou v barvě banky. */
export function odznak(nazev, velky = false) {
  const v = vzhledBanky(nazev);
  return html`<span class="logo ${velky ? 'velke' : ''} ${v.zkratka.length > 2 ? 'dlouhe' : ''}" style="background:${v.barva};color:${v.text}" aria-hidden="true">${v.zkratka}</span>`;
}
