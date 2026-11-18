/* Průvodce pro nového uživatele: úvod → přihlášení → výběr modulů (založí tabulku) → kde máš peníze → základní čísla → zámek. */
import { html, ikona } from './html.js';
import { precti, TYPY_UCTU, cislo } from './texty.js';
import { MODULY, PRIPRAVUJEME, vychoziModuly, tabulkyProModuly } from './moduly/registr.js';
import { SheetsUloziste } from './uloziste/sheets.js';
import { NASTAVENI } from './config.js';
import { renderKontroly } from './kontrola.js';
import { doplnky } from './doplnky.js';
import * as auth from './auth.js';

const P = { krok: 'uvod', moduly: null, ucty: null };
export const pruvodceStav = P;

function kroky(aktivni) {
  const k = [['moduly', 'Moduly'], ['penize', 'Kde máš peníze'], ['zaklad', 'Základní čísla'], ['zamek', 'Hotovo']];
  const i = k.findIndex((x) => x[0] === aktivni);
  return html`<ol class="kroky" aria-label="Postup">${k.map(([id, n], j) => html`<li class="${j < i ? 'hotovo' : j === i ? 'ted' : ''}" ${j === i ? html`aria-current="step"` : ''}>${n}</li>`)}</ol>
    ${auth.tokenPlatny() ? html`<div class="ucet-lista"><span class="muted small">Přihlášen: ${auth.email() || 'Google účet'}</span><button type="button" class="linkbtn" data-akce="app.odhlasit">Odhlásit</button></div>` : ''}`;
}

function uvod() {
  return html`<section class="intro">
    <div class="intro-ikona">${ikona('prehled', 40)}</div>
    <h1>Finance domácnosti</h1>
    <p class="lead">Přehled o účtech, útratách a pravidelných platbách na mobilu i na počítači.</p>
    <ul class="means">
      <li><b>Data máš jen ty</b> – ukládají se do Google tabulky na tvém Disku. Aplikace nemá žádný vlastní server ani databázi.</li>
      <li><b>Vidí jen svou tabulku.</b> Oprávnění Googlu dovolí aplikaci pracovat jen se soubory, které sama založí – ostatní soubory na Disku nevidí.</li>
      <li><b>Vybereš si, co chceš sledovat</b> – účty, útraty, trvalé platby, později investice, hypotéku a další.</li>
      <li><b>Co zatím neumí:</b> napojení na banku přijde v další verzi. Zatím se vše zadává ručně.</li>
    </ul>
    <button type="button" class="wide" data-akce="pruvodce.prihlasit">Přihlásit přes Google</button>
    <button type="button" class="linkbtn center prihlasit-jinak" data-akce="app.prihlasitJinak">Nejde přihlášení? Přihlásit jinak</button>
    <button type="button" class="wide btn2" data-akce="pruvodce.ukazka">Vyzkoušet s ukázkovými daty</button>
    <p class="muted small">Ukázka běží bez přihlášení se smyšlenými daty a nic se neukládá.</p>
  </section>`;
}

function moduly() {
  const vybrane = P.moduly || vychoziModuly();
  return html`${kroky('moduly')}<form class="card" data-akce="pruvodce.moduly">
    <h2>Co chceš sledovat?</h2>
    <p class="muted small">Vybrat můžeš i později v Nastavení. Pro každý zvolený modul vznikne v tabulce list.</p>
    <div class="tiles">${MODULY.map((m) => html`<label class="tile"><input type="checkbox" name="m_${m.id}" ${vybrane.includes(m.id) ? 'checked' : ''}>
      <span class="tile-ikona">${ikona(m.ikona)}</span><span><b>${m.nazev}</b><span class="s">${m.popis}</span></span></label>`)}
      ${PRIPRAVUJEME.map((m) => html`<div class="tile off" aria-disabled="true"><span class="tile-ikona">${ikona('plany')}</span>
        <span><b>${m.nazev}</b><span class="s">${m.popis}</span><span class="st st-dopln">připravujeme</span></span></div>`)}</div>
    <div class="formbar"><span class="muted small">Založí se tabulka „${NASTAVENI.nazevTabulky}“ na tvém Google Disku.</span><button type="submit">Založit tabulku a pokračovat</button></div>
  </form>`;
}

