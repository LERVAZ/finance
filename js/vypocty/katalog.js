/* „Kde máš peníze?“: z volného textu („Spořitelna, Raiffka, J&T fondy, NN životko, stavebko“)
   najde instituce v katalogu a pozná produkt, aby z nich šly založit účty a produkty. */

/** Bez diakritiky, malá písmena, & pryč (J&T → jt), jen písmena, čísla a mezery. */
export function normalizuj(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Rozdělí text na jednotlivé položky (čárka, středník, nový řádek, „ a “, „ + “). */
export function rozdel(text) {
  return String(text || '').split(/[,;\n]+|\s+a\s+|\s+\+\s+|\s+i\s+/).map((x) => x.trim()).filter(Boolean);
}

/* Produkty a slova, podle kterých se poznají (v normalizovaném textu). */
const PRODUKTY = [
  ['stavebko', /\b(stavebk\w*|stavebni sporeni|stavebni sporitelna|stavebni|sporeni na bydleni)\b/g],
  ['penzijni', /\b(penzijk\w*|penzijn\w*|penze|dps|doplnkove penzijni sporeni|spolecnost)\b/g],
  ['pojisteni', /\b(zivotk\w*|zivotni pojisteni|zivotni|pojisten\w*|pojistk\w*|pojistovn\w*)\b/g],
  ['hypoteka', /\b(hypotek\w*|hypo|uver\w*|pujck\w*)\b/g],
  ['dluhopis', /\b(dluhopis\w*|pevny vynos)\b/g],
  ['investice', /\b(fond\w*|investic\w*|akcie|etf|portfolio|dip)\b/g],
  ['sporici', /\b(sporic\w*|sporak|sporko)\b/g],
  ['bezny', /\b(bezny ucet|bezny|ucet|konto)\b/g]
];
const PRODUKT_TYP = { stavebko: 'stavebni_sporitelna', investice: 'investicni_spolecnost', penzijni: 'penzijni_spolecnost', pojisteni: 'pojistovna' };
const TYP_PRODUKT = { banka: 'bezny', stavebni_sporitelna: 'stavebko', investicni_spolecnost: 'investice', broker: 'investice', pojistovna: 'pojisteni', penzijni_spolecnost: 'penzijni' };
export const PRODUKT_MODUL = { bezny: 'ucty', sporici: 'ucty', stavebko: 'stavebko', investice: 'investice', penzijni: 'investice', pojisteni: 'pojisteni', hypoteka: 'hypoteka', dluhopis: 'dluhopis' };
export const PRODUKT_NAZEV = { bezny: 'Běžný účet', sporici: 'Spořicí účet', stavebko: 'Stavební spoření', investice: 'Fondy / investice', penzijni: 'Penzijní spoření',
  pojisteni: 'Životní pojištění', hypoteka: 'Hypotéka / úvěr', dluhopis: 'Dluhopis / pevný výnos' };

/** Najde produkt v textu a vrátí zbytek (název instituce). */
export function rozeberProdukt(norm) {
  let produkt = null, zbytek = norm;
  for (const [p, re] of PRODUKTY) {
    if (re.test(zbytek)) { if (!produkt) produkt = p; zbytek = zbytek.replace(re, ' '); }
    re.lastIndex = 0;
  }
  return { produkt, zbytek: zbytek.replace(/\s+/g, ' ').trim() };
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let pred = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const ted = [i];
    for (let j = 1; j <= n; j++) ted[j] = Math.min(pred[j] + 1, ted[j - 1] + 1, pred[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    pred = ted;
  }
  return pred[n];
}

/** Podobnost dotazu a jména instituce (0–1). */
export function podobnost(q, c) {
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (q.length <= 3 || c.length <= 3) return q.replace(/ /g, '') === c.replace(/ /g, '') ? 1 : 0;
  if (q.replace(/ /g, '') === c.replace(/ /g, '')) return 0.98;
  const qt = q.split(' '), ct = c.split(' ');
  if (ct.every((t) => qt.includes(t))) return 0.95;            // celé jméno je v dotazu („nn“ v „nn zivotni“)
  if (qt.every((t) => ct.includes(t))) return 0.9;             // dotaz je částí jména („raiffeisen“ → „raiffeisen stavebni sporitelna“)
  return 1 - levenshtein(q, c) / Math.max(q.length, c.length);
}

const jmena = (inst) => [inst.nazev, ...(inst.aliasy || [])].map(normalizuj).filter(Boolean);

/** Nejlepší shoda v katalogu: { instituce, skore } nebo null. Při shodě dává přednost instituci daného typu. */
export function najdi(katalog, q, typ = null) {
  let nej = null;
  for (const inst of katalog.instituce) {
    const s = Math.max(...jmena(inst).map((j) => podobnost(q, j))) - (typ && inst.typ !== typ ? 0.001 : 0);
    if (!nej || s > nej.skore) nej = { instituce: inst, skore: s };
  }
  return nej;
}

export const JISTE = 0.85, NEJISTE = 0.65;

/** Rozbor jedné položky textu. */
export function rozeberPolozku(katalog, vstup) {
  const norm = normalizuj(vstup);
  // 1) celý text přesně jako jméno nebo alias („ČS fondy“, „Raiffeisen stavebko“)
  let shoda = katalog.instituce.find((i) => jmena(i).includes(norm));
  let { produkt, zbytek } = rozeberProdukt(norm);
  let skore = shoda ? 1 : 0;
  if (!shoda && zbytek) {
    const n = najdi(katalog, zbytek, produkt && PRODUKT_TYP[produkt]);
    if (n && n.skore >= NEJISTE) { shoda = n.instituce; skore = n.skore; }
  }
  // 2) produkt u banky → instituce stejné skupiny (stavebko u Raiffky = Raiffeisen stavební spořitelna)
  if (shoda && produkt && PRODUKT_TYP[produkt] && shoda.typ !== PRODUKT_TYP[produkt]) {
    const sesterska = katalog.instituce.find((i) => i.skupina === shoda.skupina && i.typ === PRODUKT_TYP[produkt]);
    if (sesterska) shoda = sesterska;
  }
  if (shoda && !produkt) produkt = TYP_PRODUKT[shoda.typ] || 'bezny';
  if (!shoda && !produkt) produkt = 'bezny';
  const jistota = !shoda ? 'nezname' : skore >= JISTE ? 'jiste' : 'nejiste';
  return finalizuj({ vstup, nazevVstupu: zbytek, instituce: shoda || null, skore, jistota, produkt });
}

/** Doplní modul a vysvětlení (volá se i po potvrzení nejisté shody). */
export function finalizuj(r) {
  let vysvetleni = '';
  if (r.jistota === 'nezname') {
    vysvetleni = !r.nazevVstupu ? 'Chybí název banky nebo instituce – doplníš ho později v Účtech.'
      : 'V katalogu ji neznám – založí se pod názvem, jak jsi ho napsal.';
  }
  return { ...r, modul: PRODUKT_MODUL[r.produkt], vysvetleni };
}

export function zkontroluj(katalog, text) {
  return rozdel(text).map((v) => rozeberPolozku(katalog, v));
}

/** Potvrzení nejisté shody („Myslíš Raiffeisenbank?“). */
export function potvrd(r, ano) {
  return finalizuj(ano ? { ...r, jistota: 'jiste' } : { ...r, jistota: 'nezname', instituce: null });
}

