import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simuluj, scenare, anuita, postupStavebka, mesicText } from '../js/vypocty/hypoteka.js';
import { rada, mesicniVykonnost, souhrnInvestice, portfolio, vynosObdobi } from '../js/vypocty/investice.js';
import { souhrnDluhopisu, terminyVynosu, dalsiTermin, souhrnRocnich, souhrnZdroju, DRUHY_ZDROJU, souhrnPojisteni, odhadVratky, hodnotaK } from '../js/vypocty/produkty.js';

// smyšlená čísla (skutečná jsou jen v soukromém testu tests/soukrome)
const H = { zustatek: 3200000, k_datu: '2026-10-31', sazba: 5.1, sazba_po: 3.2, splatka: 16500, splatnost: null };
const S = { nasporeno: 40000, vklad_mesicne: 3000, poplatky_rocne: 0, urok_pa: 0, cilova_castka: 3000000, prideleni_pct: 20 };

test('anuita a jednoduchá simulace bez stavebka', () => {
  assert.equal(Math.round(anuita(1000000, 0, 100)), 10000);
  assert.equal(Math.round(anuita(1000000, 6, 120)), 11102);
  const s = simuluj({ h: { zustatek: 120000, k_datu: '2026-01-31', sazba: 0, splatka: 10000 } });
  assert.equal(s.splaceno, '2027-01');
  assert.equal(s.uroky, 0);
});

test('převod stavebka a scénáře A/B', () => {
  const r = scenare({ h: H, s: S, jednorazova: { datum: '2029-06-10', castka: 800000, vynos_mesicne: 4500 } });
  assert.equal(r.A.prevod, '2042-05');
  assert.equal(r.B.prevod, '2029-06');
  assert.equal(r.A.splaceno, '2050-05');
  assert.equal(r.B.splaceno, '2042-12');
  assert.equal(r.A.splatkaPo, 16500 + 4500);
  assert.equal(r.A.pozice, 800000);
  assert.ok(r.B.splaceno < r.A.splaceno);
  assert.ok(r.B.uroky < r.A.uroky);
  assert.equal(r.konec, r.A.splaceno);
  assert.equal(mesicText('2036-06'), '06/2036');
  const p = postupStavebka(S);
  assert.equal(p.prah, 600000);
  assert.equal(p.zbyva, 560000);
  // přepočet splátky do splatnosti po převodu
  const s2 = simuluj({ h: { ...H, splatnost: '2055-03-31' }, s: S });
  assert.equal(Math.round(s2.splatkaPo), Math.round(anuita(s2.dluhPo, 3.2, 154)));
});

test('investice: výkonnost očištěná o vklady, portfolio', () => {
  assert.equal(vynosObdobi(100, 110, 0), 0.1);
  assert.equal(vynosObdobi(100, 112, 2), 10 / 100);
  assert.equal(vynosObdobi(0, 105, 100), 0.05);
  const hist = [
    { investice_id: 'j', datum: '2026-08-31', hodnota: 100000, vlozeno: 90000 },
    { investice_id: 'j', datum: '2026-09-30', hodnota: 103100, vlozeno: 92100 },
    { investice_id: 'j', datum: '2026-10-15', hodnota: 1, vlozeno: 1 },
    { investice_id: 'j', datum: '2026-10-31', hodnota: 104000, vlozeno: 94200 },
    { investice_id: 'c', datum: '2026-09-30', hodnota: 50000, vlozeno: 40000 },
    { investice_id: 'c', datum: '2026-10-31', hodnota: 52000, vlozeno: 42000 }
  ];
  const r = rada(hist, 'j');
  assert.equal(r.length, 3);              // v říjnu platí poslední zápis
  const v = mesicniVykonnost(r);
  assert.equal(v[0].vykon, null);
  assert.ok(Math.abs(v[1].vykon - 1000 / 100000) < 1e-12);
  const s = souhrnInvestice({ id: 'j' }, hist, '2026-11-17');
  assert.equal(s.hodnota, 104000);
  assert.equal(s.zisk, 9800);
  assert.ok(Math.abs(s.ziskPct - 9800 / 94200) < 1e-12);
  assert.ok(s.letos !== null);
  const p = portfolio([s, souhrnInvestice({ id: 'c' }, hist, '2026-11-17')]);
  assert.deepEqual(p.map((b) => b.mesic), ['2026-09', '2026-10']);
  assert.equal(p[1].hodnota, 156000);
  assert.equal(p[1].vlozeno, 136200);
});