function zaklad(app) {
  const m = app.store.config.moduly || [];
  const existujici = (app.store.data.ucty || []).filter((u) => u.aktivni !== false && u.id);
  if (!P.ucty) P.ucty = existujici.length ? [] : [{ banka: '', nazev: 'Běžný účet', typ: 'bezny', zustatek: '' }, { banka: '', nazev: 'Spořicí účet', typ: 'sporici', zustatek: '' }];
  return html`${kroky('zaklad')}<form class="card" data-akce="pruvodce.zaklad" autocomplete="off">
    <h2>Základní čísla</h2>
    <p class="muted small">Všechno můžeš přeskočit a doplnit později.</p>
    ${m.includes('utraty') ? html`<h3>Výplata</h3><div class="form">
      <div class="field"><label for="gDen">Den výplaty v měsíci</label><input id="gDen" name="vyplata_den" inputmode="numeric" value="${app.store.config.vyplata_den || ''}" placeholder="např. 15"></div>
      <div class="field"><label for="gVyp">Čistá výplata (odhad)</label><input id="gVyp" name="vyplata_castka" inputmode="decimal" value="${cislo(app.store.config.vyplata_castka)}" placeholder="Kč"></div></div>
      <p class="note">Útraty se počítají od výplaty do výplaty. Dokud výplatu v daném měsíci nezapíšeš, počítá se s tímto odhadem.</p>` : ''}
    ${m.includes('ucty') ? html`<h3>Účty</h3>
      ${existujici.length ? html`<div class="form">${existujici.map((u) => html`<div class="field"><label for="gE_${u.id}">${u.banka} – ${u.nazev}: zůstatek dnes</label>
        <input id="gE_${u.id}" name="ex_${u.id}" inputmode="decimal" placeholder="0"></div>`)}</div>` : ''}
      <div class="ucty-zadani">${P.ucty.map((u, i) => html`<div class="form ucet-radek">
        <div class="field"><label for="gB${i}">Banka</label><input id="gB${i}" name="banka_${i}" value="${u.banka}" placeholder="např. Moje banka"></div>
        <div class="field"><label for="gN${i}">Název</label><input id="gN${i}" name="nazev_${i}" value="${u.nazev}"></div>
        <div class="field"><label for="gT${i}">Typ</label><select id="gT${i}" name="typ_${i}">${TYPY_UCTU.map((t) => html`<option value="${t.id}" ${t.id === u.typ ? 'selected' : ''}>${t.nazev}</option>`)}</select></div>
        <div class="field"><label for="gZ${i}">Zůstatek dnes</label><input id="gZ${i}" name="zustatek_${i}" inputmode="decimal" value="${u.zustatek}" placeholder="0"></div>
      </div>`)}</div>
      <button type="button" class="btn2 slim" data-akce="pruvodce.dalsiUcet">+ ${existujici.length ? 'Přidat účet' : 'Další účet'}</button>
      <p class="note">Řádky bez banky se přeskočí. Výplata se bude počítat na první běžný účet a převody „na spořicí“ na první spořicí – změníš v Nastavení.
        Hodnoty investic, stavebka a dalších produktů doplníš po dokončení v Zápis → Stavy.</p>` : ''}
    <div class="formbar"><button type="button" class="btn2" data-akce="pruvodce.preskocit">Přeskočit</button><button type="submit">Uložit a pokračovat</button></div>
  </form>`;
}

function zamek(app) {
  return html`${kroky('zamek')}<section class="card">
    <h2>Hotovo</h2>
    <p>Tabulka je založená. Najdeš ji na svém Google Disku pod názvem „${app.store.nazev || NASTAVENI.nazevTabulky}“.</p>
    <div id="zamekNabidka">${app.zamekPodporovan ? html`<p class="muted">Chceš aplikaci zamykat otiskem prstu, obličejem nebo PINem zařízení (na PC Windows Hello)?</p>
      <button type="button" class="btn2" data-akce="pruvodce.zamek">Zapnout zámek</button>` : ''}</div>
    <h3>Instalace na plochu</h3>
    <ul class="means small">
      <li><b>Android (Chrome):</b> menu ⋮ → Přidat na plochu / Instalovat aplikaci.</li>
      <li><b>iPhone (Safari):</b> tlačítko Sdílet → Přidat na plochu.</li>
      <li><b>Windows (Chrome / Edge):</b> ikona instalace vpravo v adresním řádku.</li>
    </ul>
    <div class="formbar"><span></span><button type="button" data-akce="pruvodce.dokoncit">Otevřít aplikaci</button></div>
  </section>`;
}

export function renderPruvodce(app) {
  if (P.krok === 'moduly') return moduly();
  if (P.krok === 'penize') return html`${kroky('penize')}${doplnky.import ? html`<section class="card c-purple"><h2>Máš data ve staré tabulce?</h2>
      <p class="muted small">Převedu je sem – stará tabulka se jen přečte. Pak tenhle a další krok můžeš přeskočit.</p>
      <div class="hbtns"><button type="button" data-akce="pruvodce.import">Importovat ze staré tabulky</button></div></section>` : ''}
    ${renderKontroly(app.store, 'pruvodce')}`;
  if (P.krok === 'import' && doplnky.import) return html`${kroky('penize')}${doplnky.import.renderImport(app, 'pruvodce')}`;
  if (P.krok === 'zaklad') return zaklad(app);
  if (P.krok === 'zamek') return zamek(app);
  return uvod();
}

