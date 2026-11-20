import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizuj, rozdel, zkontroluj, rozeberPolozku, potvrd, podobnost } from '../js/vypocty/katalog.js';

const K = JSON.parse(readFileSync(new URL('../data/katalog.json', import.meta.url), 'utf8'));
const r = (text) => rozeberPolozku(K, text);

test('katalog: každá instituce má platný typ a unikátní id', () => {
  const typy = ['banka', 'stavebni_sporitelna', 'investicni_spolecnost', 'broker', 'pojistovna', 'penzijni_spolecnost'];
  const ids = new Set();
  for (const i of K.instituce) {
    assert.ok(typy.includes(i.typ), i.id);
    assert.equal(i.napojeni, undefined, i.id);
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
  assert.equal(v[0].modul, 'ucty');
  assert.equal(v[1].instituce.id, 'rb');
  assert.equal(v[2].instituce.id, 'jt_is');
  assert.equal(v[2].produkt, 'investice');
  assert.equal(v[3].instituce.id, 'nn');
  assert.equal(v[3].produkt, 'pojisteni');
  assert.equal(v[3].modul, 'pojisteni');
  assert.equal(v[4].instituce, null);
  assert.equal(v[4].produkt, 'stavebko');
  assert.equal(v[4].modul, 'stavebko');
  assert.match(v[4].vysvetleni, /Chybí název/);
});

test('aliasy, produkty u banky, sesterské instituce', () => {
  assert.equal(r('Komerčka').instituce.id, 'kb');
  assert.equal(r('KB').instituce.id, 'kb');
  assert.equal(r('ČS fondy').instituce.id, 'erste_am');
  assert.equal(r('Raiffeisen stavebko').instituce.id, 'rsts');
  assert.equal(r('ČS penzijko').instituce.id, 'ps_cs');
  assert.equal(r('Raiffeisen spořicí účet').produkt, 'sporici');
  const h = r('hypotéka Raiffeisen');
  assert.equal(h.instituce.id, 'rb');
  assert.equal(h.modul, 'hypoteka');
  assert.equal(r('Česká spořitelna').instituce.id, 'cs');
});

test('překlep → nejistá shoda s potvrzením, neznámé se založí pod svým názvem', () => {
  const x = r('Raifeisenbanka');
  assert.equal(x.instituce.id, 'rb');
  assert.ok(['jiste', 'nejiste'].includes(x.jistota));
  const y = r('Unicretid');
  assert.equal(y.jistota, 'nejiste');
  assert.equal(y.instituce.id, 'unicredit');
  assert.equal(potvrd(y, true).jistota, 'jiste');
  assert.equal(potvrd(y, false).instituce, null);
  const z = r('Banka Mrkvička');
  assert.equal(z.jistota, 'nezname');
  assert.match(z.vysvetleni, /neznám/);
  assert.equal(r('Mrkvička dluhopis').modul, 'dluhopis');
});

