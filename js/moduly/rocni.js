/* Modul Roční platby: pojistky, STK, daně, vyúčtování… s upozorněním předem. */
import { html, karta } from '../html.js';
import { kc, MESICE } from '../texty.js';
import { souhrnRocnich, DRUHY_ZDROJU } from '../vypocty/produkty.js';
import { mesicText } from '../vypocty/hypoteka.js';

export const druhyZdroju = (ctx) => (Array.isArray(ctx.cfg.zdroje_druhy) && ctx.cfg.zdroje_druhy.length ? ctx.cfg.zdroje_druhy : DRUHY_ZDROJU);
const STAVY = { 'tento měsíc': 'st-tento', 'blíží se': 'st-blizi', 'v pořádku': 'st-ok', 'doplň měsíc': 'st-dopln' };

const editor = {
  nadpisNovy: 'Nová roční platba', nadpis: 'Upravit roční platbu', barva: 'amber', mazani: 'smazat',
  pole: [
    { n: 'nazev', l: 'Název', typ: 'text', povinne: true, placeholder: 'např. Pojištění auta' },
    { n: 'castka', l: 'Částka', typ: 'castka', placeholder: 'prázdné = podle vyúčtování' },
    { n: 'mesic', l: 'Měsíc platby', typ: 'mesic' },
    { n: 'kazdych_let', l: 'Platí se jednou za (let)', typ: 'cislo', vychozi: () => 1 },
    { n: 'posledni_rok', l: 'Naposledy placeno v roce', typ: 'cislo', napoveda: 'jen u plateb jednou za víc let (např. STK)' },
    { n: 'upozornit_mesicu', l: 'Upozornit měsíců předem', typ: 'cislo', vychozi: () => 1 },
    { n: 'zdroj', l: 'Platím z', typ: 'select', moznosti: (ctx) => [['', 'Běžný účet'], ...(ctx.zapnuto('zdroje') ? druhyZdroju(ctx).map((d) => [d.nazev, d.nazev]) : [])] },
    { n: 'komu', l: 'Komu', typ: 'text' },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ]
};

export const souhrn = (ctx) => ctx.pamet.rocni || (ctx.pamet.rocni = souhrnRocnich(ctx.data('rocni_platby'), ctx.dnes));

function upozorneni(ctx) {
  const s = souhrn(ctx);
  if (!s.blizi.length) return [];
  return [html`<div class="alert" role="status"><b>Blíží se platba:</b> ${s.blizi.map((p, i) => html`${i ? ' · ' : ''}${p.nazev} – ${MESICE[Number(p.dalsi.slice(5)) - 1]}${p.castka ? ', cca ' + kc(p.castka) : ''}${p.zaMes <= 0 ? html` <b>tento měsíc</b>` : ' za ' + p.zaMes + ' měs.'}`)}</div>`];
}

function seznam(ctx) {
  const s = souhrn(ctx);
  return html`<section class="card c-amber"><div class="chead"><h2>Roční platby</h2><span class="muted small">ročně ${kc(s.rocne)} · měsíčně ${kc(s.mesicne)}</span></div>
    <div class="mlist">${s.polozky.length ? s.polozky.map((p) => html`<button type="button" class="mrow rowbtn" data-akce="editor.otevrit" data-tab="rocni_platby" data-id="${p.id}">
      <span class="n">${p.nazev}<span class="note">${[p.komu, p.kazdych_let > 1 ? 'každé ' + p.kazdych_let + ' roky' : '', p.zdroj ? 'z: ' + p.zdroj : '', p.poznamka].filter(Boolean).join(' · ')}</span></span>
      <span class="a">${p.castka ? kc(p.castka) : html`<span class="muted">dle vyúčt.</span>`}</span>
      <span class="d r">${p.dalsi ? mesicText(p.dalsi) : '–'}</span>
      <span class="st ${STAVY[p.stav]}">${p.stav === 'blíží se' || p.stav === 'v pořádku' ? 'za ' + p.zaMes + ' měs.' : p.stav}</span></button>`)
      : html`<p class="muted small">Zatím žádné. Přidej pojistky, STK, daň z nemovitosti, vyúčtování…</p>`}</div>
    <div class="hbtns"><button type="button" class="btn2 slim" data-akce="editor.otevrit" data-tab="rocni_platby">+ Přidat roční platbu</button></div></section>`;
}

function karty(ctx) {
  const s = souhrn(ctx);
  if (!s.polozky.length) return [];
  const nejblizsi = s.polozky.filter((p) => p.dalsi).slice(0, 4);
  const prvni = nejblizsi[0];
  return [{ id: 'rocni', nazev: 'Roční platby', barva: 'amber', poradi: 45,
    souhrn: prvni ? { hodnota: prvni.castka ? kc(prvni.castka) : '–', pod: mesicText(prvni.dalsi) + ' · ' + prvni.nazev } : { hodnota: kc(s.mesicne), pod: 'měsíčně' },
    html: karta('amber', 'Roční platby', html`<div class="mlist">${nejblizsi.map((p) => html`<div class="mrow"><span class="d">${mesicText(p.dalsi)}</span>
    <span class="n">${p.nazev}</span><span class="a">${p.castka ? kc(p.castka) : '–'}</span></div>`)}</div>
    <div class="muted small">ročně ${kc(s.rocne)}, tj. ${kc(s.mesicne)} měsíčně</div>`) }];
}

export default {
  id: 'rocni',
  nazev: 'Roční platby',
  popis: 'Pojistky, STK, daně, vyúčtování – upozornění několik měsíců předem.',
  ikona: 'trvale',
  tabulky: ['rocni_platby'],
  editory: { rocni_platby: editor },
  upozorneni, karty,
  vyhled: (ctx) => [{ poradi: 50, html: seznam(ctx) }],
  zapis: [{ id: 'rocni', nazev: 'Roční platby', poradi: 50, render: seznam }],
  akce: {}
};
