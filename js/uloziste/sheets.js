/* Úložiště v Google tabulce uživatele (Sheets API v4 + Drive API v3, oprávnění drive.file).
   Pravidla: hlavička v 1. řádku, jen přidávání listů a sloupců, řádky se hledají podle id
   (před úpravou či smazáním se vždy znovu přečte sloupec id, aby se nesáhlo na jiný řádek). */
import { TABULKY, VERZE_SCHEMATU, sloupce, typSloupce, noveId } from '../schema.js';
import { objektNaRadek, radekNaObjekt, prazdnyRadek, pismeno } from './prevod.js';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const ZNACKA = { finance_app: 'data' };
const q = (t) => "'" + t.replace(/'/g, "''") + "'";

export class ChybaApi extends Error {
  constructor(zprava, status) { super(zprava); this.status = status; this.needLogin = status === 401; }
}

async function volej(token, url, { method = 'GET', body } = {}) {
  const t = await token();
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + t, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    let msg = 'Google odpověděl chybou ' + r.status + '.';
    try { const j = await r.json(); if (j.error && j.error.message) msg += ' ' + j.error.message; } catch (e) { /* bez těla */ }
    if (r.status === 401) msg = 'Přihlášení vypršelo, přihlas se znovu.';
    if (r.status === 403 && /insufficient/i.test(msg)) msg = 'Google nepovolil přístup. Přihlas se znovu a na stránce Googlu potvrď oprávnění k souborům aplikace.';
    throw new ChybaApi(msg, r.status);
  }
  return r.status === 204 ? null : r.json();
}

function formatySloupcu(tab, sheetId, hlavicka) {
  const req = [];
  hlavicka.forEach((h, i) => {
    const typ = typSloupce(tab, h);
    const fmt = typ === 'datum' ? { type: 'DATE', pattern: 'd.m.yyyy' } : typ === 'castka' ? { type: 'NUMBER', pattern: '#,##0 "Kč"' } : null;
    if (!fmt) return;
    req.push({ repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
      cell: { userEnteredFormat: { numberFormat: fmt } }, fields: 'userEnteredFormat.numberFormat' } });
  });
  req.push({ repeatCell: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
    cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } });
  return req;
}

export class SheetsUloziste {
  constructor(token, id) {
    this.druh = 'sheets';
    this.token = token;
    this.id = id;
    this.config = {};
    this.data = {};
    this.hlavicky = {};
    this.sheetIds = {};
    this.radky = {};     // tab → pole čísel řádků v listu (souběžné s this.data[tab])
  }

  /** Najde tabulku, kterou aplikace dřív založila (drive.file vidí jen soubory aplikace). */
  static async najdi(token) {
    const dotaz = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and appProperties has { key='finance_app' and value='data' }";
    const j = await volej(token, DRIVE + '?q=' + encodeURIComponent(dotaz) + '&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&pageSize=10');
    return j.files || [];
  }

  /** Založí novou tabulku jen s listy pro zvolené moduly. */
  static async zaloz(token, nazev, tabulky) {
    const listy = ['_config', ...tabulky.filter((t) => t !== '_config')];
    const ss = await volej(token, SHEETS, { method: 'POST', body: {
      properties: { title: nazev, locale: 'cs_CZ', timeZone: 'Europe/Prague' },
      sheets: listy.map((t) => ({ properties: { title: t, gridProperties: { frozenRowCount: 1 } } }))
    } });
    const u = new SheetsUloziste(token, ss.spreadsheetId);
    ss.sheets.forEach((s) => { u.sheetIds[s.properties.title] = s.properties.sheetId; });
    await volej(token, SHEETS + '/' + u.id + '/values:batchUpdate', { method: 'POST', body: {
      valueInputOption: 'RAW',
      data: listy.map((t) => ({ range: q(t) + '!A1', values: [sloupce(t)] }))
    } });
    const req = [];
    listy.forEach((t) => { u.hlavicky[t] = sloupce(t); u.data[t] = []; u.radky[t] = []; req.push(...formatySloupcu(t, u.sheetIds[t], sloupce(t))); });
    await volej(token, SHEETS + '/' + u.id + ':batchUpdate', { method: 'POST', body: { requests: req } });
    try { await volej(token, DRIVE + '/' + u.id, { method: 'PATCH', body: { appProperties: ZNACKA, description: 'Data aplikace Finance. Listy neodstraňuj ani nepřejmenovávej.' } }); } catch (e) { /* jen značka pro vyhledání */ }
    await u.nastavVice({ schema_version: VERZE_SCHEMATU });
    return u;
  }

