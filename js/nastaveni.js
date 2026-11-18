/* Nastavení: moduly, výplata, účty pro výplatu / spořicí, kategorie, vzhled, zámek, data, odhlášení. */
import { html, karta, ikona } from './html.js';
import { cislo, precti } from './texty.js';
import { MODULY, PRIPRAVUJEME, tabulkyProModuly } from './moduly/registr.js';
import { renderKontroly } from './kontrola.js';
import { doplnky } from './doplnky.js';
import * as auth from './auth.js';
import { VERZE, DATUM_VERZE } from './verze.js';
import { datum } from './texty.js';

export function renderNastaveni(ctx, app) {
  if (ctx.ui.kontrola) return renderKontroly(app.store, 'nastaveni');
  if (ctx.ui.import && doplnky.import) return doplnky.import.renderImport(app, 'nastaveni', ctx);
  const c = ctx.cfg;
  const zapnute = ctx.moduly.map((m) => m.id);
  const ucty = ctx.zapnuto('ucty') ? ctx.data('ucty').filter((u) => u.aktivni !== false) : [];
  const volby = (vyb, filtr) => [html`<option value="">—</option>`, ...ucty.filter(filtr).map((u) => html`<option value="${u.id}" ${u.id === vyb ? 'selected' : ''}>${u.banka} – ${u.nazev}</option>`)];
  const demo = app.store.druh === 'pamet';
  return html`
  ${!demo ? html`<div class="ucet-lista"><span class="small">Přihlášen: <b>${auth.email() || 'Google účet'}</b></span><button type="button" class="btn2 slim" data-akce="app.odhlasit">Odhlásit</button></div>` : ''}
  ${demo ? html`<div class="alert"><b>Ukázkový režim.</b> Data jsou smyšlená a nic se neukládá. <button type="button" class="btn2 slim" data-akce="app.konecUkazky">Ukončit ukázku</button></div>` : ''}
  <form class="card" data-akce="nastaveni.moduly">
    <h2>Moduly</h2>
    <p class="muted small">Vypnutý modul zmizí z aplikace. Jeho list v tabulce i data zůstanou – po zapnutí se vrátí.</p>
    <div class="tiles">${MODULY.map((m) => html`<label class="tile"><input type="checkbox" name="m_${m.id}" ${zapnute.includes(m.id) ? 'checked' : ''}>
      <span class="tile-ikona">${ikona(m.ikona)}</span><span><b>${m.nazev}</b><span class="s">${m.popis}</span></span></label>`)}
      ${PRIPRAVUJEME.map((m) => html`<div class="tile off" aria-disabled="true"><span class="tile-ikona">${ikona('plany')}</span><span><b>${m.nazev}</b><span class="st st-dopln">připravujeme</span></span></div>`)}</div>
    <div class="formbar"><span></span><button type="submit">Uložit moduly</button></div>
  </form>
  ${ctx.zapnuto('utraty') || ucty.length ? html`<form class="card" data-akce="nastaveni.zaklad" autocomplete="off">
    <h2>Výplata a účty</h2>
    <div class="form">
      ${ctx.zapnuto('utraty') ? html`<div class="field"><label for="nDen">Den výplaty</label><input id="nDen" name="vyplata_den" inputmode="numeric" value="${c.vyplata_den || ''}"></div>
      <div class="field"><label for="nVyp">Čistá výplata (odhad)</label><input id="nVyp" name="vyplata_castka" inputmode="decimal" value="${cislo(c.vyplata_castka)}"></div>` : ''}
      ${ucty.length ? html`<div class="field"><label for="nUV">Účet, na který chodí výplata</label><select id="nUV" name="ucet_vyplaty">${volby(c.ucet_vyplaty, (u) => u.typ !== 'sporici')}</select></div>
      <div class="field"><label for="nUS">Spořicí účet pro převody „na spořicí“</label><select id="nUS" name="ucet_sporici">${volby(c.ucet_sporici, (u) => u.typ === 'sporici')}</select></div>` : ''}
    </div>
    <p class="note">Trvalé platby z účtu výplaty se v útratách odečítají od výplaty. Pohyby „na spořicí / ze spořicího“ mění zůstatek vybraného spořicího účtu.</p>
    <div class="formbar"><span></span><button type="submit">Uložit</button></div>
  </form>` : ''}
  ${!demo && doplnky.import ? karta('', 'Import ze staré tabulky', html`<p class="muted small">Jednorázový převod dat ze staré Google tabulky. Stará tabulka se jen čte, nic se v ní nezmění.</p>
    <div class="hbtns"><button type="button" class="btn2" data-akce="import.otevrit">Importovat ze staré tabulky</button></div>`) : ''}
  ${karta('', 'Co jde napojit', html`<p class="muted small">Napiš své banky a produkty a aplikace ti řekne, co půjde stahovat automaticky a co se zadává ručně. Z výsledku rovnou založí účty a produkty.</p>
    <div class="hbtns"><button type="button" class="btn2" data-akce="nastaveni.kontrola">Zkontrolovat banky a produkty</button></div>`)}
  <form class="card" data-akce="nastaveni.kategorie">
    <h2>Kategorie výdajů</h2>
    <div class="field"><label for="nKat">Jedna kategorie na řádek</label><textarea id="nKat" name="kategorie" rows="8">${ctx.kategorie().join('\n')}</textarea></div>
    <div class="formbar"><span></span><button type="submit">Uložit kategorie</button></div>
  </form>
  ${karta('', 'Vzhled a zabezpečení', html`<div class="hbtns">
    <button type="button" class="btn2" data-akce="app.motiv">${app.motiv() === 'dark' ? '☀ Světlý režim' : '☾ Tmavý režim'}</button>
    ${app.zamekPodporovan ? html`<button type="button" class="btn2" data-akce="app.zamek">${auth.zamekZapnuty() ? 'Vypnout zámek' : 'Zapnout zámek otiskem / PINem'}</button>` : html`<span class="muted small">Toto zařízení nepodporuje zámek otiskem ani Windows Hello.</span>`}
  </div>`)}
  ${!demo ? karta('', 'Data a účet Google', html`
    <p class="small">Tabulka: <b>${app.store.nazev || ''}</b>${app.store.odkaz() ? html` · <a href="${app.store.odkaz()}" target="_blank" rel="noopener">otevřít v Google tabulkách</a>` : ''}</p>
    <p class="muted small">Přihlášen: ${auth.email() || '–'}</p>
    <div class="hbtns"><button type="button" class="btn2" data-akce="app.odhlasit">Odhlásit</button></div>
    <p class="note">Do tabulky můžeš nahlížet i psát ručně. Nepřejmenovávej listy a první řádek (hlavičku). Nové sloupce na konci listu aplikace nechá být.</p>`) : ''}
  ${karta('', 'Verze a zálohy', html`
    <p class="small">Verze aplikace <b>${VERZE}</b> z ${datum(DATUM_VERZE)}${app.novaVerze ? html` · <b class="pos">k dispozici je ${app.novaVerze.verze}</b>` : ''}</p>
    <div class="hbtns">${app.novaVerze ? html`<button type="button" data-akce="app.aktualizovat">Aktualizovat na ${app.novaVerze.verze}</button>` : html`<button type="button" class="btn2" data-akce="app.kontrolaVerze">Zkontrolovat aktualizace</button>`}</div>
    ${!demo ? html`<h3>Zálohy tabulky</h3>
    <p class="muted small">Aplikace sama uloží kopii tvé tabulky na Disk při první práci s každou novou verzí a před každou změnou struktury tabulky. Ponechává posledních 10 záloh, starší přesune do koše na Disku (tam jsou ještě 30 dní).</p>
    ${ctx.ui.zalohy ? (ctx.ui.zalohy.length ? html`<div class="mlist">${ctx.ui.zalohy.map((z) => html`<div class="mrow"><span class="d">${new Date(z.createdTime).toLocaleDateString('cs-CZ')}</span>
        <span class="n">${z.name}${z.appProperties && z.appProperties.verze ? html`<span class="note">verze ${z.appProperties.verze}</span>` : ''}</span>
        <a class="btn2 slim" href="https://docs.google.com/spreadsheets/d/${z.id}/edit" target="_blank" rel="noopener">Otevřít</a></div>`)}</div>`
      : html`<p class="muted small">Zatím žádná záloha.</p>`) : ''}
    <div class="hbtns">${ctx.ui.zalohy ? '' : html`<button type="button" class="btn2" data-akce="nastaveni.zalohy">Zobrazit zálohy</button>`}
      <button type="button" class="btn2" data-akce="nastaveni.zalohovat">Zálohovat teď</button></div>
    <p class="note">Návrat k záloze: zálohu otevři a podívej se, jestli je v ní to, co chceš. Napiš mi, a vrátíme ji jako hlavní tabulku.</p>` : ''}`)}
  <p class="muted small center">Finance ${VERZE} · schéma dat v${c.schema_version || '?'}</p>`;
}

