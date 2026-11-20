/* Modul Napojení na banku (Enable Banking přes Apps Script v tabulce uživatele).
   Skript stahuje do listů banka_ucty a banka_pohyby, aplikace pohyby nabídne k potvrzení:
   zapsat jako pohyb, spárovat s ručním zápisem, nebo nezapisovat (trvalá platba, převod mezi vlastními účty). */
import { html, karta, raw } from '../html.js';
import { kc, sk, datum, datumKratce, TYPY_POHYBU } from '../texty.js';
import { navrhy, stavNapojeni } from '../vypocty/banka.js';
import { zmenaSporiciho, jeVydaj } from '../vypocty/utraty.js';
import { upravSporici } from './utraty.js';

const NAVOD = 'https://github.com/LERVAZ/finance/blob/main/docs/NAVOD.md#6-napojení-banky';
const ADRESA_SKRIPTU = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

const nazevUctu = (ctx, id) => { const u = ctx.data('ucty').find((x) => x.id === id); return u ? u.banka + ' – ' + u.nazev : ''; };

function kontext(ctx) {
  return { bankaPohyby: ctx.data('banka_pohyby'), bankaUcty: ctx.data('banka_ucty'), pohyby: ctx.data('pohyby'),
    trvale: ctx.zapnuto('trvale') ? ctx.data('trvale_platby') : [], ucty: ctx.data('ucty'), ucetSporici: ctx.cfg.ucet_sporici || '' };
}

/** Text „staženo“ ze sloupce stazeno ('yyyy-mm-dd hh:mm'). */
const kdyStazeno = (s) => (s ? datumKratce(String(s).slice(0, 10)) + ' ' + String(s).slice(11, 16) : 'zatím ne');

/* ---------- Zápis → Z banky ---------- */

function nastaveni(ctx, S) {
  const url = ctx.cfg.banka_skript_url || '';
  const ucty = ctx.data('ucty').filter((u) => u.aktivni !== false);
  return html`<section class="card c-blue"><div class="chead"><h2>Napojení na banku</h2></div>
    ${S.pripojeno ? html`<div class="mlist">${S.ucty.map((u) => html`<form class="mrow banka-ucet" data-akce="banka.priradit" autocomplete="off">
        <input type="hidden" name="id" value="${u.id}">
        <span class="n">${u.banka} · ${u.nazev}<span class="note">${u.iban || ''}${u.zustatek !== null && u.zustatek !== undefined ? ' · ' + kc(u.zustatek) + (u.k_datu ? ' k ' + datumKratce(u.k_datu) : '') : ''} · staženo ${kdyStazeno(u.stazeno)}${u.chyba ? html` · <b class="neg">${u.chyba}</b>` : ''}</span></span>
        <select name="ucet_id" aria-label="Účet v aplikaci" data-zmena="banka.priraditZmena"><option value="">— přiřadit k účtu —</option>${ucty.map((x) => html`<option value="${x.id}" ${x.id === u.ucet_id ? 'selected' : ''}>${x.banka} – ${x.nazev}</option>`)}</select>
      </form>`)}</div>
      <p class="note">Souhlas banky platí do <b>${datum(S.souhlasDo)}</b>${S.zbyvaDni !== null ? ' (zbývá ' + Math.max(0, S.zbyvaDni) + ' dní)' : ''}. Zůstatek přiřazeného účtu se zapisuje sám.</p>`
      : html`<p class="muted">Zatím není připojená žádná banka. Postup je v návodu, kapitola 6: registrace na Enable Banking, skript v tabulce a přihlášení do banky.</p>`}
    <form class="form" data-akce="banka.ulozitUrl" autocomplete="off">
      <div class="field"><label for="bUrl">Adresa skriptu (webová aplikace, končí /exec)</label>
        <input id="bUrl" name="url" value="${url}" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url"></div>
      <div class="hbtns"><button type="submit" class="btn2 slim">Uložit adresu</button></div>
    </form>
    <div class="hbtns">
      ${url ? html`<a class="btn slim" href="${url}" target="_blank" rel="noopener">${S.pripojeno ? (S.obnovit ? 'Obnovit souhlas banky' : 'Připojit další banku / obnovit') : 'Připojit banku'}</a>` : ''}
      <button type="button" class="btn2 slim" data-akce="banka.kopirovatSkript">Zkopírovat kód skriptu</button>
      ${ctx.store.odkaz && ctx.store.odkaz() ? html`<a class="btn2 slim" href="${ctx.store.odkaz()}" target="_blank" rel="noopener">Otevřít tabulku</a>` : ''}
      <a class="btn2 slim" href="${NAVOD}" target="_blank" rel="noopener">Návod</a>
    </div></section>`;
}

