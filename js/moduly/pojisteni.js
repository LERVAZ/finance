/* Modul Životní pojištění s investiční složkou. */
import { trida } from '../html.js';
import { kc, sk, pct, datum, mesicRok } from '../texty.js';
import { souhrnPojisteni } from '../vypocty/produkty.js';
import { opsHodnoty } from '../zalozky.js';

export const souhrny = (ctx) => ctx.pamet.poj || (ctx.pamet.poj = ctx.data('pojisteni').filter((p) => p.aktivni !== false && p.id).map((p) => souhrnPojisteni(p, ctx.dnes, ctx.data('historie'))));

const editor = {
  nadpisNovy: 'Nové pojištění', nadpis: 'Upravit pojištění', barva: 'teal', mazani: 'skryt', historie: 'odkupne',
  pole: [
    { n: 'nazev', l: 'Název', typ: 'text', povinne: true, placeholder: 'např. Životní pojištění' },
    { n: 'pojistovna', l: 'Pojišťovna', typ: 'text', povinne: true },
    { n: 'mesicni_platba', l: 'Platím měsíčně', typ: 'castka' },
    { n: 'investicni_cast', l: 'Z toho investiční část', typ: 'castka' },
    { n: 'odkupne', l: 'Odkupné (hodnota)', typ: 'castka' },
    { n: 'k_datu', l: 'Odkupné ke dni', typ: 'datum' },
    { n: 'od', l: 'Pojištěno od', typ: 'datum' },
    { n: 'vlozeno_zaklad', l: 'Investováno celkem (známý údaj)', typ: 'castka', napoveda: 'nepovinné – když ho znáš, počítá se z něj místo odhadu od začátku' },
    { n: 'vlozeno_k_datu', l: 'Investováno ke dni', typ: 'datum' },
    { n: 'danovy_odpocet', l: 'Uplatňuji daňový odpočet', typ: 'bool' },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ]
};

export default {
  id: 'pojisteni',
  nazev: 'Životní pojištění',
  popis: 'Pojištění s investiční složkou: platba, investiční část, odkupné.',
  ikona: 'zamek',
  tabulky: ['pojisteni', 'historie'],
  editory: { pojisteni: editor },
  polozky: (ctx) => souhrny(ctx).map((p) => ({ id: p.id, banka: p.pojistovna, poradi: 500, nazev: p.nazev, hodnota: p.hodnota || 0, hodnotaText: kc(p.hodnota),
    pod: 'odkupné' + (p.ziskPct !== null ? ' · ' + pct(p.ziskPct, 1, true) : ''), podTrida: trida(p.zisk),
    detail: [['Platím měsíčně', kc(p.mesicni_platba)], ['Z toho investiční část', kc(p.investicni_cast)], ['Investováno celkem (odhad)', kc(p.investovano)],
      ...(p.vlozeno_zaklad ? [] : [['Zaplaceno celkem (odhad)', kc(p.zaplaceno)]]), ['Zisk proti investované části', sk(p.zisk), trida(p.zisk)],
      ...(p.zmenaMesic !== null ? [['Změna odkupného za ' + mesicRok(p.mesicStavu), sk(p.zmenaMesic), trida(p.zmenaMesic)]] : []), ['Odkupné ke dni', p.k_datu ? datum(p.k_datu) : '–']],
    tlacitka: [{ text: 'Upravit', akce: 'editor.otevrit', data: { tab: 'pojisteni', id: p.id } }] })),
  stavy: (ctx) => souhrny(ctx).map((p) => ({ klic: 'p_' + p.id, skupina: 'Pojištění', label: p.nazev + ' – odkupné', hodnota: p.hodnota, k_datu: p.k_datu,
    uloz: (v, _b, d) => opsHodnoty('pojisteni', p.id, 'odkupne', v, d) })),
  pridat: () => [{ text: 'Pojištění', akce: 'editor.otevrit', data: { tab: 'pojisteni' } }],
  jmeni: (ctx) => souhrny(ctx).filter((p) => p.hodnota !== null).map((p) => ({ nazev: p.nazev, pod: p.pojistovna + ' · odkupné', hodnota: p.hodnota,
    hodnota2: p.zisk !== null ? sk(p.zisk) + (p.ziskPct !== null ? ' · ' + pct(p.ziskPct, 1, true) : '') : '', trida2: trida(p.zisk), skupina: 'Investice' })),
  akce: {}
};
