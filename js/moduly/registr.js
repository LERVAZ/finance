/* Registr modulů. Nový modul = nový soubor + řádek sem. UI se skládá jen ze zapnutých modulů. */
import ucty from './ucty.js';
import utraty from './utraty.js';
import trvale from './trvale.js';
import rocni from './rocni.js';
import zdroje from './zdroje.js';
import investice from './investice.js';
import dluhopis from './dluhopis.js';
import hypoteka from './hypoteka.js';
import stavebko from './stavebko.js';
import pojisteni from './pojisteni.js';
import majetek from './majetek.js';
import dane from './dane.js';
import archiv from './archiv.js';

export const MODULY = [ucty, utraty, trvale, rocni, zdroje, investice, dluhopis, hypoteka, stavebko, pojisteni, majetek, dane, archiv];

export const modul = (id) => MODULY.find((m) => m.id === id);
export const vychoziModuly = () => MODULY.filter((m) => m.vychozi).map((m) => m.id);
export function zapnute(config) {
  const ids = Array.isArray(config.moduly) ? config.moduly : vychoziModuly();
  return MODULY.filter((m) => ids.includes(m.id));
}
/** Listy tabulky potřebné pro dané moduly. */
export const tabulkyProModuly = (ids) => [...new Set(['_config', ...MODULY.filter((m) => ids.includes(m.id)).flatMap((m) => m.tabulky)])];