const VOLBY_NIC = { trvala: 'Nezapisovat – trvalá platba', vlastni: 'Nezapisovat – převod mezi mými účty' };

function radekPotvrzeni(ctx, { t, n }, i, kategorie) {
  const volby = [];
  if (n.par) volby.push(['sparovat', 'Už zapsáno – spárovat']);
  TYPY_POHYBU.forEach((x) => volby.push([x.id, x.popis]));
  volby.push(['nic', VOLBY_NIC[n.akce] || 'Nezapisovat']);
  const vybrano = n.akce === 'sparovat' ? 'sparovat' : n.akce === 'zapsat' ? n.typ : 'nic';
  return html`<div class="mrow banka-tx" data-i="${i}">
    <input type="hidden" name="id_${i}" value="${t.id}">
    <span class="d">${datumKratce(t.datum)}</span>
    <span class="n">${n.popis}<span class="note">${n.duvod}${t.ucet_uid && ctx.data('banka_ucty').length > 1 ? ' · ' + ((ctx.data('banka_ucty').find((u) => u.id === t.ucet_uid) || {}).nazev || '') : ''}</span>
      <span class="banka-volby">
        <select name="typ_${i}" aria-label="Co s platbou">${volby.map(([v, l]) => html`<option value="${v}" ${v === vybrano ? 'selected' : ''}>${l}</option>`)}</select>
        <select name="kat_${i}" aria-label="Kategorie"><option value="">kategorie…</option>${kategorie.map((k) => html`<option ${k === n.kategorie ? 'selected' : ''}>${k}</option>`)}</select>
        <button type="button" class="slim" data-akce="banka.potvrditJeden" data-i="${i}">OK</button>
      </span></span>
    <span class="a ${t.castka > 0 ? 'pos' : ''}">${sk(t.castka)}</span>
  </div>`;
}

function zapis(ctx) {
  const S = stavNapojeni(ctx.data('banka_ucty'), ctx.dnes);
  const N = navrhy(kontext(ctx));
  const kategorie = ctx.kategorie();
  return html`${upozorneniHtml(S)}
    ${N.length ? html`<form class="card c-teal" data-akce="banka.potvrditVse" autocomplete="off">
      <div class="chead"><h2>Z banky k potvrzení (${N.length})</h2><button type="submit" class="slim">Potvrdit vše</button></div>
      <p class="note">U každé platby je návrh. Když nesedí, změň ho a potvrď jen ji (OK), nebo uprav všechny a dej „Potvrdit vše“.
        Trvalé platby se nezapisují – počítají se z trvalých plateb. Převod z banky na vlastní spořicí je „Převod na spořicí“.</p>
      <div class="mlist">${N.map((x, i) => radekPotvrzeni(ctx, x, i, kategorie))}</div>
    </form>` : S.pripojeno ? karta('teal', 'Z banky k potvrzení', html`<p class="muted">Všechno je vyřízené. Poslední stažení ${kdyStazeno(S.stazeno)}.</p>`) : ''}
    ${nastaveni(ctx, S)}`;
}

function upozorneniHtml(S) {
  if (!S.pripojeno) return '';
  const a = [];
  if (S.vyprselo) a.push('Souhlas banky vypršel ' + datum(S.souhlasDo) + '. Pohyby se nestahují – klikni na „Obnovit souhlas banky“.');
  else if (S.obnovit) a.push('Souhlas banky vyprší ' + datum(S.souhlasDo) + '. Obnov ho tlačítkem „Obnovit souhlas banky“.');
  if (S.chyby.length) a.push('Poslední stažení hlásilo chybu: ' + S.chyby.map((c) => c.nazev + ' – ' + c.chyba).join('; '));
  else if (S.stare) a.push('Z banky se nic nestáhlo od ' + kdyStazeno(S.stazeno) + '. Je zapnuté automatické stahování (v tabulce menu Banka)?');
  if (S.nesparovane) a.push('Některé bankovní účty nejsou přiřazené k účtu v aplikaci. Přiřaď je níže, ať se zapisuje zůstatek.');
  return a.map((t) => html`<div class="alert">${t}</div>`);
}

