import { test } from 'node:test';
import assert from 'node:assert/strict';
import { klicObdobi, hraniceObdobi, datumVObdobi, seznamObdobi } from '../js/vypocty/obdobi.js';
import { naSeriove, zeSerioveho, normalizujDatum, pridejMesice } from '../js/vypocty/datumy.js';
import { souhrnObdobi, trvaleVObdobi, zmenaSporiciho } from '../js/vypocty/utraty.js';
import { prehledUctu, podleBanky, tokUctu, zustatekK } from '../js/vypocty/ucty.js';
import { kc, sk, pct, precti } from '../js/texty.js';

test('formát částek a čísel', () => {
  assert.equal(kc(1234567).replace(/ /g, ' '), '1 234 567 Kč');
  assert.equal(sk(-500).replace(/ /g, ' '), '−500 Kč');
  assert.equal(sk(0).replace(/ /g, ' '), '0 Kč');
  assert.equal(pct(0.038, 1).replace(/ /g, ' '), '3,8 %');
  assert.equal(precti('1 234,50 Kč'), 1234.5);
  assert.equal(precti('−500'), -500);
  assert.equal(precti(''), null);
  assert.ok(isNaN(precti('abc')));
});

test('sériová čísla dat jako v Google tabulkách', () => {
  assert.equal(naSeriove('1899-12-31'), 1);
  assert.equal(naSeriove('2026-11-17'), 46343);
  assert.equal(zeSerioveho(46343), '2026-11-17');
  assert.equal(normalizujDatum('17.11.2026'), '2026-11-17');
  assert.equal(normalizujDatum('17. 11. 2026'), '2026-11-17');
  assert.equal(normalizujDatum(46343), '2026-11-17');
  assert.equal(normalizujDatum(''), null);
  assert.equal(pridejMesice('2026-01-31', 1), '2026-02-28');
});

test('období od výplaty do výplaty', () => {
  assert.equal(klicObdobi('2026-11-20', 20), '2026-11');
  assert.equal(klicObdobi('2026-11-19', 20), '2026-10');
  assert.equal(klicObdobi('2026-01-05', 20), '2025-12');
  const b = hraniceObdobi('2026-10', 20);
  assert.equal(b.zacatek, '2026-10-20');
  assert.equal(b.konec, '2026-11-19');
  assert.equal(b.popisek, '20. 10. – 19. 11. 2026');
  // výplata 1. v měsíci (stará verze tu ukazovala „0. 11.“)
  const p = hraniceObdobi('2026-10', 1);
  assert.equal(p.zacatek, '2026-10-01');
  assert.equal(p.konec, '2026-10-31');
  // výplata 31. → v únoru poslední den
  assert.equal(hraniceObdobi('2026-01', 31).konec, '2026-02-27');
  assert.equal(klicObdobi('2026-02-28', 31), '2026-02');
  assert.deepEqual(seznamObdobi('2026-11', 2, 1), ['2026-12', '2026-11', '2026-10']);
});

test('datum trvalé platby v období', () => {
  assert.equal(datumVObdobi(22, '2026-10', 20), '2026-10-22');
  assert.equal(datumVObdobi(10, '2026-10', 20), '2026-11-10');
  assert.equal(datumVObdobi(20, '2026-10', 20), '2026-10-20');
  assert.equal(datumVObdobi(31, '2026-01', 20), '2026-01-31');
  assert.equal(datumVObdobi(null, '2026-10', 20), null);
});

const TRVALE = [
  { id: 'a', den: 22, nazev: 'Fondy', castka: 2000, kategorie: 'Investice', ucet_id: 'cs', typ: 'Investice' },
  { id: 'b', den: 10, nazev: 'Voda', castka: 1000, kategorie: 'Bydlení', ucet_id: 'cs', typ: 'Výdaj' },
  { id: 'c', den: 22, nazev: 'Převod na RB', castka: 15000, kategorie: 'Bydlení', ucet_id: 'cs', na_ucet_id: 'rb', typ: 'Převod' },
  { id: 'd', den: null, nazev: 'Výnos', castka: 6000, kategorie: 'Investice', ucet_id: 'rb', typ: 'Příjem' },
  { id: 'e', den: null, nazev: 'Splátka', castka: 14000, kategorie: 'Bydlení', ucet_id: 'rb', typ: 'Výdaj' },
  { id: 'f', den: 5, nazev: 'Stará', castka: 99, ucet_id: 'cs', typ: 'Výdaj', aktivni: false }
];

