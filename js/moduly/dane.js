/* Modul Daňové odpočty: odhad vratky (úroky z hypotéky, penzijní spoření, životní pojištění).
   Limity a sazby jsou v nastavení uživatele (_config.dane_parametry) s rokem platnosti. */
import { html, karta } from '../html.js';
import { kc, cislo, precti } from '../texty.js';
import { odhadVratky, parametryDani, DANE_VYCHOZI } from '../vypocty/produkty.js';
import { hypoteky, vypocet } from './hypoteka.js';
import { souhrny as pojisteni } from './pojisteni.js';

/** Úroky z hypoték za kalendářní rok: simulované měsíce + odhad za měsíce před posledním zápisem zůstatku. */
function urokyZaRok(ctx, rok) {
  let celkem = 0;
  for (const h of ctx.zapnuto('hypoteka') ? hypoteky(ctx) : []) {
    const r = vypocet(ctx, h);
    const simul = r.A.urokyRoky ? r.A.urokyRoky[rok] || 0 : 0;
    const kMesic = (h.k_datu || ctx.dnes).slice(0, 7);
    const predtim = kMesic.slice(0, 4) === String(rok) ? Number(kMesic.slice(5, 7)) : kMesic.slice(0, 4) > String(rok) ? 12 : 0;
    celkem += simul + predtim * (Number(h.zustatek) || 0) * (Number(h.sazba) || 0) / 100 / 12;
  }
  return celkem;
}

function odhad(ctx) {
  const rok = Number(ctx.dnes.slice(0, 4));
  const zivotni = ctx.zapnuto('pojisteni') ? pojisteni(ctx).filter((p) => p.danovy_odpocet).reduce((t, p) => t + (Number(p.investicni_cast) || 0) * 12, 0) : 0;
  return odhadVratky({ parametry: ctx.cfg.dane_parametry, rok, urokyHypoteky: urokyZaRok(ctx, rok), zivotni, penzijni: Number(ctx.cfg.dane_penzijni_rocne) || 0 });
}

function vyhled(ctx) {
  const d = odhad(ctx);
  const P = d.parametry;
  const rok = ctx.dnes.slice(0, 4);
  return [{ poradi: 60, html: html`${karta('purple', 'Daňové odpočty ' + rok + ' – odhad vratky', html`
    <div class="big num pos">${kc(d.vratka)}</div>
    <div class="kv">
      <div><span class="muted">Úroky z hypotéky (limit ${kc(P.limit_uroky)})</span><span class="num">${kc(d.uroky)} → ${kc(d.vratkaUroky)}</span></div>
      <div><span class="muted">Penzijní a životní (limit ${kc(P.limit_penzijni_zivotni)})</span><span class="num">${kc(d.ostatni)} → ${kc(d.vratkaOstatni)}</span></div>
    </div>
    <div class="note">Sazba daně ${P.sazba_pct} % · parametry pro rok ${P.rok}. Úroky jsou odhad ze zůstatku a sazby hypotéky. Životní pojištění se počítá jen s odpočtem a jen investiční částí.</div>
    <form class="form" data-akce="dane.ulozit" autocomplete="off">
      <div class="field"><label for="dPenz">Penzijní spoření – moje příspěvky ročně</label><input id="dPenz" name="penzijni" inputmode="decimal" value="${cislo(ctx.cfg.dane_penzijni_rocne)}" placeholder="0"></div>
      <div class="field"><label for="dSaz">Sazba daně (%)</label><input id="dSaz" name="sazba_pct" inputmode="decimal" value="${P.sazba_pct}"></div>
      <div class="field"><label for="dLu">Limit úroků</label><input id="dLu" name="limit_uroky" inputmode="decimal" value="${cislo(P.limit_uroky)}"></div>
      <div class="field"><label for="dLp">Limit penzijní + životní</label><input id="dLp" name="limit_penzijni_zivotni" inputmode="decimal" value="${cislo(P.limit_penzijni_zivotni)}"></div>
      <div class="field"><label for="dPn">Penzijní: odečitatelné nad</label><input id="dPn" name="penzijni_nad" inputmode="decimal" value="${cislo(P.penzijni_nad)}"></div>
      <div class="field"><label for="dRok">Platí od roku</label><input id="dRok" name="rok" inputmode="numeric" value="${rok}"></div>
      <button type="submit" class="btn2">Uložit parametry</button>
    </form>`)}` }];
}

export default {
  id: 'dane',
  nazev: 'Daňové odpočty',
  popis: 'Odhad vratky daně: úroky z hypotéky, penzijko, životko. Limity podle roku.',
  ikona: 'plany',
  tabulky: [],
  vyhled,
  akce: {
    'dane.ulozit': async (ctx, el, f) => {
      const cisla = {};
      for (const k of ['sazba_pct', 'limit_uroky', 'limit_penzijni_zivotni', 'penzijni_nad', 'penzijni', 'rok']) {
        const v = precti(f[k]);
        if (v === null || isNaN(v)) throw new Error('Vyplň všechna čísla.');
        cisla[k] = v;
      }
      const vse = { ...(ctx.cfg.dane_parametry && typeof ctx.cfg.dane_parametry === 'object' ? ctx.cfg.dane_parametry : DANE_VYCHOZI) };
      vse[cisla.rok] = { sazba_pct: cisla.sazba_pct, limit_uroky: cisla.limit_uroky, limit_penzijni_zivotni: cisla.limit_penzijni_zivotni, penzijni_nad: cisla.penzijni_nad };
      await ctx.store.nastavVice({ dane_parametry: vse, dane_penzijni_rocne: cisla.penzijni });
      ctx.zprava('Parametry uloženy pro rok ' + cisla.rok + '.');
    }
  }
};
export { parametryDani };