  odkaz() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  maTabulku(t) { return t in this.sheetIds; }

  async nacti() {
    const meta = await volej(this.token, SHEETS + '/' + this.id + '?fields=properties.title,sheets.properties(sheetId,title)');
    this.nazev = meta.properties.title;
    this.sheetIds = {};
    meta.sheets.forEach((s) => { this.sheetIds[s.properties.title] = s.properties.sheetId; });
    const tabs = Object.keys(TABULKY).filter((t) => t in this.sheetIds);
    this.data = {}; this.hlavicky = {}; this.radky = {};
    if (tabs.length) {
      const url = SHEETS + '/' + this.id + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&' +
        tabs.map((t) => 'ranges=' + encodeURIComponent(q(t))).join('&');
      const j = await volej(this.token, url);
      j.valueRanges.forEach((vr, i) => {
        const t = tabs[i];
        const vals = vr.values || [];
        const hl = (vals[0] || []).map((h) => String(h).trim());
        this.hlavicky[t] = hl;
        this.data[t] = []; this.radky[t] = [];
        for (let r = 1; r < vals.length; r++) {
          if (prazdnyRadek(vals[r])) continue;
          this.data[t].push(radekNaObjekt(t, hl, vals[r]));
          this.radky[t].push(r + 1);
        }
      });
    }
    this.config = {};
    (this.data._config || []).forEach((r) => { if (r.klic) this.config[r.klic] = r.hodnota; });
    return this;
  }

  /* ---------- zálohy: kopie celé tabulky na Disku uživatele ---------- */

  /** Zálohy této tabulky, nejnovější první: [{ id, name, createdTime, appProperties }]. */
  async zalohy() {
    const dotaz = "trashed=false and appProperties has { key='finance_app' and value='zaloha' } and appProperties has { key='zdroj' and value='" + this.id + "' }";
    const j = await volej(this.token, DRIVE + '?q=' + encodeURIComponent(dotaz) + '&orderBy=createdTime desc&fields=files(id,name,createdTime,appProperties)&pageSize=100');
    return j.files || [];
  }

  /** Vytvoří kopii tabulky. duvod = krátký text do názvu, verze = verze aplikace. Starší než posledních `ponechat` přesune do koše. */
  async zalohuj(duvod, verze, ponechat = 10) {
    const ted = new Date();
    const datum = ted.toLocaleDateString('cs-CZ') + ' ' + ted.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    const z = await volej(this.token, DRIVE + '/' + this.id + '/copy?fields=id,name,createdTime', { method: 'POST', body: {
      name: (this.nazev || 'Finance – data') + ' – záloha ' + datum + ' (' + duvod + ')',
      description: 'Záloha z aplikace Finance. Pro obnovu: Nastavení → Zálohy tabulky.',
      appProperties: { finance_app: 'zaloha', zdroj: this.id, verze: String(verze || '') }
    } });
    try {
      const vse = await this.zalohy();
      for (const stara of vse.slice(ponechat)) await volej(this.token, DRIVE + '/' + stara.id, { method: 'PATCH', body: { trashed: true } });
    } catch (e) { /* úklid starých záloh není nutný pro úspěch */ }
    return z;
  }

