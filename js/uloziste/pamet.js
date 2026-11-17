/* Úložiště v paměti – ukázkový režim bez přihlášení. Po zavření stránky se vše zapomene. */
import { TABULKY, VERZE_SCHEMATU, noveId } from '../schema.js';

export class PametUloziste {
  constructor(vychozi) {
    this.druh = 'pamet';
    this.config = { ...(vychozi?.config || {}) };
    this.data = {};
    for (const [t, rows] of Object.entries(vychozi?.data || {})) this.data[t] = rows.map((r) => ({ ...r }));
  }
  async nacti() { return this; }
  async zajistiSchema(tabulky) {
    const zmeny = [];
    for (const t of tabulky) if (!this.data[t]) { this.data[t] = []; zmeny.push('nový list ' + t); }
    if ((this.config.schema_version || 0) < VERZE_SCHEMATU) this.config.schema_version = VERZE_SCHEMATU;
    return zmeny;
  }
  maTabulku(t) { return !!this.data[t]; }
  async pridej(tab, obj) { return (await this.pridejVice(tab, [obj]))[0]; }
  async pridejVice(tab, objs) {
    if (!this.data[tab]) this.data[tab] = [];
    const out = objs.map((o) => ({ ...o, id: o.id || (TABULKY[tab].sloupce.some((s) => s[0] === 'id') ? noveId() : undefined) }));
    this.data[tab].push(...out);
    return out;
  }
  async uprav(tab, id, zmeny) {
    const r = (this.data[tab] || []).find((x) => x.id === id);
    if (!r) throw new Error('Záznam už neexistuje.');
    Object.assign(r, zmeny, { id });
    return r;
  }
  async smaz(tab, id) {
    const i = (this.data[tab] || []).findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Záznam už neexistuje.');
    this.data[tab].splice(i, 1);
  }
  async nastav(klic, hodnota) { this.config[klic] = hodnota; }
  async nastavVice(obj) { Object.assign(this.config, obj); }
  odkaz() { return null; }
  // ukázka nemá Disk – zálohy se nedělají
  async zalohy() { return []; }
  async zalohuj() { return null; }
  async zalohujProVerzi() { return null; }
}
