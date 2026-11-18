/* Období začíná dnem skutečně zapsané výplaty (doplněk zadání z 18. 11. 2026). Smyšlená čísla. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jeVyplata, kalendarVyplat, klicObdobi, hraniceObdobi, zacatekObdobi } from '../js/vypocty/obdobi.js';
import { souhrnObdobi } from '../js/vypocty/utraty.js';

test('co je výplata', () => {
  assert.ok(jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'Výplata listopad', castka: 100 }, 40000));
  assert.ok(jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'MZDA', castka: 100 }, 40000));
  assert.ok(jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'plat', castka: 100 }, 40000));
  assert.ok(jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'Firma s.r.o.', castka: 30000 }, 40000)); // ≥ 60 %
  assert.ok(!jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'Firma s.r.o.', castka: 20000 }, 40000));
  assert.ok(!jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'Výnos BICZ', castka: 30000 }, 40000));
  assert.ok(!jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'Úrok', castka: 30000 }, 40000));
  assert.ok(!jeVyplata({ typ: 'Příjem', datum: '2026-11-18', popis: 'Vrácená platba', castka: 100 }, 40000));
  assert.ok(!jeVyplata({ typ: 'Výdaj', datum: '2026-11-18', popis: 'Výplata', castka: 100 }, 40000));
});

test('začátek období podle zapsané výplaty, okno ±10 dní, nejdřívější', () => {
  const k = kalendarVyplat(20, [
    { typ: 'Příjem', datum: '2026-10-20', popis: 'Výplata', castka: 1 },
    { typ: 'Příjem', datum: '2026-11-18', popis: 'Výplata', castka: 1 },
    { typ: 'Příjem', datum: '2026-11-25', popis: 'Výplata doplatek', castka: 1 },
    { typ: 'Příjem', datum: '2026-12-31', popis: 'Výplata', castka: 1 } // mimo okno prosince (10.–30. 12.)
  ]);
  assert.equal(zacatekObdobi('2026-11', k), '2026-11-18');
  assert.equal(zacatekObdobi('2026-12', k), '2026-12-20');
  const b = hraniceObdobi('2026-10', k);
  assert.equal(b.zacatek, '2026-10-20');
  assert.equal(b.konec, '2026-11-17');
  assert.equal(b.popisek, '20. 10. – 17. 11. 2026');
  assert.equal(klicObdobi('2026-11-17', k), '2026-10');
  assert.equal(klicObdobi('2026-11-18', k), '2026-11');
  assert.equal(klicObdobi('2026-11-19', k), '2026-11');
  // výplata přišla dřív než v kalendářním měsíci (výplatní den 5., výplata 28. 11. patří k prosinci)
  const p = kalendarVyplat(5, [{ typ: 'Příjem', datum: '2026-11-28', popis: 'Výplata', castka: 1 }]);
  assert.equal(klicObdobi('2026-11-29', p), '2026-12');
  assert.equal(hraniceObdobi('2026-11', p).konec, '2026-11-27');
  // přes konec roku
  assert.equal(hraniceObdobi('2026-12', 20).popisek, '20. 12. 2026 – 19. 1. 2027');
});

/* Scénář z doplňku se smyšlenými čísly (skutečná čísla jsou v tests/soukrome). */
test('scénář: zbývá teď, po trvalých, minulé období, na spořicí přibylo', () => {
  const trvale = [
    { id: 't1', den: 21, nazev: 'Hypotéka', castka: 30000, typ: 'Převod', ucet_id: 'cs' },
    { id: 't2', den: 9, nazev: 'Pojistka', castka: 1500, typ: 'Výdaj', ucet_id: 'cs' }
  ];
  const pohyby = [
    { datum: '2026-10-20', popis: 'Výplata', castka: 40000, typ: 'Příjem' },
    { datum: '2026-10-21', popis: 'Na spořicí', castka: 8000, typ: 'Na spořicí' },
    { datum: '2026-11-09', popis: 'Na pojistku', castka: 1500, typ: 'Převod ze spořicího' },
    { datum: '2026-11-18', popis: 'Výplata', castka: 39900, typ: 'Příjem' },
    { datum: '2026-11-18', popis: 'Na spořicí', castka: 8000, typ: 'Na spořicí' }
  ];
  const v = { vyplataDen: 20, dnes: '2026-11-18', trvale, pohyby, ucetVyplaty: 'cs', vyplataOcekavana: 40000 };
  const kal = kalendarVyplat(20, pohyby, 40000);
  const klic = klicObdobi(v.dnes, kal);
  assert.equal(klic, '2026-11');
  const ted = souhrnObdobi({ ...v, klic });
  assert.equal(ted.hranice.popisek, '18. 11. – 19. 12. 2026');
  assert.equal(ted.zbyva, 39900);
  assert.equal(ted.trvCeka, 31500);
  assert.equal(ted.zbyvaPoVsech, 8400);
  assert.equal(ted.naSporiciZObdobi, 8000);
  assert.equal(ted.odhad, false);
  assert.ok(ted.aktualni);
  const minule = souhrnObdobi({ ...v, klic: '2026-10' });
  assert.equal(minule.hranice.popisek, '20. 10. – 17. 11. 2026');
  assert.equal(minule.zbyva, 8500);
  assert.equal(minule.zbyvaPoVsech, 8500);
  assert.equal(minule.vydaje, 0);
  assert.equal(minule.naSporiciZObdobi, 6500);
  assert.ok(minule.uzavrene);
});
