import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizuj, rozdel, zkontroluj, rozeberPolozku, potvrd, prebijZive, podobnost } from '../js/vypocty/katalog.js';

const K = JSON.parse(readFileSync(new URL('../data/katalog.json', import.meta.url), 'utf8'));
const r = (text) => rozeberPolozku(K, text);

test('katalog: každá instituce má platný typ, napojení a unikátní id', () => {
  const typy = ['banka', 'stavebni_sporitelna', 'investicni_spolecnost', 'broker', 'pojistovna', 'penzijni_spolecnost'];
  const ids = new Set();
  for (const i of K.instituce) {
    assert.ok(typy.includes(i.typ), i.id);
    assert.ok(i.napojeni in K.napojeni, i.id);
    assert.ok(!ids.has(i.id), 'duplicitní ' + i.id);
    ids.add(i.id);
  }
});

test('normalizace a rozdělení textu', () => {
  assert.equal(normalizuj('J&T Banka'), 'jt banka');
  assert.equal(normalizuj('Česká spořitelna'), 'ceska sporitelna');
  assert.deepEqual(rozdel('Spořitelna, Raiffka a J&T fondy\nNN životko; stavebko'), ['Spořitelna', 'Raiffka', 'J&T fondy', 'NN životko', 'stavebko']);
  assert.equal(podobnost('cs', 'cs'), 1);
  assert.equal(podobnost('ab', 'ac'), 0);
});

test('příklad ze zadání: Spořitelna, Raiffka, J&T fondy, NN životko, stavebko', () => {
  const v = zkontroluj(K, 'Spořitelna, Raiffka, J&T fondy, NN životko, stavebko');
  assert.equal(v[0].instituce.id, 'cs');
  assert.equal(v[0].napojeni, 'enable_banking');
  assert.equal(v[0].modul, 'ucty');
  assert.equal(v[1].instituce.id, 'rb');
  assert.equal(v[1].napojeni, 'enable_banking');
  assert.equal(v[2].instituce.id, 'jt_is');
  assert.equal(v[2].produkt, 'investice');
  assert.equal(v[2].napojeni, 'rucne');
  assert.equal(v[3].instituce.id, 'nn');
  assert.equal(v[3].produkt, 'pojisteni');
  assert.equal(v[3].modul, 'pojisteni');
  assert.equal(v[4].instituce, null);
  assert.equal(v[4].produkt, 'stavebko');
  assert.equal(v[4].modul, 'stavebko');
  assert.equal(v[4].napojeni, 'rucne');
  assert.match(v[4].vysvetleni, /Chybí název/);
});

test('aliasy, produkty u banky, sesterské instituce', () => {
  assert.equal(r('Komerčka').instituce.id, 'kb');
  assert.equal(r('KB').instituce.id, 'kb');
  assert.equal(r('ČS fondy').instituce.id, 'erste_am');
  assert.equal(r('Raiffeisen stavebko').instituce.id, 'rsts');
  assert.equal(r('ČS penzijko').instituce.id, 'ps_cs');
  assert.equal(r('Raiffeisen spořicí účet').produkt, 'sporici');
  assert.equal(r('Raiffeisen spořicí účet').napojeni, 'enable_banking');
  const h = r('hypotéka Raiffeisen');
  assert.equal(h.instituce.id, 'rb');
  assert.equal(h.modul, 'hypoteka');
  assert.equal(h.napojeni, 'rucne');
  assert.match(h.vysvetleni, /PSD2/);
  assert.equal(r('Moneta').napojeni, 'rucne');
  assert.equal(r('Fio').napojeni, 'vlastni_api');
  assert.equal(r('Air Bank').napojeni, 'overit');
  assert.equal(r('Česká spořitelna').instituce.id, 'cs');
});

test('překlep → nejistá shoda s potvrzením, neznámé → ručně / ověřit', () => {
  const x = r('Raifeisenbanka');
  assert.equal(x.instituce.id, 'rb');
  assert.ok(['jiste', 'nejiste'].includes(x.jistota));
  const y = r('Unicretid');
  assert.equal(y.jistota, 'nejiste');
  assert.equal(y.instituce.id, 'unicredit');
  assert.equal(y.napojeni, 'overit'); // dokud nepotvrdí, platí jako neznámá banka
  assert.equal(potvrd(y, true).napojeni, 'overit');
  assert.equal(potvrd(y, true).jistota, 'jiste');
  assert.equal(potvrd(y, false).instituce, null);
  const z = r('Banka Mrkvička');
  assert.equal(z.jistota, 'nezname');
  assert.equal(z.napojeni, 'overit');
  assert.equal(r('Mrkvička dluhopis').napojeni, 'rucne');
  assert.equal(r('Mrkvička dluhopis').modul, 'dluhopis');
});

test('živé ověření přebije katalog jen u platebních účtů', () => {
  const v = zkontroluj(K, 'Air Bank, Moneta, Fio, Spořitelna, J&T fondy');
  const z = prebijZive(v, ['Air Bank', 'Česká spořitelna', 'Raiffeisenbank']);
  assert.equal(z[0].napojeni, 'enable_banking');
  assert.equal(z[0].overenoZive, true);
  assert.equal(z[1].napojeni, 'rucne');
  assert.equal(z[2].napojeni, 'vlastni_api'); // Fio zůstává u vlastního API
  assert.equal(z[3].napojeni, 'enable_banking');
  assert.equal(z[4].napojeni, 'rucne');
});