/* ---------- Přehled ---------- */

function karty(ctx) {
  const S = stavNapojeni(ctx.data('banka_ucty'), ctx.dnes);
  const N = navrhy(kontext(ctx));
  if (!S.pripojeno && !N.length) return [];
  const varovani = S.vyprselo || S.obnovit || S.chyby.length || S.stare;
  if (!N.length && !varovani) return [];
  const text = N.length ? N.length + (N.length === 1 ? ' platba čeká' : N.length < 5 ? ' platby čekají' : ' plateb čeká') + ' na potvrzení' : 'Napojení potřebuje pozornost';
  return [{ id: 'banka', nazev: 'Z banky', barva: 'teal', poradi: 15,
    souhrn: { hodnota: N.length ? String(N.length) : '!', pod: N.length ? 'k potvrzení' : 'napojení banky' },
    html: karta('teal', 'Z banky', html`<p>${text}.</p>${upozorneniHtml(S)}
      <div class="hbtns"><button type="button" class="slim" data-akce="prejdi" data-tab="zapis" data-sub="banka">${N.length ? 'Potvrdit platby →' : 'Otevřít napojení →'}</button></div>`) }];
}

/* ---------- akce ---------- */

/** Provede potvrzení vybraných řádků. volby: [{ id, typ, kategorie }] */
async function potvrd(ctx, volby) {
  const N = navrhy(kontext(ctx));
  const podleId = new Map(N.map((x) => [x.t.id, x]));
  const nove = [], parovat = [], stavy = [], sporici = [];
  const pripojeneUcty = new Set(ctx.data('banka_ucty').map((u) => u.ucet_id).filter(Boolean));
  const pouzite = new Set();
  for (const v of volby) {
    const x = podleId.get(v.id);
    if (!x) continue;
    const { t, n } = x;
    if (v.typ === 'nic') { stavy.push({ id: t.id, zmeny: { stav: n.akce === 'trvala' ? 'trvala' : 'ignorovano' } }); continue; }
    if (v.typ === 'sparovat') {
      if (!n.par || pouzite.has(n.par.id)) throw new Error('Platbu ' + n.popis + ' už není s čím spárovat.');
      pouzite.add(n.par.id);
      parovat.push({ id: n.par.id, zmeny: { banka_tx_id: t.id } });
      stavy.push({ id: t.id, zmeny: { stav: 'sparovano', pohyb_id: n.par.id } });
      continue;
    }
    if (!TYPY_POHYBU.some((y) => y.id === v.typ)) continue;
    const bu = ctx.data('banka_ucty').find((u) => u.id === t.ucet_uid) || {};
    const z = { datum: t.datum, popis: n.popis, castka: Math.abs(Number(t.castka) || 0), typ: v.typ,
      kategorie: jeVydaj(v.typ) ? (v.kategorie || 'Ostatní') : '', ucet_id: bu.ucet_id || '', zdroj: 'banka', banka_tx_id: t.id };
    nove.push({ z, t });
    // zůstatek spořicího: když spořicí není připojený z banky, upraví se jako u ručního zápisu
    if (zmenaSporiciho(v.typ, 1) && !pripojeneUcty.has(ctx.cfg.ucet_sporici)) sporici.push(z);
  }
  if (!nove.length && !parovat.length && !stavy.length) return 0;
  const zapsane = nove.length ? await ctx.store.pridejVice('pohyby', nove.map((x) => x.z)) : [];
  zapsane.forEach((p, i) => stavy.push({ id: nove[i].t.id, zmeny: { stav: 'zapsano', pohyb_id: p.id } }));
  if (parovat.length) await ctx.store.upravVice('pohyby', parovat);
  await ctx.store.upravVice('banka_pohyby', stavy);
  for (const z of sporici) await upravSporici(ctx, zmenaSporiciho(z.typ, z.castka), z.datum, z.popis);
  return stavy.length;
}