test('trvalé platby z výplaty: jen z účtu výplaty, bez příjmů a neaktivních, odešlo / čeká', () => {
  const t = trvaleVObdobi({ trvale: TRVALE, klic: '2026-10', vyplataDen: 20, dnes: '2026-11-01', ucetVyplaty: 'cs' });
  assert.deepEqual(t.map((x) => x.id), ['a', 'c', 'b']);
  assert.deepEqual(t.map((x) => x.odeslo), [true, true, false]);
  // minulé období bez pevného dne → odešlo
  const bezDne = trvaleVObdobi({ trvale: [{ id: 'x', den: null, castka: 1, typ: 'Výdaj' }], klic: '2026-09', vyplataDen: 20, dnes: '2026-11-01', ucetVyplaty: '' });
  assert.equal(bezDne[0].odeslo, true);
});

test('souhrn období: výdaje, spořicí, zbývá, odhad výplaty', () => {
  const pohyby = [
    { datum: '2026-10-20', popis: 'Výplata', castka: 43000, typ: 'Příjem' },
    { datum: '2026-10-21', popis: 'Lidl', castka: 1200, typ: 'Výdaj', kategorie: 'Jídlo' },
    { datum: '2026-10-25', popis: 'Na spořicí', castka: 5000, typ: 'Na spořicí' },
    { datum: '2026-11-02', popis: 'Lékař', castka: 800, typ: 'Ze spořicího', kategorie: 'Zdraví' },
    { datum: '2026-11-09', popis: 'Na trvalé', castka: 1800, typ: 'Převod ze spořicího' },
    { datum: '2026-11-20', popis: 'Další období', castka: 999, typ: 'Výdaj' }
  ];
  const s = souhrnObdobi({ klic: '2026-10', vyplataDen: 20, dnes: '2026-11-17', trvale: TRVALE, pohyby, ucetVyplaty: 'cs', vyplataOcekavana: 40000 });
  assert.equal(s.prijmy, 43000);
  assert.equal(s.odhad, false);
  assert.equal(s.trvSoucet, 18000);
  assert.equal(s.vydaje, 2000);
  assert.equal(s.naSporici, 5000);
  assert.equal(s.zeSporiciho, 2600);
  assert.equal(s.zbyva, 23000);
  assert.equal(s.naSporiciZObdobi, 2400);
  assert.equal(s.naBeznem, 20600);
  assert.equal(s.pohyby.length, 5);
  assert.equal(s.kategorie[0].nazev, 'Bydlení');
  assert.equal(s.kategorie[0].castka, 16000);
  // bez zapsané výplaty se použije odhad
  const o = souhrnObdobi({ klic: '2026-11', vyplataDen: 20, dnes: '2026-11-20', trvale: TRVALE, pohyby, ucetVyplaty: 'cs', vyplataOcekavana: 40000 });
  assert.equal(o.prijmy, 40000);
  assert.equal(o.odhad, true);
  assert.equal(o.vydaje, 999);
});

test('změna spořicího účtu podle typu pohybu', () => {
  assert.equal(zmenaSporiciho('Na spořicí', 100), 100);
  assert.equal(zmenaSporiciho('Ze spořicího', 100), -100);
  assert.equal(zmenaSporiciho('Převod ze spořicího', -100), -100);
  assert.equal(zmenaSporiciho('Výdaj', 100), 0);
});

test('účty: zůstatky z historie, změna za měsíc, výnos, banky, toky', () => {
  const stavy = [
    { datum: '2026-09-30', ucet_id: 's', zustatek: 60000 },
    { datum: '2026-10-31', ucet_id: 's', zustatek: 65000 },
    { datum: '2026-11-10', ucet_id: 's', zustatek: 70000 },
    { datum: '2026-11-10', ucet_id: 's', zustatek: 71000 },
    { datum: '2026-11-05', ucet_id: 'b', zustatek: 1000 }
  ];
  assert.deepEqual(zustatekK(stavy, 's'), { zustatek: 71000, datum: '2026-11-10' });
  assert.deepEqual(zustatekK(stavy, 's', '2026-10-31'), { zustatek: 65000, datum: '2026-10-31' });
  const p = prehledUctu({ id: 's', typ: 'sporici', urok_pa: 3.6, banka: 'A' }, stavy, '2026-11-17');
  assert.equal(p.zustatek, 71000);
  assert.equal(p.minule, 65000);
  assert.equal(p.zmena, 6000);
  assert.equal(Math.round(p.vynosMesicne), 213);
  const prazdny = prehledUctu({ id: 'x', typ: 'bezny' }, stavy, '2026-11-17');
  assert.equal(prazdny.zustatek, null);
  const banky = podleBanky([{ id: '1', banka: 'B', zustatek: 5, poradi: 2 }, { id: '2', banka: 'A', zustatek: 10, poradi: 1 }, { id: '3', banka: 'B', zustatek: 1, poradi: 3 }]);
  assert.deepEqual(banky.map((b) => [b.banka, b.celkem]), [['A', 10], ['B', 6]]);
  const tok = tokUctu('rb', TRVALE);
  assert.equal(tok.prichaziCelkem, 21000);
  assert.equal(tok.odchaziCelkem, 14000);
  assert.equal(tok.zustava, 7000);
});
