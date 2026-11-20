/* Obrazovka „Kde máš peníze?“: volný text → rozpoznané banky a produkty → založení účtů a produktů. Používá ji průvodce i Nastavení. */
import { html } from './html.js';
import { zkontroluj, potvrd, PRODUKT_NAZEV } from './vypocty/katalog.js';
import { MODULY, tabulkyProModuly } from './moduly/registr.js';

let katalog = null;
export async function nactiKatalog() {
  if (katalog) return katalog;
  const r = await fetch('data/katalog.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('Katalog institucí se nepodařilo načíst.');
  katalog = await r.json();
  return katalog;
}

export const kontrolaStav = { text: '', vysledky: null };
const nazevModulu = (id) => (MODULY.find((m) => m.id === id) || { nazev: id }).nazev;

/** Existuje už v tabulce položka, kterou by výsledek založil? */
function existuje(store, r) {
  const jm = (r.jistota === 'jiste' && r.instituce ? r.instituce.nazev : r.vstup).toLowerCase();
  const d = (t) => (store && store.data[t]) || [];
  switch (r.modul) {
    case 'ucty': return d('ucty').some((u) => (u.banka || '').toLowerCase() === jm && u.typ === (r.produkt === 'sporici' ? 'sporici' : 'bezny'));
    case 'investice': return d('investice').some((u) => (u.instituce || '').toLowerCase() === jm);
    case 'stavebko': return d('stavebko').some((u) => (u.instituce || '').toLowerCase() === jm);
    case 'pojisteni': return d('pojisteni').some((u) => (u.pojistovna || '').toLowerCase() === jm);
    case 'hypoteka': return d('hypoteka').some((u) => (u.banka || '').toLowerCase() === jm);
    case 'dluhopis': return d('dluhopisy').some((u) => (u.emitent || '').toLowerCase() === jm);
    default: return false;
  }
}

export function renderKontroly(store, kde) {
  const S = kontrolaStav;
  return html`<form class="card c-blue" data-akce="kontrola.zkontroluj" autocomplete="off">
    <h2>Kde máš peníze?</h2>
    <p class="muted small">Napiš banky a produkty tak, jak jim říkáš – oddělené čárkou. Třeba „Spořitelna, Raiffka spořicí, J&amp;T fondy, NN životko, stavebko, hypotéka“.</p>
    <div class="field"><label for="kText">Banky a produkty</label><textarea id="kText" name="text" rows="3" placeholder="Spořitelna, Raiffka, ČS fondy…">${S.text}</textarea></div>
    <div class="formbar"><span></span><button type="submit">Zkontrolovat</button></div>
  </form>
  ${S.vysledky ? html`<form class="card" data-akce="kontrola.zalozit" data-kde="${kde}">
    <h2>Výsledek</h2>
    <div class="kvysledky">${S.vysledky.map((r, i) => {
      const inst = r.jistota === 'jiste' ? r.instituce : null;
      const uz = existuje(store, r);
      return html`<div class="kvys">
        <div class="ktelo">
          <div><b>${inst ? inst.nazev : r.nazevVstupu ? r.vstup : PRODUKT_NAZEV[r.produkt]}</b> <span class="muted small">· ${PRODUKT_NAZEV[r.produkt]}</span>${inst && inst.nazev.toLowerCase() !== r.vstup.toLowerCase() ? html` <span class="muted small">(„${r.vstup}“)</span>` : ''}</div>
          ${r.vysvetleni ? html`<div class="note">${r.vysvetleni}</div>` : ''}
          ${r.jistota === 'nejiste' ? html`<div class="kotazka">Myslíš <b>${r.instituce.nazev}</b>?
            <button type="button" class="btn2 slim" data-akce="kontrola.potvrd" data-i="${i}" data-ano="1">Ano</button>
            <button type="button" class="btn2 slim" data-akce="kontrola.potvrd" data-i="${i}" data-ano="">Ne</button></div>` : ''}
          ${r.modul ? (uz ? html`<div class="muted small">už máš v aplikaci</div>`
            : html`<label class="check"><input type="checkbox" name="z_${i}" checked> Založit (${nazevModulu(r.modul)})</label>`) : ''}
        </div></div>`;
    })}</div>
    <div class="vysvetleni small">Čísla (zůstatky, hodnoty) doplníš v dalším kroku nebo později v <b>Zápis → Stavy</b>. Všechno se zadává ručně.</div>
    <div class="formbar">${kde === 'pruvodce' ? html`<button type="button" class="btn2" data-akce="kontrola.preskocit">Přeskočit</button>` : html`<button type="button" class="btn2" data-akce="kontrola.zavrit">Zavřít</button>`}
      <button type="submit">Založit vybrané</button></div>
  </form>` : (kde === 'pruvodce' ? html`<div class="formbar"><span></span><button type="button" class="btn2" data-akce="kontrola.preskocit">Přeskočit</button></div>` : html`<div class="center"><button type="button" class="btn2" data-akce="kontrola.zavrit">Zavřít</button></div>`)}`;
}

/** Záznam, který se pro výsledek založí. */
function zaznamPro(r) {
  const inst = r.jistota === 'jiste' ? r.instituce : null;
  const jm = inst ? inst.nazev : r.nazevVstupu ? r.vstup.trim() : '';
  switch (r.modul) {
    case 'ucty': return ['ucty', { banka: jm, nazev: r.produkt === 'sporici' ? 'Spořicí účet' : 'Běžný účet', typ: r.produkt === 'sporici' ? 'sporici' : 'bezny', napojeni: 'rucne', aktivni: true }];
    case 'investice': return ['investice', { nazev: r.produkt === 'penzijni' ? 'Penzijní spoření' : 'Fondy', instituce: jm, aktivni: true }];
    case 'stavebko': return ['stavebko', { nazev: 'Stavební spoření', instituce: jm, aktivni: true }];
    case 'pojisteni': return ['pojisteni', { nazev: 'Životní pojištění', pojistovna: jm, aktivni: true }];
    case 'hypoteka': return ['hypoteka', { nazev: 'Hypotéka', banka: jm, aktivni: true }];
    case 'dluhopis': return ['dluhopisy', { nazev: r.nazevVstupu ? r.vstup.trim() : 'Dluhopis', emitent: jm, aktivni: true }];
    default: return null;
  }
}

/** Akce. store se bere z aplikace (v průvodci ještě není kontext s moduly). */
export const kontrolaAkce = {
  'kontrola.zkontroluj': async (ctx, el, f) => {
    const K = await nactiKatalog();
    kontrolaStav.text = f.text;
    kontrolaStav.vysledky = zkontroluj(K, f.text);
    if (!kontrolaStav.vysledky.length) throw new Error('Napiš aspoň jednu banku nebo produkt.');
  },
  'kontrola.potvrd': (ctx, el) => {
    const i = Number(el.dataset.i);
    kontrolaStav.vysledky[i] = potvrd(kontrolaStav.vysledky[i], !!el.dataset.ano);
  },
  'kontrola.zalozit': async (ctx, el, f, app) => {
    const store = app.store;
    const vybrane = (kontrolaStav.vysledky || []).filter((r, i) => f['z_' + i] && r.modul && !existuje(store, r));
    if (!vybrane.length) throw new Error('Není vybráno nic k založení.');
    const zapnute = Array.isArray(store.config.moduly) ? store.config.moduly : [];
    const chybi = [...new Set(vybrane.map((r) => r.modul))].filter((m) => !zapnute.includes(m));
    if (chybi.length) {
      if (!window.confirm('Zapnu moduly: ' + chybi.map(nazevModulu).join(', ') + '. Do tabulky se přidají jejich listy, nic stávajícího se nezmění. Pokračovat?')) return false;
      const ids = [...zapnute, ...chybi];
      await store.zajistiSchema(tabulkyProModuly(ids));
      await store.nastav('moduly', ids);
    }
    const podleTab = new Map();
    for (const r of vybrane) {
      const z = zaznamPro(r);
      if (!z) continue;
      if (!podleTab.has(z[0])) podleTab.set(z[0], []);
      podleTab.get(z[0]).push(z[1]);
    }
    let n = 0;
    for (const [tab, radky] of podleTab) {
      if (tab === 'ucty') { const p = (store.data.ucty || []).length; radky.forEach((u, i) => { u.poradi = p + i + 1; }); }
      await store.pridejVice(tab, radky);
      n += radky.length;
    }
    app.zprava('Založeno ' + n + (n === 1 ? ' položka' : n < 5 ? ' položky' : ' položek') + '. Čísla doplníš v dalším kroku nebo v Zápis → Stavy.');
    kontrolaStav.text = ''; kontrolaStav.vysledky = null;
    if (el.dataset.kde === 'pruvodce') app.pruvodceDalsi('zaklad');
    else { ctx.ui.kontrola = false; ctx.prejdi('ucty'); }
  },
  'kontrola.preskocit': (ctx, el, f, app) => { kontrolaStav.text = ''; kontrolaStav.vysledky = null; app.pruvodceDalsi('zaklad'); },
  'kontrola.zavrit': (ctx) => { kontrolaStav.text = ''; kontrolaStav.vysledky = null; ctx.ui.kontrola = false; }
};
