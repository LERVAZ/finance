/* Kontext pro moduly: data, nastavení a sdílené výpočty. Používá ho aplikace i testy. */
import { KATEGORIE_VYCHOZI } from './texty.js';
import { klicObdobi, kalendarVyplat } from './vypocty/obdobi.js';
import { souhrnObdobi } from './vypocty/utraty.js';
import { prehledUctu } from './vypocty/ucty.js';
import { zapnute } from './moduly/registr.js';

export function vytvorKontext({ store, dnes, ui = {}, zprava = () => {}, potvrd = () => true, prejdi = () => {} }) {
  const s = store;
  const cfg = s ? s.config : {};
  const moduly = s ? zapnute(cfg) : [];
  const ids = moduly.map((m) => m.id);
  const cache = {};
  const ctx = {
    store: s, cfg, moduly, dnes, ui, pamet: {},
    zapnuto: (id) => ids.includes(id),
    data: (tab) => (s && s.data[tab]) || [],
    vyplataDen: () => Number(cfg.vyplata_den) || 1,
    /** Výplatní den + data zapsaných výplat – období začíná dnem, kdy výplata skutečně přišla. */
    kalendar: () => cache.kal || (cache.kal = kalendarVyplat(Number(cfg.vyplata_den) || 1, ctx.data('pohyby'), cfg.vyplata_castka)),
    kategorie: () => (Array.isArray(cfg.kategorie) && cfg.kategorie.length ? cfg.kategorie : KATEGORIE_VYCHOZI),
    uctyPrehled: () => cache.ucty || (cache.ucty = ctx.data('ucty').filter((u) => u.aktivni !== false && u.id)
      .map((u) => prehledUctu(u, ctx.data('stavy'), dnes))),
    obdobi: (klic) => cache['o' + klic] || (cache['o' + klic] = souhrnObdobi({
      klic, vyplataDen: ctx.kalendar(), dnes,
      trvale: ids.includes('trvale') ? ctx.data('trvale_platby') : null,
      pohyby: ctx.data('pohyby'), ucetVyplaty: cfg.ucet_vyplaty || '', vyplataOcekavana: cfg.vyplata_castka })),
    zprava, potvrd, prejdi
  };
  ctx.aktualniKlic = klicObdobi(dnes, ctx.kalendar());
  return ctx;
}
