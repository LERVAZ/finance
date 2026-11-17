/* Vydání nové verze: node tools/vydat.js 1.1.0 "Co je nového" ["Další novinka" …]
   Upraví js/verze.js, verze.json, sw.js (název mezipaměti) a CHANGELOG.md, zkontroluje seznam souborů
   v sw.js a spustí testy. Commit, značku (tag) a push dělá člověk – skript jen vypíše příkazy. */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const KOREN = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const cesta = (p) => join(KOREN, p);
const [, , nova, ...novinky] = process.argv;

const chyba = (t) => { console.error('CHYBA: ' + t); process.exit(1); };
if (!/^\d+\.\d+\.\d+$/.test(nova || '')) chyba('zadej verzi ve tvaru 1.2.0, např.: node tools/vydat.js 1.1.0 "Nová lišta s aktualizací"');
if (!novinky.length) chyba('napiš aspoň jednu novinku v uvozovkách');

const verzeJs = readFileSync(cesta('js/verze.js'), 'utf8');
const stara = (/VERZE = '([\d.]+)'/.exec(verzeJs) || [])[1];
const cislo = (v) => v.split('.').map(Number);
const [a, b] = [cislo(nova), cislo(stara)];
const vetsi = a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
if (!vetsi) chyba('nová verze ' + nova + ' musí být vyšší než současná ' + stara);

const dnes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());

// 1) soubory se seznamem pro offline režim
const sw = readFileSync(cesta('sw.js'), 'utf8');
const vSw = new Set([...sw.matchAll(/'([^']+\.(?:js|css|json|png|webmanifest|html))'/g)].map((m) => m[1]));
const vsechnyJs = [];
const projdi = (d) => readdirSync(cesta(d)).forEach((f) => { const p = d + '/' + f; statSync(cesta(p)).isDirectory() ? projdi(p) : /\.js$/.test(f) && vsechnyJs.push(p); });
projdi('js');
const mimoRepo = /^js\/import(-[a-z]+)?\.js$/; // jen lokálně, viz .gitignore a js/doplnky.js
const chybi = vsechnyJs.filter((f) => !vSw.has(f) && !mimoRepo.test(f));
if (chybi.length) chyba('v sw.js (SOUBORY) chybí: ' + chybi.join(', '));

// 2) testy
try { execSync('node --test "tests/*.test.js"', { cwd: KOREN, stdio: 'pipe' }); } catch (e) { console.error(String(e.stdout || '')); chyba('testy neprošly, verze se nevydá'); }

// 3) zápis
writeFileSync(cesta('js/verze.js'), verzeJs.replace(/VERZE = '[\d.]+'/, "VERZE = '" + nova + "'").replace(/DATUM_VERZE = '[\d-]+'/, "DATUM_VERZE = '" + dnes + "'"));
writeFileSync(cesta('verze.json'), JSON.stringify({ verze: nova, datum: dnes, novinky }, null, 2) + '\n');
writeFileSync(cesta('sw.js'), sw.replace(/const CACHE = '[^']+';/, "const CACHE = 'finance2-" + nova + "';"));
const log = existsSync(cesta('CHANGELOG.md')) ? readFileSync(cesta('CHANGELOG.md'), 'utf8') : '# Co je nového\n';
const zaznam = '\n## ' + nova + ' – ' + dnes.split('-').reverse().map(Number).join('. ') + '\n' + novinky.map((n) => '- ' + n).join('\n') + '\n';
writeFileSync(cesta('CHANGELOG.md'), log.replace(/^(# [^\n]*\n)/, '$1' + zaznam));

console.log('Verze ' + stara + ' → ' + nova + ' připravena (' + relative(process.cwd(), KOREN || '.') + ').');
console.log('Teď spusť:');
console.log('  git add -A');
console.log('  git commit -m "Verze ' + nova + '"');
console.log('  git tag v' + nova);
console.log('  git push --follow-tags');
