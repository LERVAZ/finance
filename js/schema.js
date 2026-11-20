/* Datový model: listy v tabulce uživatele. První řádek = hlavička, žádné vzorce.
   Změny jen přidáváním (nové listy, nové sloupce na konec). Nic se nemaže ani nepřejmenovává. */

export const VERZE_SCHEMATU = 3; // v2: pojisteni + vlozeno_zaklad, vlozeno_k_datu; v3: listy banky (zrušené v 1.3.1, v tabulce můžou zůstat prázdné)

/* typy sloupců: text, cislo, castka, datum, bool, json */
export const TABULKY = {
  _config: {
    popis: 'Nastavení aplikace (klíč / hodnota). Upravuj raději v aplikaci.',
    klic: 'klic',
    sloupce: [['klic', 'text'], ['hodnota', 'json'], ['poznamka', 'text']]
  },
  ucty: {
    popis: 'Účty (běžné, spořicí).',
    sloupce: [['id', 'text'], ['banka', 'text'], ['nazev', 'text'], ['typ', 'text'], ['urok_pa', 'cislo'],
      ['napojeni', 'text'], ['poradi', 'cislo'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  stavy: {
    popis: 'Historie zůstatků účtů. Platí poslední stav k danému dni.',
    sloupce: [['id', 'text'], ['datum', 'datum'], ['ucet_id', 'text'], ['zustatek', 'castka'], ['zdroj', 'text'], ['poznamka', 'text']]
  },
  pohyby: {
    popis: 'Platby a převody (ručně i z banky).',
    sloupce: [['id', 'text'], ['datum', 'datum'], ['popis', 'text'], ['castka', 'castka'], ['typ', 'text'], ['kategorie', 'text'],
      ['ucet_id', 'text'], ['zdroj', 'text'], ['banka_tx_id', 'text'], ['poznamka', 'text']]
  },
  trvale_platby: {
    popis: 'Trvalé platby. den = den v měsíci (prázdný = jednou měsíčně bez pevného dne).',
    sloupce: [['id', 'text'], ['den', 'cislo'], ['nazev', 'text'], ['castka', 'castka'], ['kategorie', 'text'], ['ucet_id', 'text'],
      ['na_ucet_id', 'text'], ['typ', 'text'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  rocni_platby: {
    popis: 'Roční platby. mesic = 1–12 (prázdný = zatím neznámý), kazdych_let = 1 nebo 2…, zdroj = z čeho se platí.',
    sloupce: [['id', 'text'], ['nazev', 'text'], ['komu', 'text'], ['castka', 'castka'], ['mesic', 'cislo'], ['kazdych_let', 'cislo'],
      ['posledni_rok', 'cislo'], ['upozornit_mesicu', 'cislo'], ['zdroj', 'text'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  rocni_zdroje: {
    popis: 'Roční zdroje po letech: vratka daně, přeplatky, bonus. Nedoplatek s minusem.',
    sloupce: [['id', 'text'], ['rok', 'cislo'], ['druh', 'text'], ['castka', 'castka'], ['poznamka', 'text']]
  },
  investice: {
    popis: 'Investice a fondy.',
    sloupce: [['id', 'text'], ['nazev', 'text'], ['instituce', 'text'], ['mesicni_vklad', 'castka'], ['od', 'datum'], ['poradi', 'cislo'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  investice_historie: {
    popis: 'Hodnota investic v čase. vlozeno = kolik je celkem vloženo k tomu dni.',
    sloupce: [['id', 'text'], ['datum', 'datum'], ['investice_id', 'text'], ['hodnota', 'castka'], ['vlozeno', 'castka'], ['poznamka', 'text']]
  },
  dluhopisy: {
    popis: 'Pevný výnos / dluhopisy.',
    sloupce: [['id', 'text'], ['nazev', 'text'], ['emitent', 'text'], ['vklad', 'castka'], ['datum_vkladu', 'datum'], ['vynos_mesicne', 'castka'],
      ['prvni_vynos', 'datum'], ['splatnost', 'datum'], ['ucet_id', 'text'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  dluhopis_vynosy: {
    popis: 'Skutečně připsané výnosy (nepovinné – bez nich se počítá podle plánu).',
    sloupce: [['id', 'text'], ['datum', 'datum'], ['dluhopis_id', 'text'], ['castka', 'castka'], ['poznamka', 'text']]
  },
  pojisteni: {
    popis: 'Životní pojištění s investiční složkou.',
    sloupce: [['id', 'text'], ['nazev', 'text'], ['pojistovna', 'text'], ['mesicni_platba', 'castka'], ['investicni_cast', 'castka'],
      ['odkupne', 'castka'], ['k_datu', 'datum'], ['od', 'datum'], ['danovy_odpocet', 'bool'], ['aktivni', 'bool'], ['poznamka', 'text'],
      ['vlozeno_zaklad', 'castka'], ['vlozeno_k_datu', 'datum']]
  },
  majetek: {
    popis: 'Majetek (nemovitost, auto…) – odhad hodnoty.',
    sloupce: [['id', 'text'], ['nazev', 'text'], ['druh', 'text'], ['hodnota', 'castka'], ['k_datu', 'datum'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  hypoteka: {
    popis: 'Hypotéky a úvěry. sazba v % ročně.',
    sloupce: [['id', 'text'], ['nazev', 'text'], ['banka', 'text'], ['zustatek', 'castka'], ['k_datu', 'datum'], ['sazba', 'cislo'], ['sazba_po', 'cislo'],
      ['splatka', 'castka'], ['splatnost', 'datum'], ['stavebko_id', 'text'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  stavebko: {
    popis: 'Stavební spoření. prideleni_pct = kolik % cílové částky je potřeba naspořit (např. 20).',
    sloupce: [['id', 'text'], ['nazev', 'text'], ['instituce', 'text'], ['nasporeno', 'castka'], ['k_datu', 'datum'], ['cilova_castka', 'castka'],
      ['prideleni_pct', 'cislo'], ['vklad_mesicne', 'castka'], ['poplatky_rocne', 'castka'], ['urok_pa', 'cislo'], ['aktivni', 'bool'], ['poznamka', 'text']]
  },
  historie: {
    popis: 'Historie hodnot ručních položek (polozka = list:id). Zapisuje aplikace při každé změně hodnoty.',
    sloupce: [['id', 'text'], ['datum', 'datum'], ['polozka', 'text'], ['hodnota', 'castka']]
  },
  archiv: {
    popis: 'Archiv / projekty: jednorázové akce s rozpadem nákladů. je_naklad = FALSE pro položky, které nejsou náklad (např. vrácení dluhu).',
    sloupce: [['id', 'text'], ['projekt', 'text'], ['skupina', 'text'], ['polozka', 'text'], ['datum', 'datum'], ['castka', 'castka'],
      ['je_naklad', 'bool'], ['poradi', 'cislo'], ['poznamka', 'text']]
  }
};

export const sloupce = (tab) => TABULKY[tab].sloupce.map((s) => s[0]);
export const typSloupce = (tab, nazev) => (TABULKY[tab].sloupce.find((s) => s[0] === nazev) || [nazev, 'text'])[1];

/** Nové id záznamu: krátké, náhodné, čitelné. */
export function noveId(prefix = '') {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefix + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}
