/* Skrytá kontrola v prohlížeči (headless Edge/Chrome přes DevTools protokol, žádné okno):
   node tools/snimek.js <prohlizec.exe> <zakladni-url> <vystupni-slozka>
   Pro každý scénář: načte stránku, provede kroky, uloží PNG a vypíše chyby z konzole. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [, , EXE, URL0, VYSTUP, JEN] = process.argv;
const PORT = 9333;
const SCENARE = [
  { jmeno: 'navod-uvod', url: '/', w: 390, h: 760 },
  { jmeno: 'navod-moduly', url: '/?ukazka#prehled', w: 390, h: 760, kroky: ["FINANCE.rezim='pruvodce'; FINANCE.pruvodceDalsi('moduly'); FINANCE.render()", "document.querySelectorAll('.alert').forEach(e=>e.remove()); document.getElementById('hSub').textContent=''"] },
  { jmeno: 'navod-prehled', url: '/?ukazka#prehled', w: 390, h: 760, kroky: ["document.querySelectorAll('.alert').forEach(e=>e.remove()); document.getElementById('hSub').textContent=''"] },
  { jmeno: 'navod-utraty', url: '/?ukazka#utraty', w: 390, h: 760, kroky: ["document.querySelectorAll('.alert').forEach(e=>e.remove()); document.getElementById('hSub').textContent=''"] },
  { jmeno: 'navod-zapis', url: '/?ukazka#zapis', w: 390, h: 760, kroky: ["document.querySelectorAll('.alert').forEach(e=>e.remove()); document.getElementById('hSub').textContent=''"] },
  { jmeno: 'navod-zamek', url: '/?ukazka#nastaveni', w: 390, h: 760, kroky: ["document.querySelectorAll('.alert').forEach(e=>e.remove()); document.getElementById('hSub').textContent=''", "[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('Vzhled')).scrollIntoView({block:'center'})"] },
  { jmeno: 'napoveda-mobil', url: '/?ukazka#nastaveni', w: 390, h: 1400, cekej: 1200, kroky: ["document.querySelector('[data-akce=\"nastaveni.napoveda\"]').click()"] },
  { jmeno: 'uvod-mobil', url: '/', w: 390, h: 844 },
  { jmeno: 'prehled-mobil', url: '/?ukazka#prehled', w: 390, h: 1500 },
  { jmeno: 'ucty-mobil', url: '/?ukazka#ucty', w: 390, h: 1000, kroky: ["document.querySelector('[data-akce=\"ucty.rozbal\"]').click()"] },
  { jmeno: 'utraty-mobil', url: '/?ukazka#utraty', w: 390, h: 2100 },
  { jmeno: 'zapis-mobil', url: '/?ukazka#zapis', w: 390, h: 1400 },
  { jmeno: 'trvale-mobil', url: '/?ukazka#zapis', w: 390, h: 1300, kroky: ["document.querySelector('[data-hodnota=\"trvale\"]').click()"] },
  { jmeno: 'pridani-platby', url: '/?ukazka#zapis', w: 390, h: 1100, kroky: [
    "document.getElementById('pT').value='Na spořicí'; document.getElementById('pT').dispatchEvent(new Event('change',{bubbles:true}))",
    "document.getElementById('pN').value='Test převod'; document.getElementById('pA').value='1 000'; document.querySelector('form[data-akce=\"utraty.pridat\"] button[type=submit]').click()",
    "location.hash='#ucty'; window.FINANCE && (window.FINANCE.ui.tab='ucty'); document.querySelector('[data-akce=\"app.tab\"][data-hodnota=\"ucty\"]').click()"] },
  { jmeno: 'nastaveni-desktop', url: '/?ukazka#nastaveni', w: 1280, h: 1400 },
  { jmeno: 'rozl-uprava-desktop', url: '/?ukazka#prehled', w: 1280, h: 1300, kroky: ["document.querySelector('[data-akce=\"rozl.upravit\"]').click()",
    "(()=>{const d=document.querySelector('.dl[data-id=\"rocni\"] .dl-grip');const r=d.getBoundingClientRect();const o={bubbles:true,pointerType:'mouse',button:0,clientX:r.x+5,clientY:r.y+5};d.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:r.x+400,clientY:r.y+5}));window.dispatchEvent(new PointerEvent('pointerup',o));})()",
    "(()=>{const d=document.querySelector('.dl[data-id=\"stavebko-s1\"], .dl[data-id^=\"stavebko\"]');const c=document.querySelector('.dl[data-id=\"jmeni\"]');const r=d.getBoundingClientRect();const t=c.getBoundingClientRect();const o={bubbles:true,pointerType:'mouse',button:0,clientX:r.x+60,clientY:r.y+60};d.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:r.x+70,clientY:r.y+70}));window.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:t.x+40,clientY:t.y+40}));window.dispatchEvent(new PointerEvent('pointerup',o));})()"] },
  { jmeno: 'rozl-uprava-mobil', url: '/?ukazka#prehled', w: 390, h: 1100, kroky: ["document.querySelector('[data-akce=\"rozl.upravit\"]').click()", "document.querySelector('[data-akce=\"rozl.styl\"][data-hodnota=\"kompaktni\"]').click()"] },
  { jmeno: 'rozl-kompakt-mobil', url: '/?ukazka#prehled', w: 390, h: 1000, kroky: ["document.querySelector('[data-akce=\"rozl.upravit\"]').click()", "document.querySelector('[data-akce=\"rozl.styl\"][data-hodnota=\"kompaktni\"]').click()", "document.querySelector('[data-akce=\"rozl.ulozit\"]').click()"] },
  { jmeno: 'rozl-kompakt-otevrena', url: '/?ukazka#prehled', w: 390, h: 1300, kroky: ["document.querySelector('[data-akce=\"rozl.upravit\"]').click()", "document.querySelector('[data-akce=\"rozl.styl\"][data-hodnota=\"kompaktni\"]').click()", "document.querySelector('[data-akce=\"rozl.ulozit\"]').click()", "document.querySelector('[data-akce=\"rozl.otevrit\"][data-hodnota=\"platby\"]').click()"] },
  { jmeno: 'ucty-seznam-desktop', url: '/?ukazka#ucty', w: 1280, h: 1100 },
  { jmeno: 'ucty-seznam-mobil', url: '/?ukazka#ucty', w: 390, h: 1100, kroky: ["document.querySelector('[data-akce=\"ucty.zobrazeni\"][data-hodnota=\"seznam\"]').click()"] },
  { jmeno: 'ucty-seznam-mobil-detail', url: '/?ukazka#ucty', w: 390, h: 1100, kroky: ["document.querySelector('[data-akce=\"ucty.zobrazeni\"][data-hodnota=\"seznam\"]').click()", "document.querySelectorAll('[data-akce=\"ucty.vyber\"]')[1].click()"] },
  { jmeno: 'ucty-dlazdice-desktop', url: '/?ukazka#ucty', w: 1280, h: 1100, kroky: ["document.querySelector('[data-akce=\"ucty.zobrazeni\"][data-hodnota=\"dlazdice\"]').click()", "document.querySelector('.dgrid [data-akce=\"ucty.rozbal\"]').click()"] },
  { jmeno: 'banky-seznam-desktop', url: '/?ukazka#ucty', w: 1280, h: 1100, kroky: ["(()=>{const m={'Banka Alfa':'Česká spořitelna','Banka Beta':'Raiffeisenbank','Pojišťovna Omega':'NN pojišťovna','Investiční společnost Gama':'J&T Investiční společnost'};const D=FINANCE.store.data;for(const t in D)for(const r of D[t])for(const f of ['banka','instituce','emitent'])if(m[r[f]])r[f]=m[r[f]];FINANCE.render();})()"] },
  { jmeno: 'banky-dlazdice-desktop', url: '/?ukazka#ucty', w: 1280, h: 900, kroky: ["(()=>{const m={'Banka Alfa':'Česká spořitelna','Banka Beta':'Raiffeisenbank','Pojišťovna Omega':'NN pojišťovna','Investiční společnost Gama':'J&T Investiční společnost'};const D=FINANCE.store.data;for(const t in D)for(const r of D[t])for(const f of ['banka','instituce','emitent'])if(m[r[f]])r[f]=m[r[f]];FINANCE.render();})()", "document.querySelector('[data-akce=\\\"ucty.zobrazeni\\\"][data-hodnota=\\\"dlazdice\\\"]').click()"] },
  { jmeno: 'banky-pobankach-mobil', url: '/?ukazka#ucty', w: 390, h: 900, kroky: ["(()=>{const m={'Banka Alfa':'Česká spořitelna','Banka Beta':'Raiffeisenbank','Pojišťovna Omega':'NN pojišťovna','Investiční společnost Gama':'J&T Investiční společnost'};const D=FINANCE.store.data;for(const t in D)for(const r of D[t])for(const f of ['banka','instituce','emitent'])if(m[r[f]])r[f]=m[r[f]];FINANCE.render();})()"] },
  { jmeno: 'dl-utraty-desktop', url: '/?ukazka#utraty', w: 1280, h: 1200 },
  { jmeno: 'dl-utraty-mobil-kompakt', url: '/?ukazka#utraty', w: 390, h: 900, kroky: ["document.querySelector('[data-akce=\"rozl.upravit\"]').click()", "document.querySelector('[data-akce=\"rozl.styl\"][data-hodnota=\"kompaktni\"]').click()", "document.querySelector('[data-akce=\"rozl.ulozit\"]').click()"] },
  { jmeno: 'dl-vyhled-desktop', url: '/?ukazka#plany', w: 1280, h: 1600 },
  { jmeno: 'dl-grafy-desktop', url: '/?ukazka#plany', w: 1280, h: 1500, cekej: 2500, kroky: ["document.querySelector('[data-akce=\"plany.sub\"][data-hodnota=\"grafy\"]').click()"] },
  { jmeno: 'dl-kolace-mobil-kompakt', url: '/?ukazka#plany', w: 390, h: 1100, cekej: 2000, kroky: ["document.querySelector('[data-akce=\"plany.sub\"][data-hodnota=\"kolace\"]').click()", "document.querySelector('[data-akce=\"rozl.upravit\"]').click()", "document.querySelector('[data-akce=\"rozl.styl\"][data-hodnota=\"kompaktni\"]').click()", "document.querySelector('[data-akce=\"rozl.ulozit\"]').click()", "document.querySelector('[data-akce=\"rozl.otevrit\"]').click()"] },
  { jmeno: 'zahlavi-odhlasit', url: '/?ukazka#prehled', w: 1280, h: 300, kroky: ["document.getElementById('btnOdhlasit').hidden = false"] },
  { jmeno: 'prehled-desktop', url: '/?ukazka#prehled', w: 1280, h: 1300 },
  { jmeno: 'utraty-desktop-svetly', url: '/?ukazka#utraty', w: 1280, h: 1300, svetly: true },
  { jmeno: 'vyhled-mobil', url: '/?ukazka#plany', w: 390, h: 3600 },
  { jmeno: 'vyhled-desktop', url: '/?ukazka#plany', w: 1280, h: 2400 },
  { jmeno: 'grafy-desktop', url: '/?ukazka#plany', w: 1280, h: 1700, cekej: 2500, kroky: ["document.querySelector('[data-akce=\"plany.sub\"][data-hodnota=\"grafy\"]').click()"] },
  { jmeno: 'kolace-mobil', url: '/?ukazka#plany', w: 390, h: 1800, cekej: 2500, kroky: ["document.querySelector('[data-akce=\"plany.sub\"][data-hodnota=\"kolace\"]').click()"] },
  { jmeno: 'archiv-desktop', url: '/?ukazka#plany', w: 1280, h: 1000, cekej: 2500, kroky: ["document.querySelector('[data-akce=\"plany.sub\"][data-hodnota=\"archiv\"]').click()"] },
  { jmeno: 'ucty-beta-mobil', url: '/?ukazka#ucty', w: 390, h: 1300, kroky: ["document.querySelector('[data-akce=\"ucty.banka\"][data-hodnota=\"Banka Beta\"]').click()",
    "document.querySelector('.acc:nth-child(3) [data-akce=\"ucty.rozbal\"]').click()"] },
  { jmeno: 'stavy-mobil', url: '/?ukazka#zapis', w: 390, h: 2000, kroky: ["document.querySelector('[data-akce=\"app.zapisSub\"][data-hodnota=\"stavy\"]').click()"] },
  { jmeno: 'editor-mobil', url: '/?ukazka#ucty', w: 390, h: 1200, kroky: ["document.querySelector('[data-akce=\"editor.otevrit\"][data-tab=\"hypoteka\"]').click()"] },
  { jmeno: 'kontrola-mobil', url: '/?ukazka#nastaveni', w: 390, h: 2400, cekej: 1200, kroky: [
    "document.querySelector('[data-akce=\"nastaveni.kontrola\"]').click()",
    "document.getElementById('kText').value='Spořitelna, Raiffka spořicí, J&T fondy, NN životko, stavebko, hypotéka Raiffeisen, Unicretid, Fio, Banka Mrkvička'; document.querySelector('form[data-akce=\"kontrola.zkontroluj\"] button[type=submit]').click()"] },
  { jmeno: 'kontrola-zalozeni', url: '/?ukazka#nastaveni', w: 390, h: 1400, cekej: 1200, kroky: [
    "document.querySelector('[data-akce=\"nastaveni.kontrola\"]').click()",
    "document.getElementById('kText').value='Komerčka, KB spořicí, Unicretid, Conseq'; document.querySelector('form[data-akce=\"kontrola.zkontroluj\"] button[type=submit]').click()",
    "document.querySelector('[data-akce=\"kontrola.potvrd\"][data-ano=\"1\"]').click()",
    "window.confirm=()=>true; document.querySelector('form[data-akce=\"kontrola.zalozit\"] button[type=submit]').click()",
    "document.querySelector('[data-akce=\"ucty.banka\"][data-hodnota=\"Komerční banka\"]').click()"] },
  { jmeno: 'pruvodce-penize', url: '/?ukazka#prehled', w: 390, h: 1100, cekej: 1200, kroky: [
    "FINANCE.rezim='pruvodce'; FINANCE.pruvodceDalsi('penize'); FINANCE.render()",
    "document.getElementById('kText').value='Air Bank, Moneta, ČS fondy'; document.querySelector('form[data-akce=\"kontrola.zkontroluj\"] button[type=submit]').click()"] },
  { jmeno: 'pruvodce-zaklad', url: '/?ukazka#prehled', w: 390, h: 1500, kroky: [
    "FINANCE.rezim='pruvodce'; FINANCE.pruvodceDalsi('zaklad'); FINANCE.render()"] },
  { jmeno: 'ulozeni-stavu', url: '/?ukazka#zapis', w: 390, h: 900, kroky: ["document.querySelector('[data-akce=\"app.zapisSub\"][data-hodnota=\"stavy\"]').click()",
    "var i=document.querySelector('input[name^=\"h_i_\"]'); i.value='999 999'; document.querySelector('form[data-akce=\"stavy.ulozit\"] button[type=submit]').click()"] }
];

const profil = await mkdtemp(join(tmpdir(), 'fin-snimek-'));
const p = spawn(EXE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profil, 'about:blank'], { stdio: 'ignore', windowsHide: true });
const spi = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 50; i++) {
  try {
    const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
    const page = t.find((x) => x.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch (e) { /* ještě nenaběhl */ }
  await spi(200);
}
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const cekajici = new Map();
const chyby = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cekajici.has(m.id)) { cekajici.get(m.id)(m); cekajici.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') chyby.push('VÝJIMKA: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) chyby.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') chyby.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
});
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; cekajici.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await cmd('Runtime.enable'); await cmd('Log.enable'); await cmd('Page.enable');
await mkdir(VYSTUP, { recursive: true });
for (const s of SCENARE.filter((x) => !JEN || x.jmeno.includes(JEN))) {
  chyby.length = 0;
  await cmd('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: s.w < 600 });
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: s.svetly ? 'light' : 'dark' }] });
  await cmd('Page.navigate', { url: 'about:blank' });
  await spi(150);
  await cmd('Page.navigate', { url: URL0 + s.url });
  await spi(1500);
  if (s.svetly) { await cmd('Runtime.evaluate', { expression: "localStorage.setItem('fin2-theme','light');document.documentElement.setAttribute('data-theme','light')" }); await spi(200); }
  for (const k of s.kroky || []) {
    const v = await cmd('Runtime.evaluate', { expression: k });
    if (v.result && v.result.exceptionDetails) chyby.push('KROK SELHAL: ' + k.slice(0, 80) + ' → ' + (v.result.exceptionDetails.exception?.description || '').split('\n')[0]);
    await spi(s.cekej || 700);
  }
  const r = await cmd('Runtime.evaluate', { expression: 'JSON.stringify({sirka: document.documentElement.scrollWidth, vyska: document.documentElement.scrollHeight, toast: document.getElementById("toast").textContent})', returnByValue: true });
  const info = JSON.parse(r.result.result.value);
  const shot = await cmd('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(VYSTUP, s.jmeno + '.png'), Buffer.from(shot.result.data, 'base64'));
  console.log(s.jmeno, 'šířka', info.sirka, '/', s.w, info.sirka > s.w ? '!! VODOROVNÝ POSUVNÍK' : 'ok', '| výška', info.vyska, info.toast ? '| hláška: ' + info.toast : '');
  chyby.filter((c) => !/fonts\.googleapis|gsi\/client|accounts\.google/.test(c)).forEach((c) => console.log('   ', c));
}
ws.close();
p.kill();
await spi(500);
await rm(profil, { recursive: true, force: true }).catch(() => {});
