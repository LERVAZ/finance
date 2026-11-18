/* Investice a pojištění ke konci měsíce: změna za poslední zapsaný měsíc v Kč. Smyšlená čísla. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { souhrnInvestice } from '../js/vypocty/investice.js';
import { souhrnPojisteni } from '../js/vypocty/produkty.js';
import { mesicRok } from '../js/texty.js';

test('investice: změna za měsíc v Kč a výkon očištěný o vklad', () => {
  const h = [
    { investice_id: 'f', datum: '2026-09-30', hodnota: 100000, vlozeno: 90000 },
    { investice_id: 'f', datum: '2026-10-31', hodnota: 103000, vlozeno: 92000 }
  ];
  const s = souhrnInvestice({ id: 'f' }, h, '2026-11-18');
  assert.equal(s.mesicStavu, '2026-10');
  assert.equal(s.zmenaMesic, 3000);
  assert.ok(Math.abs(s.mesic - 0.01) < 1e-12); // (103 000 − 100 000 − 2 000) / 100 000
  assert.equal(s.zisk, 11000);
  assert.equal(mesicRok(s.mesicStavu), 'říjen 2026');
});

test('pojištění: změna odkupného mezi posledními dvěma měsíci', () => {
  const h = [
    { polozka: 'pojisteni:p', datum: '2026-09-30', hodnota: 50000 },
    { polozka: 'pojisteni:p', datum: '2026-10-15', hodnota: 50200 },
    { polozka: 'pojisteni:p', datum: '2026-10-31', hodnota: 50600 },
    { polozka: 'pojisteni:jine', datum: '2026-10-31', hodnota: 1 }
  ];
  const p = souhrnPojisteni({ id: 'p', odkupne: 50600, od: '2020-01-01', investicni_cast: 500 }, '2026-11-18', h);
  assert.equal(p.mesicStavu, '2026-10');
  assert.equal(p.zmenaMesic, 600);
  assert.equal(souhrnPojisteni({ id: 'x', odkupne: 1 }, '2026-11-18').zmenaMesic, null);
});
