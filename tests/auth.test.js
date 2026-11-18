/* Přihlášení přesměrováním: zpracování návratu z Googlu (#access_token=…). */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const uloziste = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.localStorage = uloziste();
globalThis.sessionStorage = uloziste();
globalThis.fetch = async () => ({ json: async () => ({ email: 'tester@example.com' }) });
const okno = { hash: '', pathname: '/finance/', search: '', origin: 'https://example.github.io' };
globalThis.location = okno;
globalThis.history = { replaceState: (a, b, url) => { okno.hash = ''; okno.posledni = url; } };

const auth = await import('../js/auth.js');
const DRIVE = 'https://www.googleapis.com/auth/drive.file';

test('návrat z Googlu: token se uloží, adresa se uklidí, stav se ověří', () => {
  assert.equal(auth.zpracujNavrat(), null);                         // bez tokenu v adrese nic
  sessionStorage.setItem('fin2-stav', 'abc');
  okno.hash = '#state=abc&access_token=TOKEN1&expires_in=3599&scope=' + encodeURIComponent('openid ' + DRIVE);
  assert.equal(auth.zpracujNavrat(), true);
  assert.equal(okno.hash, '');
  assert.equal(okno.posledni, '/finance/');
  assert.equal(auth.LS.get('token'), 'TOKEN1');
  assert.ok(auth.tokenPlatny());
  assert.equal(auth.adresaNavratu(), 'https://example.github.io/finance/');
});

test('návrat z Googlu: cizí stav, zrušení a chybějící oprávnění', () => {
  sessionStorage.setItem('fin2-stav', 'abc');
  okno.hash = '#state=jiny&access_token=X&scope=' + encodeURIComponent(DRIVE);
  assert.match(auth.zpracujNavrat(), /ověřit/);
  okno.hash = '#error=access_denied';
  assert.match(auth.zpracujNavrat(), /zrušeno/);
  okno.hash = '#access_token=Y&scope=openid';
  assert.match(auth.zpracujNavrat(), /nepovolil/);
  assert.equal(auth.LS.get('force-consent'), '1');
});