function prectiUcty(f) {
  const out = [];
  for (let i = 0; i < P.ucty.length; i++) out.push({ banka: (f['banka_' + i] || '').trim(), nazev: (f['nazev_' + i] || '').trim(), typ: f['typ_' + i] || 'bezny', zustatek: f['zustatek_' + i] || '' });
  return out;
}

export const pruvodceAkce = {
  'pruvodce.ukazka': (ctx, el, f, app) => app.spustUkazku(),
  'pruvodce.prihlasit': async (ctx, el, f, app) => {
    await auth.prihlasit();
    await app.pripojTabulku();
  },
  'pruvodce.moduly': async (ctx, el, f, app) => {
    const ids = MODULY.filter((m) => f['m_' + m.id]).map((m) => m.id);
    if (!ids.length) throw new Error('Vyber aspoň jeden modul.');
    P.moduly = ids;
    app.zprava('Zakládám tabulku na tvém Disku…');
    const u = await SheetsUloziste.zaloz(auth.token, NASTAVENI.nazevTabulky, tabulkyProModuly(ids));
    await u.nastavVice({ moduly: ids });
    auth.LS.set('sheet', u.id);
    await u.nacti();
    app.store = u;
    P.krok = 'penize';
    app.zprava('Tabulka založena.');
  },
  'pruvodce.dalsiUcet': (ctx, el, f, app) => {
    const form = el.closest('form');
    P.ucty = prectiUcty(Object.fromEntries(new FormData(form)));
    P.ucty.push({ banka: P.ucty.length ? P.ucty[P.ucty.length - 1].banka : '', nazev: '', typ: 'bezny', zustatek: '' });
  },
  'pruvodce.zaklad': async (ctx, el, f, app) => {
    const s = app.store, m = s.config.moduly || [];
    const cfg = {};
    if (m.includes('utraty')) {
      const den = f.vyplata_den.trim() === '' ? null : Number(f.vyplata_den);
      if (den !== null && !(den >= 1 && den <= 31 && Number.isInteger(den))) throw new Error('Den výplaty musí být číslo 1–31.');
      const vyp = precti(f.vyplata_castka);
      if (vyp !== null && isNaN(vyp)) throw new Error('Výplata musí být číslo.');
      if (den) cfg.vyplata_den = den;
      if (vyp !== null) cfg.vyplata_castka = vyp;
    }
    if (m.includes('ucty')) {
      const radky = prectiUcty(f).filter((u) => u.banka);
      for (const u of radky) { const z = precti(u.zustatek); if (z !== null && isNaN(z)) throw new Error('Zůstatek u „' + u.nazev + '“ není číslo.'); }
      const puvodni = (s.data.ucty || []).filter((u) => u.aktivni !== false && u.id);
      const stavy = [];
      for (const u of puvodni) {
        const z = precti(f['ex_' + u.id]);
        if (z !== null && isNaN(z)) throw new Error('Zůstatek u „' + u.banka + ' – ' + u.nazev + '“ není číslo.');
        if (z !== null) stavy.push({ datum: app.dnes, ucet_id: u.id, zustatek: z, zdroj: 'ručně' });
      }
      const zalozene = puvodni.concat(await s.pridejVice('ucty', radky.map((u, i) => ({ banka: u.banka, nazev: u.nazev || 'Účet', typ: u.typ, napojeni: 'rucne', poradi: puvodni.length + i + 1, aktivni: true }))));
      radky.unshift(...puvodni.map(() => ({ zustatek: '' })));
      zalozene.forEach((u, i) => { const z = precti(radky[i].zustatek); if (z !== null) stavy.push({ datum: app.dnes, ucet_id: u.id, zustatek: z, zdroj: 'ručně' }); });
      if (stavy.length) await s.pridejVice('stavy', stavy);
      const bezny = zalozene.find((u) => u.typ === 'bezny'), sporici = zalozene.find((u) => u.typ === 'sporici');
      if (bezny && !s.config.ucet_vyplaty) cfg.ucet_vyplaty = bezny.id;
      if (sporici && !s.config.ucet_sporici) cfg.ucet_sporici = sporici.id;
    }
    if (Object.keys(cfg).length) await s.nastavVice(cfg);
    P.krok = 'zamek';
  },
  'pruvodce.preskocit': () => { P.krok = 'zamek'; },
  'pruvodce.import': () => { P.krok = 'import'; },
  'pruvodce.zamek': async (ctx, el, f, app) => {
    await auth.zamekZapnout();
    app.zprava('Zámek je zapnutý.');
    app.zamekPodporovan = false;
  },
  'pruvodce.dokoncit': async (ctx, el, f, app) => {
    await app.store.nastav('dokonceno', true);
    P.krok = 'uvod';
    app.spust();
  }
};
