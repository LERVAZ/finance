import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navrhy, navrhni, najdiPar, najdiTrvalou, popisPohybu, klicProtistrany, cekajici, stavNapojeni } from '../js/vypocty/banka.js';

// smyšlená data
const ucty = [{ id: 'b1', typ: 'bezny', nazev: 'Běžný' }, { id: 's1', typ: 'sporici', nazev: 'Spořicí' }];
const bankaUcty = [
  { id: 'uidB', iban: 'CZ00 0800 0000 0011 1111 1111', ucet_id: 'b1', souhlas_do: '2027-05-01', stazeno: '2026-11-20 10:00' },
  { id: 'uidS', iban: 'CZ0008000000002222222222', ucet_id: 's1', souhlas_do: '2027-05-01', stazeno: '2026-11-20 10:00' }
];
const trvale = [
  { id: 't1', den: 21, nazev: 'Nájem', castka: 12000, typ: 'Výdaj', ucet_id: 'b1' },
  { id: 't2', den: 5, nazev: 'Telefon', castka: 450, typ: 'Výdaj', ucet_id: 'b1', aktivni: false }
];
const tx = (o) => ({ id: 'x' + Math.random(), ucet_uid: 'uidB', stav: '', protiucet: '', protistrana: '', popis: '', ...o });
const K = { ucty, bankaUcty, trvale, pohyby: [], ucetSporici: 's1' };

test('popis pohybu a klíč protistrany', () => {
  assert.equal(popisPohybu({ protistrana: 'Potraviny ABC', popis: 'Platba kartou' }), 'Potraviny ABC – Platba kartou');
  assert.equal(popisPohybu({ protistrana: 'Potraviny', popis: 'POTRAVINY 123' }), 'Potraviny');
  assert.equal(popisPohybu({}), 'Platba z banky');
  assert.equal(klicProtistrany({ protistrana: 'Čerpací Stanice 1234 Brno Sever' }), 'cerpaci stanice brno');
});

test('převod na vlastní spořicí = Na spořicí, opačný směr se nezapisuje', () => {
  const ven = navrhni(tx({ castka: -10000, protiucet: 'CZ0008000000002222222222' }), K);
  assert.equal(ven.akce, 'zapsat'); assert.equal(ven.typ, 'Na spořicí');
  const prichozi = navrhni(tx({ ucet_uid: 'uidS', castka: 10000, protiucet: 'CZ0008000000001111111111' }), K);
  assert.equal(prichozi.akce, 'vlastni');
  const zpet = navrhni(tx({ ucet_uid: 'uidS', castka: -3000, protiucet: 'CZ0008000000001111111111' }), K);
  assert.equal(zpet.akce, 'vlastni');
});

test('spárování s ručním zápisem: stejná částka, ±4 dny, směr sedí', () => {
  const pohyby = [
    { id: 'p1', datum: '2026-11-10', castka: 500, typ: 'Výdaj', kategorie: 'Jídlo' },
    { id: 'p2', datum: '2026-11-12', castka: 500, typ: 'Výdaj', kategorie: 'Zábava' },
    { id: 'p3', datum: '2026-11-12', castka: 500, typ: 'Příjem' },
    { id: 'p4', datum: '2026-11-12', castka: 500, typ: 'Výdaj', banka_tx_id: 'uz' }
  ];
  assert.equal(najdiPar(tx({ datum: '2026-11-13', castka: -500 }), pohyby).id, 'p2');
  assert.equal(najdiPar(tx({ datum: '2026-11-13', castka: 500 }), pohyby).id, 'p3');
  assert.equal(najdiPar(tx({ datum: '2026-11-20', castka: -500 }), pohyby), null);
  assert.equal(najdiPar(tx({ datum: '2026-11-13', castka: -501.2 }), pohyby), null);
});

test('jeden ruční zápis se spáruje jen jednou', () => {
  const pohyby = [{ id: 'p1', datum: '2026-11-10', castka: 200, typ: 'Výdaj' }];
  const bankaPohyby = [tx({ id: 'a', datum: '2026-11-10', castka: -200 }), tx({ id: 'b', datum: '2026-11-11', castka: -200 })];
  const n = navrhy({ ...K, pohyby, bankaPohyby });
  assert.deepEqual(n.map((x) => x.n.akce), ['sparovat', 'zapsat']);
});

test('trvalá platba se nezapisuje (počítá se z trvalých plateb), neaktivní se neuplatní', () => {
  assert.equal(najdiTrvalou(tx({ datum: '2026-11-23', castka: -12000 }), trvale, 'b1').id, 't1');
  assert.equal(najdiTrvalou(tx({ datum: '2026-11-28', castka: -12000 }), trvale, 'b1'), null);
  assert.equal(najdiTrvalou(tx({ datum: '2026-11-05', castka: -450 }), trvale, 'b1'), null);
  assert.equal(navrhni(tx({ datum: '2026-11-21', castka: -12000 }), K).akce, 'trvala');
});

test('výdaj: kategorie podle dřívějších plateb stejné protistraně; ze spořicího účtu = Ze spořicího', () => {
  const pohyby = [{ id: 'p9', datum: '2026-10-01', castka: 300, typ: 'Výdaj', kategorie: 'Jídlo', banka_tx_id: 'o' }];
  const bankaPohyby = [
    tx({ id: 'o', datum: '2026-10-01', castka: -300, protistrana: 'Pekárna U Mlýna 12', stav: 'zapsano', pohyb_id: 'p9' }),
    tx({ id: 'n', datum: '2026-11-15', castka: -180, protistrana: 'PEKÁRNA u mlýna 7' }),
    tx({ id: 's', ucet_uid: 'uidS', datum: '2026-11-16', castka: -2500, protistrana: 'Elektro' }),
    tx({ id: 'v', datum: '2026-11-18', castka: 41000, protistrana: 'Zaměstnavatel s.r.o.' })
  ];
  const n = navrhy({ ...K, pohyby, bankaPohyby });
  assert.equal(n.length, 3);
  assert.deepEqual(n.map((x) => [x.t.id, x.n.typ, x.n.kategorie]), [['n', 'Výdaj', 'Jídlo'], ['s', 'Ze spořicího', ''], ['v', 'Příjem', '']]);
});

test('čekající pohyby a stav napojení', () => {
  assert.equal(cekajici([{ id: 'a', stav: '' }, { id: 'b', stav: 'zapsano' }, { id: 'c', stav: 'ignorovano' }, { id: '' }]).length, 1);
  const s = stavNapojeni(bankaUcty, '2027-04-20');
  assert.equal(s.pripojeno, true); assert.equal(s.zbyvaDni, 11); assert.equal(s.obnovit, true); assert.equal(s.vyprselo, false);
  assert.equal(s.stare, true);
  assert.equal(stavNapojeni([], '2026-11-20').pripojeno, false);
  const ok = stavNapojeni(bankaUcty, '2026-11-21');
  assert.equal(ok.obnovit, false); assert.equal(ok.stare, false); assert.equal(ok.nesparovane, 0);
});