export const nastaveniAkce = {
  'nastaveni.kontrola': (ctx) => { ctx.ui.kontrola = true; window.scrollTo(0, 0); },
  'nastaveni.zalohy': async (ctx, el, f, app) => { ctx.ui.zalohy = await app.store.zalohy(); },
  'nastaveni.zalohovat': async (ctx, el, f, app) => {
    await app.store.zalohuj('ručně', VERZE);
    ctx.ui.zalohy = await app.store.zalohy();
    ctx.zprava('Záloha je na tvém Disku.');
  },
  'nastaveni.moduly': async (ctx, el, f, app) => {
    const ids = MODULY.filter((m) => f['m_' + m.id]).map((m) => m.id);
    if (!ids.length) throw new Error('Nech zapnutý aspoň jeden modul.');
    const chybi = tabulkyProModuly(ids).filter((t) => !app.store.maTabulku(t));
    if (chybi.length && !ctx.potvrd('Do tabulky se přidají nové listy: ' + chybi.join(', ') + '. Nic stávajícího se nezmění. Pokračovat?')) return false;
    const zmeny = await app.store.zajistiSchema(tabulkyProModuly(ids));
    await app.store.nastav('moduly', ids);
    ctx.zprava('Moduly uloženy.' + (zmeny.length ? ' Přidáno: ' + zmeny.join('; ') + '.' : ''));
  },
  'nastaveni.zaklad': async (ctx, el, f, app) => {
    const cfg = {};
    if ('vyplata_den' in f) {
      const den = f.vyplata_den.trim() === '' ? null : Number(f.vyplata_den);
      if (den !== null && !(den >= 1 && den <= 31 && Number.isInteger(den))) throw new Error('Den výplaty musí být číslo 1–31.');
      const vyp = precti(f.vyplata_castka);
      if (vyp !== null && isNaN(vyp)) throw new Error('Výplata musí být číslo.');
      cfg.vyplata_den = den; cfg.vyplata_castka = vyp;
    }
    if ('ucet_vyplaty' in f) { cfg.ucet_vyplaty = f.ucet_vyplaty; cfg.ucet_sporici = f.ucet_sporici; }
    await app.store.nastavVice(cfg);
    ctx.zprava('Uloženo.');
  },
  'nastaveni.kategorie': async (ctx, el, f, app) => {
    const k = [...new Set(f.kategorie.split('\n').map((x) => x.trim()).filter(Boolean))];
    if (!k.length) throw new Error('Nech aspoň jednu kategorii.');
    await app.store.nastav('kategorie', k);
    ctx.zprava('Kategorie uloženy.');
  }
};
