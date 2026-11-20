/* Ukázková (smyšlená) data pro režim bez přihlášení. Data se počítají od dneška, ať je přehled vždy živý. */
import { pridejMesice, pridejDny, dniVMesici, rozloz, iso } from './vypocty/datumy.js';
import { klicObdobi, hraniceObdobi } from './vypocty/obdobi.js';
import { VERZE_SCHEMATU } from './schema.js';

export function ukazkovaData(dnes) {
  const VD = 15;
  const ucty = [
    { id: 'a1', banka: 'Banka Alfa', nazev: 'Běžný účet', typ: 'bezny', urok_pa: null, napojeni: 'rucne', poradi: 1, aktivni: true },
    { id: 'a2', banka: 'Banka Alfa', nazev: 'Spořicí účet', typ: 'sporici', urok_pa: 3.5, napojeni: 'rucne', poradi: 2, aktivni: true },
    { id: 'b1', banka: 'Banka Beta', nazev: 'Účet na bydlení', typ: 'bezny', urok_pa: null, napojeni: 'rucne', poradi: 3, aktivni: true },
    { id: 'b2', banka: 'Banka Beta', nazev: 'Rezerva', typ: 'sporici', urok_pa: 4, napojeni: 'rucne', poradi: 4, aktivni: true }
  ];
  // historie: konec každého z posledních 6 měsíců + dnešek
  const stavy = [];
  const zaklad = { a1: 3200, a2: 61000, b1: 4100, b2: 30000 };
  const prirustek = { a1: 150, a2: 4200, b1: 60, b2: 500 };
  for (let i = 6; i >= 1; i--) {
    const [y, m] = rozloz(pridejMesice(dnes.slice(0, 8) + '01', -i));
    const d = iso(y, m, dniVMesici(y, m));
    for (const id of Object.keys(zaklad)) stavy.push({ id: 's' + id + i, datum: d, ucet_id: id, zustatek: zaklad[id] + prirustek[id] * (6 - i), zdroj: 'ručně' });
  }
  for (const id of Object.keys(zaklad)) stavy.push({ id: 's' + id + 't', datum: dnes, ucet_id: id, zustatek: zaklad[id] + prirustek[id] * 6 + (id === 'a1' ? 2350 : 0), zdroj: 'ručně' });

  const trvale_platby = [
    { id: 't1', den: 16, nazev: 'Nájem a služby', castka: 14500, kategorie: 'Bydlení', ucet_id: 'a1', typ: 'Výdaj', aktivni: true },
    { id: 't2', den: 16, nazev: 'Převod na účet na bydlení', castka: 3000, kategorie: 'Bydlení', ucet_id: 'a1', na_ucet_id: 'b1', typ: 'Převod', aktivni: true, poznamka: 'z toho se platí energie' },
    { id: 't3', den: 20, nazev: 'Telefon a internet', castka: 890, kategorie: 'Telefon a internet', ucet_id: 'a1', typ: 'Výdaj', aktivni: true },
    { id: 't4', den: 20, nazev: 'Investiční fond', castka: 2000, kategorie: 'Investice', ucet_id: 'a1', typ: 'Investice', aktivni: true },
    { id: 't5', den: 25, nazev: 'Pojištění domácnosti', castka: 320, kategorie: 'Pojištění', ucet_id: 'a1', typ: 'Výdaj', aktivni: true },
    { id: 't6', den: 1, nazev: 'Sport pro děti', castka: 600, kategorie: 'Děti', ucet_id: 'a1', typ: 'Výdaj', aktivni: true },
    { id: 't7', den: 18, nazev: 'Elektřina a plyn (zálohy)', castka: 2700, kategorie: 'Bydlení', ucet_id: 'b1', typ: 'Výdaj', aktivni: true }
  ];

  const klic = klicObdobi(dnes, VD);
  const b = hraniceObdobi(klic, VD);
  const kdy = (n) => { const d = pridejDny(b.zacatek, n); return d > dnes ? null : d; };
  const pohyby = [
    { id: 'p1', datum: kdy(0), popis: 'Výplata', castka: 38500, typ: 'Příjem', zdroj: 'ručně' },
    { id: 'p2', datum: kdy(1), popis: 'Na spořicí', castka: 5000, typ: 'Na spořicí', ucet_id: 'a2', zdroj: 'ručně' },
    { id: 'p3', datum: kdy(2), popis: 'Velký nákup', castka: 1840, typ: 'Výdaj', kategorie: 'Jídlo', zdroj: 'ručně' },
    { id: 'p4', datum: kdy(4), popis: 'Tankování', castka: 1450, typ: 'Výdaj', kategorie: 'Doprava', zdroj: 'ručně' },
    { id: 'p5', datum: kdy(6), popis: 'Lékárna', castka: 380, typ: 'Výdaj', kategorie: 'Zdraví', zdroj: 'ručně' },
    { id: 'p6', datum: kdy(8), popis: 'Pračka', castka: 9990, typ: 'Ze spořicího', kategorie: 'Domácnost', ucet_id: 'a2', zdroj: 'ručně' },
    { id: 'p7', datum: kdy(9), popis: 'Nákup', castka: 1260, typ: 'Výdaj', kategorie: 'Jídlo', zdroj: 'ručně' },
    { id: 'p8', datum: kdy(12), popis: 'Kino', castka: 520, typ: 'Výdaj', kategorie: 'Zábava', zdroj: 'ručně' }
  ].filter((p) => p.datum);
  // pár plateb v minulém období, ať jde přepínat
  const minule = hraniceObdobi(pridejMesice(klic + '-01', -1).slice(0, 7), VD);
  pohyby.push(
    { id: 'm1', datum: minule.zacatek, popis: 'Výplata', castka: 38500, typ: 'Příjem', zdroj: 'ručně' },
    { id: 'm2', datum: pridejDny(minule.zacatek, 3), popis: 'Nákup', castka: 2100, typ: 'Výdaj', kategorie: 'Jídlo', zdroj: 'ručně' },
    { id: 'm3', datum: pridejDny(minule.zacatek, 10), popis: 'Dárek', castka: 900, typ: 'Výdaj', kategorie: 'Dárky', zdroj: 'ručně' }
  );

  // investice: dva fondy, 24 měsíců historie
  const investice = [
    { id: 'i1', nazev: 'Akciový fond', instituce: 'Banka Alfa', mesicni_vklad: 2000, od: '2020-01-01', poradi: 1, aktivni: true },
    { id: 'i2', nazev: 'Dluhopisový fond', instituce: 'Investiční společnost Gama', mesicni_vklad: 1000, od: '2021-06-01', poradi: 2, aktivni: true }
  ];
  const investice_historie = [];
  const vykony = [0.021, -0.012, 0.015, 0.008, -0.025, 0.031, 0.012, 0.004, -0.009, 0.018, 0.022, -0.004, 0.011, 0.016, -0.018, 0.009, 0.014, 0.006, -0.011, 0.024, 0.007, 0.013, -0.006, 0.017];
  let h1 = 120000, v1 = 104000, h2 = 52000, v2 = 49000;
  for (let i = 24; i >= 1; i--) {
    const [y, m] = rozloz(pridejMesice(dnes.slice(0, 8) + '01', -i));
    const d = iso(y, m, dniVMesici(y, m));
    const r = vykony[24 - i];
    h1 = h1 * (1 + r) + 2000; v1 += 2000;
    h2 = h2 * (1 + r / 3) + 1000; v2 += 1000;
    investice_historie.push({ id: 'h1' + i, datum: d, investice_id: 'i1', hodnota: Math.round(h1), vlozeno: v1 });
    investice_historie.push({ id: 'h2' + i, datum: d, investice_id: 'i2', hodnota: Math.round(h2), vlozeno: v2 });
  }
  const rok = Number(dnes.slice(0, 4));
  const [, mesNyni] = rozloz(dnes);
  const historie = [];
  for (let i = 24; i >= 1; i -= 3) {
    const [y, m] = rozloz(pridejMesice(dnes.slice(0, 8) + '01', -i));
    const d = iso(y, m, dniVMesici(y, m));
    historie.push({ id: 'hh' + i, datum: d, polozka: 'hypoteka:h1', hodnota: 2350000 + i * 9000 });
    historie.push({ id: 'hs' + i, datum: d, polozka: 'stavebko:s1', hodnota: 98000 - i * 3000 });
    historie.push({ id: 'hm' + i, datum: d, polozka: 'majetek:m1', hodnota: 5600000 - i * 10000 });
  }
  const kDatu = iso(...rozloz(pridejMesice(dnes.slice(0, 8) + '01', -1)).slice(0, 2), 28);
  return {
    config: { schema_version: VERZE_SCHEMATU, vyplata_den: VD, vyplata_castka: 38500, ucet_vyplaty: 'a1', ucet_sporici: 'a2', dokonceno: true,
      moduly: ['ucty', 'utraty', 'trvale', 'rocni', 'zdroje', 'investice', 'dluhopis', 'hypoteka', 'stavebko', 'pojisteni', 'majetek', 'dane', 'archiv'],
      dane_penzijni_rocne: 18000 },
    data: {
      _config: [], ucty, stavy, trvale_platby, pohyby, investice, investice_historie, historie,
      rocni_platby: [
        { id: 'r1', nazev: 'Pojištění auta', castka: 6200, mesic: 4, kazdych_let: 1, upozornit_mesicu: 2, zdroj: 'Vratka daně', aktivni: true },
        { id: 'r2', nazev: 'Internet na rok', castka: 4800, mesic: 5, kazdych_let: 1, upozornit_mesicu: 1, zdroj: '', aktivni: true },
        { id: 'r3', nazev: 'Daň z nemovitosti', castka: 780, mesic: 5, kazdych_let: 1, zdroj: 'Vratka daně', aktivni: true },
        { id: 'r4', nazev: 'STK', castka: 1800, mesic: ((mesNyni % 12) + 1), kazdych_let: 2, posledni_rok: rok - 2 + (mesNyni === 12 ? 1 : 0), upozornit_mesicu: 2, zdroj: '', aktivni: true },
        { id: 'r5', nazev: 'Vyúčtování vody', castka: null, mesic: 1, upozornit_mesicu: 1, zdroj: 'Přeplatek vody', aktivni: true, poznamka: 'podle vyúčtování' },
        { id: 'r6', nazev: 'Poplatek za odpad', castka: 1200, mesic: null, zdroj: '', aktivni: true }
      ],
      rocni_zdroje: [
        { id: 'z1', rok: rok - 2, druh: 'Vratka daně', castka: 14200 }, { id: 'z2', rok: rok - 2, druh: 'Přeplatek elektřiny', castka: 2100 }, { id: 'z3', rok: rok - 2, druh: 'Bonus', castka: 8000 },
        { id: 'z4', rok: rok - 1, druh: 'Vratka daně', castka: 15800 }, { id: 'z5', rok: rok - 1, druh: 'Přeplatek vody', castka: -600 }, { id: 'z6', rok: rok - 1, druh: 'Přeplatek elektřiny', castka: 3400 }, { id: 'z7', rok: rok - 1, druh: 'Bonus', castka: 9000 },
        { id: 'z8', rok, druh: 'Vratka daně', castka: 16300 }
      ],
      dluhopisy: [{ id: 'd1', nazev: 'Firemní dluhopis', emitent: 'Emitent Delta', vklad: 500000, datum_vkladu: pridejMesice(dnes, -8), vynos_mesicne: 2600,
        prvni_vynos: pridejMesice(dnes, -7), splatnost: pridejMesice(dnes, 28), aktivni: true }],
      dluhopis_vynosy: [],
      hypoteka: [{ id: 'h1', nazev: 'Hypotéka', banka: 'Banka Beta', zustatek: 2350000, k_datu: kDatu, sazba: 4.9, sazba_po: 3.2, splatka: 13900, splatnost: null, stavebko_id: 's1', aktivni: true }],
      stavebko: [{ id: 's1', nazev: 'Stavební spoření', instituce: 'Banka Beta', nasporeno: 98000, k_datu: kDatu, cilova_castka: 2400000, prideleni_pct: 25,
        vklad_mesicne: 3000, poplatky_rocne: 600, urok_pa: 1, aktivni: true }],
      pojisteni: [{ id: 'n1', nazev: 'Životní pojištění', pojistovna: 'Pojišťovna Omega', mesicni_platba: 1200, investicni_cast: 700, odkupne: 64000, k_datu: kDatu, od: '2018-03-01', danovy_odpocet: true, aktivni: true }],
      majetek: [{ id: 'm1', nazev: 'Byt', druh: 'nemovitost', hodnota: 5600000, k_datu: kDatu, aktivni: true }, { id: 'm2', nazev: 'Auto', druh: 'auto', hodnota: 240000, k_datu: kDatu, aktivni: true }],
      archiv: [
        { id: 'x1', projekt: 'Rekonstrukce bytu', skupina: 'Koupelna', polozka: 'Obklady a dlažba', datum: '2025-03-10', castka: 48000, je_naklad: true, poradi: 1 },
        { id: 'x2', projekt: 'Rekonstrukce bytu', skupina: 'Koupelna', polozka: 'Sanita', datum: '2025-03-20', castka: 36500, je_naklad: true, poradi: 2 },
        { id: 'x3', projekt: 'Rekonstrukce bytu', skupina: 'Koupelna', polozka: 'Práce', datum: '2025-04-05', castka: 62000, je_naklad: true, poradi: 3 },
        { id: 'x4', projekt: 'Rekonstrukce bytu', skupina: 'Kuchyň', polozka: 'Kuchyňská linka', datum: '2025-05-12', castka: 118000, je_naklad: true, poradi: 4 },
        { id: 'x5', projekt: 'Rekonstrukce bytu', skupina: 'Kuchyň', polozka: 'Spotřebiče', datum: '2025-05-20', castka: 54000, je_naklad: true, poradi: 5 },
        { id: 'x6', projekt: 'Rekonstrukce bytu', skupina: 'Ostatní', polozka: 'Půjčka od rodičů vrácena', datum: '2025-09-01', castka: 30000, je_naklad: false, poradi: 6 }
      ]
    }
  };
}
