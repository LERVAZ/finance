/* Modul Účty: běžné a spořicí účty, historie zůstatků. */
import { html, karta, radek, trida } from '../html.js';
import { kc, sk, pct, datum, TYPY_UCTU } from '../texty.js';
import { tokUctu } from '../vypocty/ucty.js';

const typNazev = (t) => (TYPY_UCTU.find((x) => x.id === t) || { nazev: t || 'Účet' }).nazev;

const editorUctu = {
  nadpisNovy: 'Nový účet', nadpis: 'Upravit účet', barva: 'blue', mazani: 'skryt',
  pole: [
    { n: 'banka', l: 'Banka', typ: 'text', povinne: true, placeholder: 'např. Moje banka' },
    { n: 'nazev', l: 'Název účtu', typ: 'text', povinne: true, placeholder: 'např. Běžný účet' },
    { n: 'typ', l: 'Typ', typ: 'select', moznosti: () => TYPY_UCTU.map((t) => [t.id, t.nazev]), vychozi: () => 'bezny' },
    { n: 'urok_pa', l: 'Úrok ročně', typ: 'procenta', placeholder: 'jen u spořicích' },
    { n: 'zustatek', l: 'Zůstatek dnes', typ: 'castka', docasne: true, placeholder: '0' },
    { n: 'poznamka', l: 'Poznámka', typ: 'text' }
  ],
  poUlozeni: async (ctx, u, stary, docasne) => {
    if (!stary) {
      if (!u.poradi) await ctx.store.uprav('ucty', u.id, { poradi: ctx.data('ucty').length, napojeni: 'rucne' });
      if (docasne.zustatek !== null && docasne.zustatek !== undefined) await ctx.store.pridej('stavy', { datum: ctx.dnes, ucet_id: u.id, zustatek: docasne.zustatek, zdroj: 'ručně' });
      ctx.ui.banka = u.banka;
    }
  }
};

function polozky(ctx) {
  const trvale = ctx.zapnuto('trvale') ? ctx.data('trvale_platby') : [];
  return ctx.uctyPrehled().map((u) => {
    const detail = [['Stav k', u.k_datu ? datum(u.k_datu) : 'zatím nezadán']];
    if (u.minule !== null) detail.push(['Na konci minulého měsíce', kc(u.minule)]);
    if (u.zmena !== null) detail.push(['Změna tento měsíc', sk(u.zmena), trida(u.zmena)]);
    if (u.typ === 'sporici') {
      detail.push(['Úrok za měsíc po dani (odhad)', '+' + kc(u.vynosMesicne), 'pos']);
      detail.push(['Odhad ke konci měsíce', kc(u.odhadKonecMesice)]);
    }
    const tok = trvale.length ? tokUctu(u.id, trvale) : null;
    // tok z trvalých plateb má smysl u účtů, kam něco pravidelně přichází (u účtu výplaty je přehled v Útratách)
    if (tok && tok.prichazi.length && u.id !== ctx.cfg.ucet_vyplaty) {
      tok.prichazi.forEach((x) => detail.push([x.nazev, '+' + kc(x.castka), 'pos']));
      tok.odchazi.forEach((x) => detail.push([x.nazev, '−' + kc(x.castka)]));
      detail.push(['Měsíčně zůstává', sk(tok.zustava), trida(tok.zustava)]);
    }
    const pod = (typNazev(u.typ) === u.nazev ? (u.typ === 'sporici' ? '' : 'běžný účet') : typNazev(u.typ)) +
      (u.typ === 'sporici' && u.urok_pa ? ' · úrok ' + pct(u.urok_pa / 100, 1) + ' · ke konci měsíce ' + kc(u.odhadKonecMesice) + ' (+' + kc(u.vynosMesicne) + ' úrok)' : '');
    return { id: u.id, banka: u.banka, poradi: 100 + (Number(u.poradi) || 0), nazev: u.nazev, hodnota: u.zustatek || 0, hodnotaText: kc(u.zustatek), pod, detail,
      tlacitka: [{ text: 'Upravit účet', akce: 'editor.otevrit', data: { tab: 'ucty', id: u.id } }, { text: 'Zapsat zůstatek', akce: 'prejdi', data: { tab: 'zapis', sub: 'stavy' } }] };
  });
}

function stavy(ctx) {
  return ctx.uctyPrehled().map((u) => ({
    klic: 'u_' + u.id, skupina: 'Účty', label: u.banka + ' – ' + u.nazev, hodnota: u.zustatek, k_datu: u.k_datu,
    uloz: (v, _b, d) => [{ pridat: 'stavy', radek: { datum: d, ucet_id: u.id, zustatek: v, zdroj: 'ručně' } }]
  }));
}

function karty(ctx) {
  const p = ctx.uctyPrehled();
  if (!p.length) return [];
  const sporici = p.filter((u) => u.typ === 'sporici');
  const bezne = p.filter((u) => u.typ !== 'sporici');
  const out = [];
  const suma = (a) => a.reduce((s, u) => s + (u.zustatek || 0), 0);
  if (sporici.length) out.push({ id: 'sporici', nazev: 'Spořicí účty', barva: 'blue', poradi: 30,
    souhrn: { hodnota: kc(suma(sporici)), pod: sporici.length + (sporici.length === 1 ? ' účet' : sporici.length < 5 ? ' účty' : ' účtů') },
    html: karta('blue', 'Spořicí účty', sporici.map((u) =>
    radek(u.nazev, u.banka + (u.urok_pa ? ' · úrok ' + pct(u.urok_pa / 100, 1) : '') + (u.urok_pa && u.zustatek ? ' · ke konci měsíce ' + kc(u.odhadKonecMesice) : ''), kc(u.zustatek),
      u.urok_pa && u.zustatek ? '+' + kc(u.vynosMesicne) + ' úrok' : '', 'pos')), html`<span class="num">${kc(suma(sporici))}</span>`) });
  if (bezne.length) out.push({ id: 'bezne', nazev: 'Běžné účty', barva: 'teal', poradi: 35,
    souhrn: { hodnota: kc(suma(bezne)), pod: bezne.length + (bezne.length === 1 ? ' účet' : bezne.length < 5 ? ' účty' : ' účtů') },
    html: karta('teal', 'Běžné účty', bezne.map((u) =>
    radek(u.nazev, u.banka, kc(u.zustatek), u.zmena ? sk(u.zmena) + ' tento měsíc' : '', trida(u.zmena))), html`<span class="num">${kc(suma(bezne))}</span>`) });
  return out;
}

export default {
  id: 'ucty',
  nazev: 'Účty',
  popis: 'Běžné a spořicí účty, zůstatky a úrok. Seskupené podle banky.',
  ikona: 'ucty',
  vychozi: true,
  tabulky: ['ucty', 'stavy'],
  polozky, stavy, karty,
  pridat: () => [{ text: 'Účet', akce: 'editor.otevrit', data: { tab: 'ucty' } }],
  editory: { ucty: editorUctu },
  jmeni: (ctx) => ctx.uctyPrehled().map((u) => ({ nazev: u.banka + ' – ' + u.nazev, hodnota: u.zustatek || 0, skupina: u.typ === 'sporici' ? 'Spořicí účty' : 'Běžné účty' })),
  akce: {}
};
