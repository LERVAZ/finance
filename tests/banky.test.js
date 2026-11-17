import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vzhledBanky, nastavKatalogBank, textNa } from '../js/banky.js';

nastavKatalogBank(JSON.parse(readFileSync(new URL('../data/katalog.json', import.meta.url), 'utf8')));

test('banky: barvy a zkratky podle katalogu', () => {
  assert.deepEqual([vzhledBanky('Česká spořitelna').zkratka, vzhledBanky('Česká spořitelna').barva], ['ČS', '#2870ED']);
  assert.equal(vzhledBanky('Raiffeisenbank').zkratka, 'RB');
  assert.equal(vzhledBanky('Raiffeisenbank').text, '#111');            // žlutá → tmavý text
  assert.equal(vzhledBanky('Raiffeisen stavební spořitelna').barva, '#FFE600');
  assert.equal(vzhledBanky('NN pojišťovna').zkratka, 'NN');
  assert.equal(vzhledBanky('J&T Banka').zkratka, 'J&T');
});

test('banky: neznámá instituce má stálou barvu z palety a zkratku z názvu', () => {
  const a = vzhledBanky('Kotva Invest');
  assert.equal(a.zkratka, 'KI');
  assert.equal(vzhledBanky('Kotva Invest').barva, a.barva);
  assert.equal(vzhledBanky('Banka Alfa').zkratka, 'BA');
  assert.equal(textNa('#191C1F'), '#fff');
});
