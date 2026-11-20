/* SheetsUloziste proti napodobenině Google Sheets / Drive API (jen endpointy, které aplikace používá). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SheetsUloziste } from '../js/uloziste/sheets.js';

function falesnyGoogle() {
  const listy = new Map(); // název → { sheetId, mrizka: [][] }
  let dalsiId = 100;
  const log = [];
  const odpoved = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });
  const rozsah = (r) => {
    r = decodeURIComponent(r);
    const m = /^'((?:[^']|'')+)'(?:!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?)?$/.exec(r);
    if (!m) throw new Error('rozsah ' + r);
    const col = (s) => (s ? [...s].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1 : null);
    return { list: m[1].replace(/''/g, "'"), c1: col(m[2]), r1: m[3] ? +m[3] : null, c2: col(m[4]), r2: m[5] ? +m[5] : null };
  };
  const zapis = (list, r1, c1, values) => {
    const g = listy.get(list).mrizka;
    values.forEach((row, i) => {
      g[r1 - 1 + i] = g[r1 - 1 + i] || [];
      row.forEach((v, j) => { if (v !== null) g[r1 - 1 + i][c1 + j] = v; });
    });
  };
  globalThis.fetch = async (url, opt = {}) => {
    const u = new URL(url);
    const body = opt.body ? JSON.parse(opt.body) : null;
    log.push((opt.method || 'GET') + ' ' + u.pathname);
    const p = u.pathname.replace('/v4/spreadsheets', '');
    if (u.host.includes('www.googleapis.com')) return odpoved({ files: [] });
    if (p === '' && opt.method === 'POST') {
      body.sheets.forEach((s) => listy.set(s.properties.title, { sheetId: dalsiId++, mrizka: [] }));
      return odpoved({ spreadsheetId: 'S1', sheets: [...listy].map(([t, l]) => ({ properties: { title: t, sheetId: l.sheetId } })) });
    }
    if (p === '/S1' && (!opt.method || opt.method === 'GET')) return odpoved({ properties: { title: 'Finance – data' }, sheets: [...listy].map(([t, l]) => ({ properties: { title: t, sheetId: l.sheetId } })) });
    if (p === '/S1:batchUpdate') {
      const replies = body.requests.map((r) => {
        if (r.addSheet) { const id = dalsiId++; listy.set(r.addSheet.properties.title, { sheetId: id, mrizka: [] }); return { addSheet: { properties: { sheetId: id } } }; }
        if (r.deleteDimension) { const rg = r.deleteDimension.range; const l = [...listy.values()].find((x) => x.sheetId === rg.sheetId); l.mrizka.splice(rg.startIndex, rg.endIndex - rg.startIndex); }
        return {};
      });
      return odpoved({ replies });
    }
    if (p === '/S1/values:batchUpdate') { body.data.forEach((d) => { const r = rozsah(encodeURIComponent(d.range)); zapis(r.list, r.r1, r.c1, d.values); }); return odpoved({}); }
    if (p === '/S1/values:batchGet') {
      return odpoved({ valueRanges: u.searchParams.getAll('ranges').map((r) => ({ values: listy.get(rozsah(encodeURIComponent(r)).list).mrizka.map((x) => x || []) })) });
    }
    let m = /^\/S1\/values\/(.+):append$/.exec(p);
    if (m) {
      const r = rozsah(m[1]);
      const g = listy.get(r.list).mrizka;
      const od = g.length + 1;
      zapis(r.list, od, 0, body.values);
      return odpoved({ updates: { updatedRange: "'" + r.list + "'!A" + od + ':Z' + (od + body.values.length - 1) } });
    }
    m = /^\/S1\/values\/(.+)$/.exec(p);
    if (m && opt.method === 'PUT') { const r = rozsah(m[1]); zapis(r.list, r.r1, r.c1, body.values); return odpoved({}); }
    if (m) { const r = rozsah(m[1]); return odpoved({ values: listy.get(r.list).mrizka.map((row) => [(row || [])[r.c1] ?? '']) }); }
    throw new Error('Nečekané volání ' + p);
  };
  return { listy, log };
}

test('založení, zápis, úprava, smazání a doplnění schématu v Google tabulce', async () => {
  const G = falesnyGoogle();
  const token = async () => 'T';
  const s = await SheetsUloziste.zaloz(token, 'Finance – data', ['_config', 'pohyby']);
  assert.deepEqual([...G.listy.keys()], ['_config', 'pohyby']);
  assert.deepEqual(G.listy.get('pohyby').mrizka[0].slice(0, 3), ['id', 'datum', 'popis']);
  await s.nastavVice({ moduly: ['utraty'], vyplata_den: 20 });
  await s.nastav('vyplata_den', 21);  // přepíše existující klíč, nepřidá nový řádek
  const cfgRadky = G.listy.get('_config').mrizka.filter((r) => r && r[0]);
  assert.equal(cfgRadky.length, 4); // hlavička + schema_version + moduly + vyplata_den

  const a = await s.pridej('pohyby', { datum: '2026-11-17', popis: 'A', castka: 100, typ: 'Výdaj' });
  const b = await s.pridej('pohyby', { datum: '2026-11-18', popis: 'B', castka: 200, typ: 'Výdaj' });
  assert.equal(G.listy.get('pohyby').mrizka[1][1], 46343); // datum jako sériové číslo
  await s.uprav('pohyby', b.id, { castka: 250 });
  await s.smaz('pohyby', a.id);
  assert.equal(G.listy.get('pohyby').mrizka.length, 2);

  // čerstvé načtení z „tabulky“
  const s2 = new SheetsUloziste(token, 'S1');
  await s2.nacti();
  assert.equal(s2.config.vyplata_den, 21);
  assert.deepEqual(s2.config.moduly, ['utraty']);
  assert.equal(s2.data.pohyby.length, 1);
  assert.equal(s2.data.pohyby[0].popis, 'B');
  assert.equal(s2.data.pohyby[0].castka, 250);
  assert.equal(s2.data.pohyby[0].datum, '2026-11-18');

  // někdo ručně smazal řádek → úprava nesmí sáhnout na jiný řádek
  G.listy.get('pohyby').mrizka.splice(1, 1);
  await assert.rejects(() => s2.uprav('pohyby', b.id, { castka: 1 }), /nebyl nalezen/);

  // zapnutí modulu: nový list, nic stávajícího se nemění
  const pred = G.log.length;
  const zmeny = await s2.zajistiSchema(['_config', 'pohyby', 'ucty', 'stavy']);
  assert.deepEqual(zmeny, ['nový list „ucty“', 'nový list „stavy“']);
  // před změnou struktury nejdřív kopie tabulky na Disk
  const nove = G.log.slice(pred);
  const kopie = nove.indexOf('POST /drive/v3/files/S1/copy');
  assert.ok(kopie >= 0, 'chybí záloha před změnou');
  assert.ok(kopie < nove.indexOf('POST /v4/spreadsheets/S1:batchUpdate'), 'záloha musí být před změnou');
  // bez změny struktury se záloha nedělá
  const pred2 = G.log.length;
  await s2.zajistiSchema(['_config', 'pohyby']);
  assert.equal(G.log.slice(pred2).filter((x) => x.includes('/copy')).length, 0);
  assert.equal(G.log.filter((x) => x.includes('deleteDimension')).length, 0);
});
