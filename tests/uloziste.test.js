import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doBunky, zBunky, objektNaRadek, radekNaObjekt, pismeno, prazdnyRadek } from '../js/uloziste/prevod.js';
import { PametUloziste } from '../js/uloziste/pamet.js';
import { tabulkyProModuly } from '../js/moduly/registr.js';
import { ukazkovaData } from '../js/ukazka.js';
import { souhrnObdobi } from '../js/vypocty/utraty.js';
import { klicObdobi } from '../js/vypocty/obdobi.js';

test('převod do buněk a zpět', () => {
  assert.equal(doBunky('datum', '2026-11-17'), 46343);
  assert.equal(zBunky('datum', 46343), '2026-11-17');
  assert.equal(zBunky('datum', '17.11.2026'), '2026-11-17');
  assert.equal(doBunky('json', ['a', 'b']), '["a","b"]');
  assert.deepEqual(zBunky('json', '["a","b"]'), ['a', 'b']);
  assert.equal(zBunky('json', 20), 20);
  assert.equal(zBunky('json', 'text'), 'text');
  assert.equal(zBunky('bool', 'TRUE'), true);
  assert.equal(zBunky('bool', false), false);
  assert.equal(zBunky('castka', '1 200 Kč'), 1200);
  assert.equal(zBunky('text', 123), '123');
  assert.equal(doBunky('text', null), '');
});

test('řádek podle hlavičky – snese přeházené a neznámé sloupce', () => {
  const hl = ['datum', 'id', 'navic', 'castka', 'popis'];
  const r = objektNaRadek('pohyby', hl, { id: 'x1', datum: '2026-11-17', castka: 500, popis: 'Lidl', typ: 'Výdaj' });
  assert.deepEqual(r, [46343, 'x1', '', 500, 'Lidl']);
  const o = radekNaObjekt('pohyby', hl, [46343, 'x1', 'cokoli', 500, 'Lidl']);
  assert.equal(o.datum, '2026-11-17');
  assert.equal(o.navic, 'cokoli');
  assert.equal(o.castka, 500);
  assert.ok(prazdnyRadek(['', null, undefined]));
  assert.equal(pismeno(0), 'A');
  assert.equal(pismeno(25), 'Z');
  assert.equal(pismeno(26), 'AA');
});

test('listy podle modulů', () => {
  assert.deepEqual(tabulkyProModuly(['utraty']), ['_config', 'pohyby']);
  assert.deepEqual(tabulkyProModuly(['ucty', 'trvale']), ['_config', 'ucty', 'stavy', 'trvale_platby']);
});

test('úložiště v paměti: přidat, upravit, smazat, schéma jen přidává', async () => {
  const s = new PametUloziste({ config: {}, data: { _config: [], pohyby: [] } });
  const p = await s.pridej('pohyby', { datum: '2026-11-17', castka: 10, typ: 'Výdaj' });
  assert.ok(p.id);
  await s.uprav('pohyby', p.id, { castka: 20 });
  assert.equal(s.data.pohyby[0].castka, 20);
  await s.smaz('pohyby', p.id);
  assert.equal(s.data.pohyby.length, 0);
  await assert.rejects(() => s.smaz('pohyby', p.id));
  const zmeny = await s.zajistiSchema(['_config', 'pohyby', 'ucty']);
  assert.deepEqual(zmeny, ['nový list ucty']);
});

test('ukázková data dávají smysluplný měsíc', () => {
  const dnes = '2026-11-17';
  const d = ukazkovaData(dnes);
  const klic = klicObdobi(dnes, d.config.vyplata_den);
  const s = souhrnObdobi({ klic, vyplataDen: 15, dnes, trvale: d.data.trvale_platby, pohyby: d.data.pohyby, ucetVyplaty: 'a1', vyplataOcekavana: 38500 });
  assert.equal(s.prijmy, 38500);
  assert.ok(s.vydaje > 0);
  assert.ok(s.trvSoucet > 0);
});
