import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nastaveni, serad, zarizeni, pocetSloupcu } from '../js/rozlozeni.js';

test('rozložení: výchozí, uložené, návrh má přednost', () => {
  assert.deepEqual(nastaveni(null, null, 'prehled', 'pc').poradi, ['jmeni', 'mesic', 'platby']);
  assert.equal(nastaveni(null, null, 'prehled', 'mobil').styl, 'plne');
  const ulozene = { prehled: { mobil: { styl: 'kompaktni', jedna: false } } };
  assert.equal(nastaveni(ulozene, null, 'prehled', 'mobil').styl, 'kompaktni');
  assert.equal(nastaveni(ulozene, null, 'prehled', 'mobil').jedna, false);
  assert.deepEqual(nastaveni(ulozene, null, 'prehled', 'pc').poradi, ['jmeni', 'mesic', 'platby']); // pc neuloženo → výchozí
  assert.equal(nastaveni(ulozene, { prehled: { mobil: { styl: 'plne' } } }, 'prehled', 'mobil').styl, 'plne');
  assert.equal(zarizeni(390), 'mobil'); assert.equal(zarizeni(1280), 'pc');
});

test('rozložení: řazení a počet sloupců', () => {
  const d = [{ id: 'a', poradi: 10 }, { id: 'b', poradi: 20 }, { id: 'c', poradi: 30 }, { id: 'nova', poradi: 5 }];
  assert.deepEqual(serad(d, []).map((x) => x.id), ['nova', 'a', 'b', 'c']);
  assert.deepEqual(serad(d, ['c', 'a', 'b']).map((x) => x.id), ['c', 'a', 'b', 'nova']);
  assert.equal(pocetSloupcu(1168, 'pc', 'plne'), 3);
  assert.equal(pocetSloupcu(1600, 'pc', 'plne'), 4);
  assert.equal(pocetSloupcu(360, 'mobil', 'plne'), 1);
  assert.equal(pocetSloupcu(360, 'mobil', 'kompaktni'), 2);
});
