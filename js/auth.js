/* Přihlášení Google účtem (OAuth přesměrováním) a zámek otiskem / Windows Hello (WebAuthn).
   Převzato ze staré verze. Klíče v localStorage mají předponu fin2-, aby se nepletly se starou aplikací na stejné adrese. */
import { NASTAVENI } from './config.js';

export const LS = {
  get(k) { try { return localStorage.getItem('fin2-' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('fin2-' + k, v); } catch (e) { /* soukromé okno */ } },
  del(k) { try { localStorage.removeItem('fin2-' + k); } catch (e) { /* soukromé okno */ } }
};

const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function tokenPlatny() {
  const t = LS.get('token'), exp = +LS.get('token-exp') || 0;
  return !!t && Date.now() < exp - 60000;
}
export async function token() {
  if (tokenPlatny()) return LS.get('token');
  const e = new Error('Přihlášení vypršelo, přihlas se znovu.');
  e.needLogin = true;
  throw e;
}
export function email() { return LS.get('email') || ''; }

/* ---------- přihlášení přesměrováním (bez vyskakovacího okna a bez cookies třetích stran) ----------
   Stránka odejde na Google a vrátí se s tokenem v adrese (#access_token=…). Adresa návratu musí být
   v Google Cloud mezi „Authorized redirect URIs“ (např. https://lervaz.github.io/finance/ a http://localhost:8790/). */
export const adresaNavratu = () => location.origin + location.pathname.replace(/index\.html$/, '');

export function prihlasitPresmerovanim() {
  if (!NASTAVENI.googleClientId) throw new Error('Aplikace nemá nastavené Google Client ID (js/config.js).');
  const stav = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem('fin2-stav', stav); } catch (e) { /* bez sessionStorage se jen nekontroluje stav */ }
  const p = new URLSearchParams({ client_id: NASTAVENI.googleClientId, redirect_uri: adresaNavratu(), response_type: 'token',
    scope: SCOPE + ' openid email', include_granted_scopes: 'true', state: stav });
  if (LS.get('email')) p.set('login_hint', LS.get('email'));
  if (!LS.get('email') || LS.get('force-consent')) p.set('prompt', 'consent');
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString());
}

/** Po návratu z Googlu: uloží token z adresy a adresu uklidí. Vrací null (nic), true (přihlášeno) nebo text chyby. */
export function zpracujNavrat() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (!h.has('access_token') && !h.has('error')) return null;
  history.replaceState(null, '', location.pathname + location.search);
  let ocekavany = null;
  try { ocekavany = sessionStorage.getItem('fin2-stav'); sessionStorage.removeItem('fin2-stav'); } catch (e) { /* nic */ }
  if (ocekavany && h.get('state') !== ocekavany) return 'Přihlášení se nepovedlo ověřit, zkus to znovu.';
  if (h.has('error')) return h.get('error') === 'access_denied' ? 'Přihlášení bylo zrušeno.' : 'Přihlášení se nepovedlo: ' + h.get('error');
  if (!(h.get('scope') || '').split(' ').includes(SCOPE)) {
    LS.set('force-consent', '1');
    return 'Google nepovolil přístup k souborům aplikace. Přihlas se znovu a oprávnění na stránce Googlu potvrď.';
  }
  LS.del('force-consent');
  ulozToken(h.get('access_token'), Number(h.get('expires_in')) || 3600);
  return true;
}

function ulozToken(t, expiresIn) {
  LS.set('token', t);
  LS.set('token-exp', String(Date.now() + expiresIn * 1000));
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + t } })
    .then((r) => r.json()).then((u) => { if (u.email) LS.set('email', u.email); }).catch(() => {});
}

/** Přihlášení: stránka se přepne na Google a vrátí se s tokenem (funguje i při blokovaných cookies třetích stran). */
export function prihlasit() { prihlasitPresmerovanim(); return new Promise(() => {}); }

export function odhlasit() {
  const t = LS.get('token');
  LS.del('token'); LS.del('token-exp');
  if (t) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'token=' + encodeURIComponent(t) }).catch(() => {});
}

/* ---------- zámek ---------- */
const rand = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function unb64(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const b = atob(s), a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
export async function zamekPodporovan() {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
}
export const zamekZapnuty = () => !!LS.get('cred');
export async function zamekZapnout() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: rand(32),
    rp: { name: 'Finance', id: location.hostname },
    user: { id: rand(16), name: LS.get('email') || 'finance', displayName: 'Finance' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none'
  } });
  LS.set('cred', b64(cred.rawId));
}
export const zamekVypnout = () => LS.del('cred');
export async function zamekOverit() {
  const id = LS.get('cred');
  if (!id) return true;
  await navigator.credentials.get({ publicKey: {
    challenge: rand(32), timeout: 60000, userVerification: 'required',
    allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal', 'hybrid'] }]
  } });
  return true;
}