test('dluhopis: termíny, připsáno, zbývá', () => {
  const d = { id: 'b', vklad: 1000000, vynos_mesicne: 5500, prvni_vynos: '2026-05-15', splatnost: '2030-03-10' };
  const t = terminyVynosu(d);
  assert.equal(t[0], '2026-05-15');
  assert.equal(t[t.length - 1], '2030-03-15');
  assert.equal(t.length, 47);
  const s = souhrnDluhopisu(d, [], '2026-11-17');
  assert.equal(s.pripsano, 7);
  assert.equal(s.vydelano, 7 * 5500);
  assert.equal(s.zbyva, 40 * 5500);
  assert.ok(Math.abs(s.pa - 5500 * 12 / 1000000) < 1e-12);
  const s2 = souhrnDluhopisu(d, [{ dluhopis_id: 'b', datum: '2026-05-16', castka: 5300 }, { dluhopis_id: 'b', datum: '2026-06-16', castka: 5500 }], '2026-11-17');
  assert.equal(s2.pripsano, 2);
  assert.equal(s2.vydelano, 10800);
  assert.equal(s2.odhad, false);
});

test('roční platby: další termín, každé 2 roky, neznámý měsíc', () => {
  assert.deepEqual(dalsiTermin({ mesic: 4, upozornit_mesicu: 3 }, '2026-11-17'), { dalsi: '2027-04', zaMes: 5, stav: 'v pořádku' });
  assert.deepEqual(dalsiTermin({ mesic: 1, upozornit_mesicu: 3 }, '2026-11-17'), { dalsi: '2027-01', zaMes: 2, stav: 'blíží se' });
  assert.deepEqual(dalsiTermin({ mesic: 11 }, '2026-11-17'), { dalsi: '2026-11', zaMes: 0, stav: 'tento měsíc' });
  assert.equal(dalsiTermin({ mesic: 7, kazdych_let: 2, posledni_rok: 2026 }, '2026-11-17').dalsi, '2028-07');
  assert.equal(dalsiTermin({ mesic: null }, '2026-11-17').stav, 'doplň měsíc');
  const s = souhrnRocnich([{ castka: 4300, mesic: 7, kazdych_let: 2, posledni_rok: 2026 }, { castka: 5600, mesic: 5 }, { castka: 900, mesic: null }], '2026-11-17');
  assert.equal(s.rocne, 2150 + 5600 + 900);
  assert.equal(s.polozky[s.polozky.length - 1].stav, 'doplň měsíc');
});

test('roční zdroje: očekávám podle posledního roku, pokryje / nepokryje', () => {
  const z = [{ rok: 2025, druh: 'Vratka daně', castka: 24000 }, { rok: 2025, druh: 'Bonus', castka: 5000 }, { rok: 2026, druh: 'Vratka daně', castka: 23500 }];
  const p = [{ castka: 5000, zdroj: 'Vratka daně' }, { castka: 5875, zdroj: 'Bonus' }, { castka: 300, zdroj: '' }];
  const s = souhrnZdroju(z, DRUHY_ZDROJU, p, '2026-11-17');
  const v = s.polozky.find((x) => x.nazev === 'Vratka daně');
  assert.equal(v.ocekavam, 23500);
  assert.equal(v.zbude, 18500);
  assert.equal(v.stav, 'pokryje');
  assert.equal(s.polozky.find((x) => x.nazev === 'Bonus').stav, 'nepokryje');
  assert.equal(s.polozky.find((x) => x.nazev === 'Přeplatek vody').stav, 'doplň částku');
  assert.deepEqual(s.historie.map((h) => h.rok), [2025, 2026]);
});

test('pojištění, daně, historie hodnot', () => {
  const p = souhrnPojisteni({ mesicni_platba: 1793, investicni_cast: 949, odkupne: 151278, od: '2014-01-01' }, '2026-10-31');
  assert.equal(p.mesicu, 154);
  assert.equal(p.investovano, 154 * 949);
  // úroky 200 000 → limit 150 000; životko 11 388 → vratka 22 500 + 1 708
  const d = odhadVratky({ parametry: null, rok: 2026, urokyHypoteky: 200000, zivotni: 949 * 12 });
  assert.equal(d.vratkaUroky, 22500);
  assert.equal(Math.round(d.vratkaOstatni), 1708);
  assert.equal(odhadVratky({ parametry: null, rok: 2026, penzijni: 24000 }).penzijni, 12000);
  const hist = [{ polozka: 'majetek:d', datum: '2026-01-01', hodnota: 7000000 }, { polozka: 'majetek:d', datum: '2026-10-01', hodnota: 7900000 }];
  assert.equal(hodnotaK(hist, 'majetek:d', '2026-06-30'), 7000000);
  assert.equal(hodnotaK(hist, 'majetek:d', '2025-06-30'), null);
});