function volbyZFormulare(form, jenI) {
  const el = form.elements;
  const out = [];
  for (let i = 0; el['id_' + i]; i++) {
    if (jenI !== undefined && i !== jenI) continue;
    out.push({ id: el['id_' + i].value, typ: el['typ_' + i].value, kategorie: el['kat_' + i].value });
  }
  return out;
}

const akce = {
  'banka.potvrditVse': async (ctx, el) => {
    const v = volbyZFormulare(el);
    const zapsat = v.filter((x) => x.typ !== 'nic' && x.typ !== 'sparovat').length;
    if (!ctx.potvrd('Potvrdit ' + v.length + ' plateb z banky? Do pohybů se nově zapíše ' + zapsat + ', ostatní se spárují nebo označí jako nezapisované.')) return false;
    const n = await potvrd(ctx, v);
    ctx.zprava('Vyřízeno ' + n + ' plateb z banky.');
  },
  'banka.potvrditJeden': async (ctx, el) => {
    const n = await potvrd(ctx, volbyZFormulare(el.form, Number(el.dataset.i)));
    if (n) ctx.zprava('Platba vyřízena.');
  },
  'banka.priraditZmena': (ctx, el) => { setTimeout(() => el.form.requestSubmit(), 0); return false; },
  'banka.priradit': async (ctx, el, f) => {
    const bu = ctx.data('banka_ucty').find((u) => u.id === f.id);
    if (!bu) throw new Error('Bankovní účet nebyl nalezen. Načti data znovu.');
    const jinde = f.ucet_id && ctx.data('banka_ucty').find((u) => u.id !== bu.id && u.ucet_id === f.ucet_id);
    if (jinde) throw new Error('Tenhle účet už je přiřazený k bankovnímu účtu ' + (jinde.nazev || jinde.id) + '.');
    await ctx.store.upravVice('banka_ucty', [{ id: bu.id, zmeny: { ucet_id: f.ucet_id || '' } }]);
    if (f.ucet_id) {
      await ctx.store.upravVice('ucty', [{ id: f.ucet_id, zmeny: { napojeni: 'banka' } }]);
      if (bu.zustatek !== null && bu.zustatek !== undefined && bu.zustatek !== '') {
        await ctx.store.pridej('stavy', { datum: bu.k_datu || ctx.dnes, ucet_id: f.ucet_id, zustatek: Number(bu.zustatek), zdroj: 'banka' });
      }
    }
    if (bu.ucet_id && bu.ucet_id !== f.ucet_id) await ctx.store.upravVice('ucty', [{ id: bu.ucet_id, zmeny: { napojeni: 'rucne' } }]);
    ctx.zprava(f.ucet_id ? 'Přiřazeno k účtu ' + nazevUctu(ctx, f.ucet_id) + '.' : 'Přiřazení zrušeno.');
  },
  'banka.ulozitUrl': async (ctx, el, f) => {
    const url = String(f.url || '').trim();
    if (url && !ADRESA_SKRIPTU.test(url)) throw new Error('Adresa má mít tvar https://script.google.com/macros/s/…/exec (zkopíruj ji z Nasadit → Spravovat nasazení).');
    await ctx.store.nastav('banka_skript_url', url);
    ctx.zprava(url ? 'Adresa skriptu uložena.' : 'Adresa skriptu smazána.');
  },
  'banka.kopirovatSkript': async (ctx) => {
    const r = await fetch('apps-script/Banka.gs', { cache: 'no-cache' });
    if (!r.ok) throw new Error('Kód skriptu se nepodařilo načíst (jsi online?).');
    await navigator.clipboard.writeText(await r.text());
    ctx.zprava('Kód skriptu je ve schránce. Vlož ho v tabulce do Rozšíření → Apps Script.');
    return false;
  }
};

export default {
  id: 'banka',
  nazev: 'Napojení na banku',
  popis: 'Automatické stahování zůstatků a plateb z banky (Enable Banking). Platby jen potvrdíš.',
  ikona: 'obnovit',
  vychozi: false,
  tabulky: ['banka_ucty', 'banka_pohyby'],
  zapis: [{ id: 'banka', nazev: 'Z banky', poradi: 50, render: zapis }],
  karty,
  akce
};
