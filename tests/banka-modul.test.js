import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PametUloziste } from '../js/uloziste/pamet.js';
import { vytvorKontext } from '../js/kontext.js';
import banka from '../js/moduly/banka.js';

// smyšlená data
function store() {
  return new PametUloziste({
    config: { moduly: ['ucty', 'utraty', 'trvale', 'banka'], ucet_vyplaty: 'b1', ucet_sporici: 's1', vyplata_den: 15 },
    data: {
      ucty: [{ id: 'b1', banka: 'Alfa', nazev: 'Běžný', typ: 'bezny' }, { id: 's1', banka: 'Alfa', nazev: 'Spořicí', typ: 'sporici' }],
      stavy: [{ id: 'x', datum: '2026-11-01', ucet_id: 's1', zustatek: 50000, zdroj: 'ručně' }],
      pohyby: [{ id: 'p1', datum: '2026-11-10', popis: 'nákup', castka: 700, typ: 'Výdaj', kategorie: 'Jídlo', zdroj: 'ručně' }],
      trvale_platby: [{ id: 't1', den: 21, nazev: 'Nájem', castka: 9000, typ: 'Výdaj', ucet_id: 'b1' }],
      banka_ucty: [{ id: 'uB', iban: 'CZ01', ucet_id: 'b1', souhlas_do: '2027-05-01', zustatek: 12000, k_datu: '2026-11-20' }],
      banka_pohyby: [
        { id: 'uB:1', ucet_uid: 'uB', datum: '2026-11-11', castka: -700, protistrana: 'Obchod', stav: '' },
        { id: 'uB:2', ucet_uid: 'uB', datum: '2026-11-21', castka: -9000, protistrana: 'Pronajímatel', stav: '' },
        { id: 'uB:3', ucet_uid: 'uB', datum: '2026-11-18', castka: -5000, protistrana: 'Já', protiucet: 'CZ99', stav: '' },
        { id: 'uB:4', ucet_uid: 'uB', datum: '2026-11-19', castka: -250, protistrana: 'Kavárna', popis: 'karta', stav: '' }
      ]
    }
  });
}
const ctxZ = (s) => vytvorKontext({ store: s, dnes: '2026-11-20', potvrd: () => true });

test('potvrdit vše: spáruje ruční zápis, trvalou nezapíše, nový výdaj zapíše se zdrojem banka', async () => {
  const s = store();
  const ctx = ctxZ(s);
  const form = { elements: {
    id_0: { value: 'uB:1' }, typ_0: { value: 'sparovat' }, kat_0: { value: '' },
    id_1: { value: 'uB:3' }, typ_1: { value: 'Na spořicí' }, kat_1: { value: '' },
    id_2: { value: 'uB:4' }, typ_2: { value: 'Výdaj' }, kat_2: { value: 'Zábava' },
    id_3: { value: 'uB:2' }, typ_3: { value: 'nic' }, kat_3: { value: '' } } };
  await banka.akce['banka.potvrditVse'](ctx, form);
  const bp = Object.fromEntries(s.data.banka_pohyby.map((t) => [t.id, t]));
  assert.equal(bp['uB:1'].stav, 'sparovano'); assert.equal(bp['uB:1'].pohyb_id, 'p1');
  assert.equal(bp['uB:2'].stav, 'trvala');
  assert.equal(bp['uB:3'].stav, 'zapsano'); assert.equal(bp['uB:4'].stav, 'zapsano');
  assert.equal(s.data.pohyby.find((p) => p.id === 'p1').banka_tx_id, 'uB:1');
  const kav = s.data.pohyby.find((p) => p.banka_tx_id === 'uB:4');
  assert.deepEqual([kav.typ, kav.castka, kav.kategorie, kav.zdroj, kav.ucet_id, kav.popis], ['Výdaj', 250, 'Zábava', 'banka', 'b1', 'Kavárna – karta']);
  // spořicí není připojený z banky → jeho zůstatek se upraví jako u ručního zápisu
  const sp = s.data.stavy.filter((x) => x.ucet_id === 's1').pop();
  assert.equal(sp.zustatek, 55000);
  // nic dalšího nečeká
  assert.equal(banka.karty(ctxZ(s)).length, 0);
});

test('přiřazení bankovního účtu zapíše zůstatek do stavů a označí účet jako napojený', async () => {
  const s = store();
  s.data.banka_ucty[0].ucet_id = '';
  await banka.akce['banka.priradit'](ctxZ(s), null, { id: 'uB', ucet_id: 'b1' });
  assert.equal(s.data.banka_ucty[0].ucet_id, 'b1');
  assert.equal(s.data.ucty[0].napojeni, 'banka');
  const st = s.data.stavy.filter((x) => x.ucet_id === 'b1').pop();
  assert.deepEqual([st.zustatek, st.datum, st.zdroj], [12000, '2026-11-20', 'banka']);
});

test('adresa skriptu se ověří', async () => {
  const s = store();
  await assert.rejects(banka.akce['banka.ulozitUrl'](ctxZ(s), null, { url: 'https://example.com/exec' }));
  await banka.akce['banka.ulozitUrl'](ctxZ(s), null, { url: 'https://script.google.com/macros/s/AKfy-123_x/exec' });
  assert.equal(s.config.banka_skript_url, 'https://script.google.com/macros/s/AKfy-123_x/exec');
});