  /** Při první práci s novou verzí aplikace udělá zálohu (jen jednou pro každou verzi). */
  async zalohujProVerzi(verze) {
    const vse = await this.zalohy();
    if (vse.some((z) => z.appProperties && z.appProperties.verze === String(verze))) return null;
    return this.zalohuj('verze ' + verze, verze);
  }

  /** Doplní chybějící listy a sloupce (jen přidávání). Před změnou udělá zálohu. Vrací seznam provedených změn. */
  async zajistiSchema(tabulky) {
    const zmeny = [];
    const nove = tabulky.filter((t) => !(t in this.sheetIds));
    const budeZmena = nove.length || tabulky.some((t) => this.hlavicky[t] && sloupce(t).some((s) => !this.hlavicky[t].includes(s)));
    if (budeZmena) {
      try { await this.zalohuj('před změnou struktury', this.verzeAplikace); } catch (e) {
        throw new ChybaApi('Před změnou struktury tabulky se nepodařilo udělat zálohu, proto se nic nezměnilo. ' + e.message, e.status);
      }
    }
    if (nove.length) {
      const j = await volej(this.token, SHEETS + '/' + this.id + ':batchUpdate', { method: 'POST', body: {
        requests: nove.map((t) => ({ addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1 } } } })) } });
      j.replies.forEach((r, i) => { this.sheetIds[nove[i]] = r.addSheet.properties.sheetId; });
      await volej(this.token, SHEETS + '/' + this.id + '/values:batchUpdate', { method: 'POST', body: {
        valueInputOption: 'RAW', data: nove.map((t) => ({ range: q(t) + '!A1', values: [sloupce(t)] })) } });
      const req = [];
      nove.forEach((t) => { this.hlavicky[t] = sloupce(t); this.data[t] = []; this.radky[t] = []; req.push(...formatySloupcu(t, this.sheetIds[t], sloupce(t))); zmeny.push('nový list „' + t + '“'); });
      await volej(this.token, SHEETS + '/' + this.id + ':batchUpdate', { method: 'POST', body: { requests: req } });
    }
    const data = [];
    for (const t of tabulky) {
      const hl = this.hlavicky[t] || [];
      const chybi = sloupce(t).filter((s) => !hl.includes(s));
      if (!chybi.length) continue;
      const od = hl.length;
      data.push({ range: q(t) + '!' + pismeno(od) + '1', values: [chybi] });
      this.hlavicky[t] = hl.concat(chybi);
      zmeny.push('list „' + t + '“: nové sloupce ' + chybi.join(', '));
    }
    if (data.length) await volej(this.token, SHEETS + '/' + this.id + '/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data } });
    if ((Number(this.config.schema_version) || 0) < VERZE_SCHEMATU) { await this.nastav('schema_version', VERZE_SCHEMATU); }
    return zmeny;
  }

  async pridej(tab, obj) { return (await this.pridejVice(tab, [obj]))[0]; }

  async pridejVice(tab, objs) {
    if (!objs.length) return [];
    const hl = this.hlavicky[tab];
    if (!hl) throw new Error('V tabulce chybí list „' + tab + '“.');
    const out = objs.map((o) => ({ ...o, ...(hl.includes('id') ? { id: o.id || noveId() } : {}) }));
    const j = await volej(this.token, SHEETS + '/' + this.id + '/values/' + encodeURIComponent(q(tab) + '!A1') +
      ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST',
      body: { values: out.map((o) => objektNaRadek(tab, hl, o)) } });
    const m = /![A-Z]+(\d+)/.exec(j.updates && j.updates.updatedRange || '');
    const prvni = m ? Number(m[1]) : null;
    out.forEach((o, i) => { this.data[tab].push(o); this.radky[tab].push(prvni ? prvni + i : null); });
    if (!prvni) await this.nacti();
    return out;
  }

  /** Číslo řádku v listu podle id – vždy čerstvě z tabulky. */
  async najdiRadek(tab, klicSloupec, hodnota) {
    const hl = this.hlavicky[tab];
    const ci = hl.indexOf(klicSloupec);
    if (ci < 0) throw new Error('List „' + tab + '“ nemá sloupec ' + klicSloupec + '.');
    const col = pismeno(ci);
    const j = await volej(this.token, SHEETS + '/' + this.id + '/values/' + encodeURIComponent(q(tab) + '!' + col + ':' + col) + '?valueRenderOption=UNFORMATTED_VALUE');
    const v = j.values || [];
    const nalezeno = [];
    for (let r = 1; r < v.length; r++) if (v[r] && String(v[r][0]) === String(hodnota)) nalezeno.push(r + 1);
    if (nalezeno.length > 1) throw new Error('V listu „' + tab + '“ je víc řádků se stejným ' + klicSloupec + ' (' + hodnota + '). Oprav to v tabulce.');
    return nalezeno[0] || null;
  }

  async uprav(tab, id, zmeny) {
    const i = this.data[tab].findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Záznam už neexistuje.');
    const radek = await this.najdiRadek(tab, 'id', id);
    if (!radek) throw new Error('Záznam v tabulce nebyl nalezen (možná byl smazán ručně). Načti data znovu.');
    const novy = { ...this.data[tab][i], ...zmeny, id };
    const hl = this.hlavicky[tab];
    await volej(this.token, SHEETS + '/' + this.id + '/values/' + encodeURIComponent(q(tab) + '!A' + radek + ':' + pismeno(hl.length - 1) + radek) +
      '?valueInputOption=RAW', { method: 'PUT', body: { values: [objektNaRadek(tab, hl, novy)] } });
    this.data[tab][i] = novy; this.radky[tab][i] = radek;
    return novy;
  }

  async smaz(tab, id) {
    const i = this.data[tab].findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Záznam už neexistuje.');
    const radek = await this.najdiRadek(tab, 'id', id);
    if (!radek) throw new Error('Záznam v tabulce nebyl nalezen (možná byl smazán ručně). Načti data znovu.');
    await volej(this.token, SHEETS + '/' + this.id + ':batchUpdate', { method: 'POST', body: { requests: [{ deleteDimension: {
      range: { sheetId: this.sheetIds[tab], dimension: 'ROWS', startIndex: radek - 1, endIndex: radek } } }] } });
    this.data[tab].splice(i, 1); this.radky[tab].splice(i, 1);
    this.radky[tab] = this.radky[tab].map((r) => (r && r > radek ? r - 1 : r));
  }

  async nastav(klic, hodnota) { return this.nastavVice({ [klic]: hodnota }); }

  /** Zapíše hodnoty do listu _config (existující klíč přepíše, nový přidá). */
  async nastavVice(obj) {
    const hl = this.hlavicky._config;
    const ci = hl.indexOf('klic');
    const col = pismeno(ci);
    const j = await volej(this.token, SHEETS + '/' + this.id + '/values/' + encodeURIComponent(q('_config') + '!' + col + ':' + col) + '?valueRenderOption=UNFORMATTED_VALUE');
    const v = j.values || [];
    const existujici = {};
    for (let r = 1; r < v.length; r++) if (v[r] && v[r][0] !== undefined && v[r][0] !== '') existujici[String(v[r][0])] = r + 1;
    const upd = [], nove = [];
    for (const [k, h] of Object.entries(obj)) {
      const row = objektNaRadek('_config', hl, { klic: k, hodnota: h });
      if (existujici[k]) upd.push({ range: q('_config') + '!A' + existujici[k] + ':' + pismeno(hl.length - 1) + existujici[k], values: [row.map((x, i) => (hl[i] === 'poznamka' ? null : x))] });
      else nove.push(row);
      this.config[k] = h;
    }
    if (upd.length) await volej(this.token, SHEETS + '/' + this.id + '/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data: upd } });
    if (nove.length) await volej(this.token, SHEETS + '/' + this.id + '/values/' + encodeURIComponent(q('_config') + '!A1') +
      ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: { values: nove } });
  }
}
