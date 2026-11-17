import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nejblizsiPlatby, podleUctu } from '../js/vypocty/platby.js';

const trvale = [
  { den: 21, nazev: 'Elektřina', castka: 1500, typ: 'Výdaj', ucet_id: 'cs' },
  { den: 21, nazev: 'Kroužek', castka: 2500, typ: 'Výdaj', ucet_id: 'cs' },
  { den: 21, nazev: 'Na hypotéku', castka: 15000, typ: 'Převod', ucet_id: 'cs', na_ucet_id: 'rb' },
  { den: 22, nazev: 'Splátka hypotéky', castka: 14000, typ: 'Výdaj', ucet_id: 'rb' },
  { den: 22, nazev: 'Stavební spoření', castka: 5000, typ: 'Investice', ucet_id: 'rb' },
  { den: 5, nazev: 'Stará', castka: 99, typ: 'Výdaj', ucet_id: 'cs', aktivni: false },
  { den: 18, nazev: 'Telefon', castka: 400, typ: 'Výdaj', ucet_id: 'cs' }
];
const dluhopisy = [{ id: 'd', nazev: 'Dluhopis X', vynos_mesicne: 6000, prvni_vynos: '2026-05-15', splatnost: '2030-03-10', ucet_id: 'rb' }];

test('nejbližší platby: měsíc dopředu, všechny položky, převod u obou účtů', () => {
  const p = nejblizsiPlatby({ dnes: '2026-11-17', vyplataDen: 20, trvale, dluhopisy, dluhopisVynosy: [{ dluhopis_id: 'd', datum: '2026-11-15', castka: 6000 }],
    vyplata: { castka: 42000, ucet_id: 'cs' } });
  assert.deepEqual(p.map((x) => x.d + ' ' + x.nazev), ['2026-11-18 Telefon', '2026-11-20 Výplata', '2026-11-21 Elektřina', '2026-11-21 Kroužek',
    '2026-11-21 Na hypotéku', '2026-11-22 Splátka hypotéky', '2026-11-22 Stavební spoření', '2026-12-15 Výnos Dluhopis X']);
  const g = podleUctu(p, 'cs');
  assert.equal(g[0].ucet_id, 'cs');
  const rb = g.find((x) => x.ucet_id === 'rb');
  assert.equal(rb.bilance, 15000 + 6000 - 14000 - 5000);
  assert.equal(g[0].bilance, 42000 - 400 - 1500 - 2500 - 15000);
});

test('nejbližší platby: den 17 je za měsíc, výnos až od prvního výnosu a ne po splatnosti', () => {
  const p = nejblizsiPlatby({ dnes: '2026-11-17', vyplataDen: 20, trvale: [{ den: 17, nazev: 'X', castka: 1, typ: 'Výdaj' }],
    dluhopisy: [{ id: 'a', nazev: 'A', vynos_mesicne: 10, prvni_vynos: '2027-01-10', splatnost: '2030-01-01' }, { id: 'b', nazev: 'B', vynos_mesicne: 10, prvni_vynos: '2020-01-10', splatnost: '2026-11-30' }] });
  assert.deepEqual(p.map((x) => x.d + ' ' + x.nazev), ['2026-12-17 X']);
});

test('nejbližší platby: výnos zapsaný i jako trvalá platba se nepočítá dvakrát', () => {
  const p = nejblizsiPlatby({ dnes: '2026-11-17', vyplataDen: 20, trvale: [{ den: 1, nazev: 'Výnos Dluhopis X', castka: 6000, typ: 'Příjem', ucet_id: 'rb' }], dluhopisy });
  assert.deepEqual(p.map((x) => x.d + ' ' + x.nazev), ['2026-12-01 Výnos Dluhopis X']);
});
