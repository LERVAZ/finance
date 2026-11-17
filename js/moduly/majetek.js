/* Modul Majetek: nemovitost, auto… odhad hodnoty, vstupuje do čistého jmění. */
import { kc, datum } from '../texty.js';
import { opsHodnoty } from '../zalozky.js';

const aktivni = (ctx) => ctx.data('majetek').filter((m) => m.aktivni !== false && m.id);
const editor = {
  nadpisNovy: 'Nový majetek', nadpis: 'Upravit majetek', barva: 'purple', mazani: 'skryt', historie: 'hodnota',
  pole: [
    { n: 'nazev', l: 'Název', typ: 'text', povinne: true, placeholder: 'např. Dům, Auto' },
    { n: 'druh', l: 'Druh', typ: 'select', moznosti: () => [['nemovitost', 'Nemovitost'], ['auto', 'Auto'], ['jine', 'Jiné']] },
    { n: 'hodnota', l: 'Odhad hodnoty', typ: 'castka', povinne: true },
    { n: 'k_datu', l: 'Odhad ke dni', typ: 'datum' },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ]
};

export default {
  id: 'majetek',
  nazev: 'Majetek',
  popis: 'Nemovitost, auto… odhad hodnoty. Vstupuje do čistého jmění.',
  ikona: 'prehled',
  tabulky: ['majetek', 'historie'],
  editory: { majetek: editor },
  polozky: (ctx) => aktivni(ctx).map((m) => ({ id: m.id, banka: 'Majetek', poradi: 900, nazev: m.nazev, hodnota: Number(m.hodnota) || 0,
    pod: 'odhad' + (m.k_datu ? ' k ' + datum(m.k_datu) : ''), detail: m.poznamka ? [['Poznámka', m.poznamka]] : [],
    tlacitka: [{ text: 'Upravit', akce: 'editor.otevrit', data: { tab: 'majetek', id: m.id } }] })),
  stavy: (ctx) => aktivni(ctx).map((m) => ({ klic: 'm_' + m.id, skupina: 'Majetek', label: m.nazev + ' – odhad hodnoty', hodnota: m.hodnota, k_datu: m.k_datu,
    uloz: (v, _b, d) => opsHodnoty('majetek', m.id, 'hodnota', v, d) })),
  pridat: () => [{ text: 'Majetek', akce: 'editor.otevrit', data: { tab: 'majetek' } }],
  jmeni: (ctx) => aktivni(ctx).map((m) => ({ nazev: m.nazev, pod: 'odhad', hodnota: Number(m.hodnota) || 0, skupina: 'Majetek' })),
  akce: {}
};
export { kc };
