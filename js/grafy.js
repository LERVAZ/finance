/* Grafy (Chart.js 4.4.1, načte se až při prvním grafu). Vzhled převzatý ze staré verze. */
import { kc, pct, LOCALE } from './texty.js';

let nacitani = null;
export function nactiChart() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!nacitani) nacitani = new Promise((ok, chyba) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = () => ok(window.Chart);
    s.onerror = () => { nacitani = null; chyba(new Error('Grafy se nepodařilo načíst (bez internetu?).')); };
    document.head.appendChild(s);
  });
  return nacitani;
}

export const cv = (n) => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
export const PALETA = () => [cv('c-blue'), cv('c-teal'), cv('c-green'), cv('c-purple'), cv('c-amber'), cv('c-red'), '#E879A6', '#8FA3B8'];
const nf = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
export const tickKc = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) + ' mil.' : nf.format(v / 1000) + ' tis.');
export const tickPct = (v) => (v * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) + ' %';

let grafy = [];
export function znicGrafy() { grafy.forEach((g) => g.destroy()); grafy = []; }

function zaklad(C) {
  C.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
  C.defaults.color = cv('muted');
  C.defaults.borderColor = cv('line');
}
const stredText = {
  id: 'stredText',
  afterDraw(ch) {
    const t = ch.options.plugins.stredText; if (!t) return;
    const a = ch.chartArea, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2, c = ch.ctx;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = cv('muted'); c.font = "12px 'IBM Plex Sans', sans-serif"; c.fillText(t.popis, x, y - 11);
    c.fillStyle = cv('ink'); c.font = "500 15px 'IBM Plex Mono', monospace"; c.fillText(t.hodnota, x, y + 9);
    c.restore();
  }
};

/** Koláč. polozky: [{ nazev, hodnota, barva? }] */
export function kolac(C, el, polozky, popis) {
  zaklad(C);
  const p = PALETA();
  const celkem = polozky.reduce((s, x) => s + x.hodnota, 0);
  grafy.push(new C(el, {
    type: 'doughnut', plugins: [stredText],
    data: { labels: polozky.map((x) => x.nazev), datasets: [{ data: polozky.map((x) => x.hodnota), backgroundColor: polozky.map((x, i) => x.barva || p[i % p.length]),
      borderColor: cv('card'), borderWidth: 2, hoverOffset: 6 }] },
    options: { maintainAspectRatio: false, cutout: '64%', layout: { padding: 4 },
      plugins: { stredText: { popis, hodnota: kc(celkem) },
        legend: { position: el.parentNode.clientWidth < 420 ? 'bottom' : 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 8, font: { size: 12 } } },
        tooltip: { callbacks: { label: (c) => c.label + ': ' + kc(c.raw) + ' (' + Math.round(c.raw / celkem * 100) + ' %)' } } } }
  }));
}

/** Čárový graf. rady: [{ nazev, data: [...], barva, carkovane?, vypln? }], format: 'kc' | 'pct' */
export function cary(C, el, popisky, rady, format = 'kc') {
  zaklad(C);
  const f = format === 'pct' ? (v) => pct(v, 1) : kc;
  grafy.push(new C(el, {
    type: 'line',
    data: { labels: popisky, datasets: rady.map((r) => ({ label: r.nazev, data: r.data, borderColor: r.barva, backgroundColor: r.vypln ? cv('accent-soft') : r.barva,
      fill: !!r.vypln, pointRadius: popisky.length > 30 ? 0 : 2, borderWidth: 2, tension: 0, spanGaps: true, borderDash: r.carkovane ? [5, 4] : undefined })) },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: rady.length > 1, position: 'bottom', labels: { boxWidth: 12 } },
        tooltip: { callbacks: { label: (c) => (rady.length > 1 ? c.dataset.label + ': ' : '') + f(c.raw) } } },
      scales: { y: { grid: { color: cv('line') }, ticks: { callback: format === 'pct' ? tickPct : tickKc } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } }
  }));
}

/** Sloupcový graf. rady: [{ nazev, data, barva | barvy }], skladany: true = na sobě */
export function sloupce(C, el, popisky, rady, { format = 'kc', skladany = false } = {}) {
  zaklad(C);
  const f = format === 'pct' ? (v) => pct(v, 2, true) : kc;
  grafy.push(new C(el, {
    type: 'bar',
    data: { labels: popisky, datasets: rady.map((r) => ({ label: r.nazev, data: r.data, backgroundColor: r.barvy || r.barva, borderRadius: 3, stack: skladany ? 's' : undefined })) },
    options: { maintainAspectRatio: false,
      plugins: { legend: { display: rady.length > 1, position: 'bottom', labels: { boxWidth: 10 } },
        tooltip: { callbacks: { label: (c) => (rady.length > 1 ? c.dataset.label + ': ' : '') + f(c.raw) } } },
      scales: { x: { stacked: skladany, grid: { display: false }, ticks: { maxTicksLimit: 12 } },
        y: { stacked: skladany, grid: { color: cv('line') }, ticks: { callback: format === 'pct' ? tickPct : tickKc } } } }
  }));
}
