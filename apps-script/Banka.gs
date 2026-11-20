/**
 * Finance – napojení na banku přes Enable Banking.
 *
 * Tento skript patří do TVÉ tabulky „Finance – data“ (Rozšíření → Apps Script).
 * Běží pod tvým účtem Google. Bankovní data nejdou přes žádný cizí server.
 *
 * Co dělá:
 *  - přihlášení do banky (webová aplikace skriptu = adresa pro návrat z banky),
 *  - 4× denně stáhne zůstatky a zaúčtované pohyby,
 *  - pohyby zapíše do listu „banka_pohyby“ (aplikace je pak nabídne k potvrzení),
 *  - zůstatky zapíše do „banka_ucty“ a u účtů spárovaných v aplikaci i do „stavy“.
 *
 * Nastavení (Nastavení projektu → Vlastnosti skriptu):
 *  - EB_APP_ID … ID aplikace z Enable Banking
 *  - EB_KLIC   … celý obsah souboru .pem (soukromý klíč) – nikomu ho neposílej
 *
 * Listy vytváří aplikace (Nastavení → Moduly → Napojení na banku). Skript je jen doplňuje.
 * Verze skriptu: 1
 */

var EB_API = 'https://api.enablebanking.com';
var VERZE_SKRIPTU = 1;
var DNI_POPRVE = 90;       // při prvním stažení: pohyby za posledních 90 dní
var DNI_PREKRYV = 5;       // při dalším: od posledního stažení minus 5 dní (pozdě zaúčtované platby)
var PAUZA_LIMIT_H = 6;     // banka hlásí limit stahování → počkat 6 hodin
var POREDI_ZUSTATKU = ['ITAV', 'CLAV', 'XPCD', 'ITBD', 'CLBD', 'OPAV', 'OPBD'];

/* ---------------- menu v tabulce ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Banka')
    .addItem('Stáhnout teď', 'stahnoutTed')
    .addItem('Zapnout automatické stahování (4× denně)', 'zapnoutStahovani')
    .addItem('Vypnout automatické stahování', 'vypnoutStahovani')
    .addItem('Zkontrolovat nastavení', 'zkontrolovat')
    .addToUi();
}

function stahnoutTed() {
  var vysledek = stahni();
  SpreadsheetApp.getUi().alert(vysledek);
}

function zapnoutStahovani() {
  vypnoutStahovani(true);
  ScriptApp.newTrigger('stahni').timeBased().everyHours(6).create();
  SpreadsheetApp.getUi().alert('Automatické stahování je zapnuté: každých 6 hodin (4× denně).');
}

function vypnoutStahovani(potichu) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'stahni') ScriptApp.deleteTrigger(t);
  });
  if (potichu !== true) SpreadsheetApp.getUi().alert('Automatické stahování je vypnuté.');
}

/** Ověří ID aplikace, klíč a spojení s Enable Banking. */
function zkontrolovat() {
  var zprava;
  try {
    var banky = volej('GET', '/aspsps?country=CZ&psu_type=personal');
    zprava = 'Nastavení je v pořádku. Enable Banking nabízí pro Česko ' + (banky.aspsps || []).length + ' bank.\n\n' +
      'Adresa pro návrat z banky (Redirect URL):\n' + adresaSkriptu();
  } catch (e) {
    zprava = 'Chyba: ' + e.message;
  }
  try { SpreadsheetApp.getUi().alert(zprava); } catch (x) { Logger.log(zprava); }
  return zprava;
}

/* ---------------- webová aplikace: přihlášení do banky ---------------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.error) return stranka('Banka přihlášení nedokončila', '<p>' + esc(p.error_description || p.error) + '</p>' + odkazZpet());
    if (p.code) return dokonciPrihlaseni(p.code, p.state);
    if (p.banka) return zacniPrihlaseni(p.banka);
    return vyberBanky();
  } catch (err) {
    return stranka('Něco se nepovedlo', '<p>' + esc(err.message) + '</p>' + odkazZpet());
  }
}

function vyberBanky() {
  var data = volej('GET', '/aspsps?country=CZ&psu_type=personal');
  var banky = (data.aspsps || []).map(function (a) { return a.name; }).sort();
  var url = adresaSkriptu();
  var seznam = banky.map(function (n) {
    return '<li><a target="_top" href="' + esc(url + '?banka=' + encodeURIComponent(n)) + '">' + esc(n) + '</a></li>';
  }).join('');
  return stranka('Připojit banku', '<p>Vyber svou banku. Stránka tě přepne do banky, tam se přihlásíš a potvrdíš přístup k účtům.</p>' +
    '<ul>' + seznam + '</ul>');
}

function zacniPrihlaseni(banka) {
  var state = Utilities.getUuid();
  var platnost = new Date(Date.now() + maxPlatnostSouhlasu(banka) * 1000);
  PropertiesService.getScriptProperties().setProperty('EB_STATE', JSON.stringify({ state: state, banka: banka, cas: Date.now() }));
  var r = volej('POST', '/auth', {
    access: { valid_until: platnost.toISOString() },
    aspsp: { name: banka, country: 'CZ' },
    state: state,
    redirect_url: adresaSkriptu(),
    psu_type: 'personal'
  });
  return stranka('Přepínám do banky…', '<p>Pokud se stránka sama nepřepne, klikni: <a target="_top" href="' + esc(r.url) + '">pokračovat do banky</a>.</p>' +
    '<script>window.top.location.href = ' + JSON.stringify(r.url) + ';</script>');
}

function maxPlatnostSouhlasu(banka) {
  var vychozi = 180 * 86400;
  try {
    var data = volej('GET', '/aspsps?country=CZ&psu_type=personal');
    var a = (data.aspsps || []).filter(function (x) { return x.name === banka; })[0];
    // o hodinu kratší, ať banka nepovažuje platnost za příliš dlouhou
    if (a && a.maximum_consent_validity) return Math.max(3600, Number(a.maximum_consent_validity) - 3600);
  } catch (e) { /* použije se výchozí */ }
  return vychozi - 3600;
}

function dokonciPrihlaseni(code, state) {
  var props = PropertiesService.getScriptProperties();
  var ulozeny = JSON.parse(props.getProperty('EB_STATE') || '{}');
  if (!ulozeny.state || ulozeny.state !== state) throw new Error('Návrat z banky nepatří k tomuto přihlášení. Začni znovu z aplikace.');
  props.deleteProperty('EB_STATE');
  var s = volej('POST', '/sessions', { code: code });
  var banka = (s.aspsp && s.aspsp.name) || ulozeny.banka;
  var souhlasDo = s.access && s.access.valid_until ? String(s.access.valid_until).slice(0, 10) : '';

  // relace: jedna na banku (nové přihlášení ke stejné bance nahradí starou)
  var relace = nactiRelace().filter(function (r) { return r.banka !== banka; });
  relace.push({ id: s.session_id, banka: banka, souhlas_do: souhlasDo });
  props.setProperty('EB_RELACE', JSON.stringify(relace));

  var list = list_('banka_ucty');
  (s.accounts || []).forEach(function (a) {
    var uid = a.uid;
    if (!uid) return;
    var iban = (a.account_id && a.account_id.iban) || '';
    var nazev = a.name || a.product || a.details || iban || uid;
    var radek = najdiRadek_(list, 'id', uid);
    var zmeny = { id: uid, relace: s.session_id, banka: banka, iban: iban, nazev: nazev, mena: a.currency || 'CZK', souhlas_do: souhlasDo, chyba: '' };
    if (radek) zapisRadek_(list, radek, zmeny); else pridejRadek_(list, zmeny);
  });

  var vysledek = '';
  try { vysledek = stahni(); } catch (e) { vysledek = 'Stažení se nepovedlo: ' + e.message; }
  return stranka('Banka je připojená', '<p>Připojeno: <b>' + esc(banka) + '</b>, účtů: ' + (s.accounts || []).length +
    '. Souhlas platí do ' + esc(datumCesky(souhlasDo)) + '.</p><p>' + esc(vysledek) + '</p>' +
    '<p>Teď se vrať do aplikace Finance a v Nastavení → Napojení na banku přiřaď bankovní účty ke svým účtům.</p>' + odkazZpet());
}

/* ---------------- stahování ---------------- */

/** Stáhne zůstatky a pohyby všech připojených účtů. Volá ho spouštěč 4× denně, menu i návrat z banky. */
function stahni() {
  var zamek = LockService.getScriptLock();
  if (!zamek.tryLock(30000)) return 'Stahování už běží.';
  try {
    var props = PropertiesService.getScriptProperties();
    var pauza = Number(props.getProperty('EB_PAUZA_DO') || 0);
    if (pauza > Date.now()) return 'Banka hlásila limit stahování, další pokus po ' + new Date(pauza).toLocaleString('cs-CZ') + '.';

    var ucty = list_('banka_ucty');
    var pohyby = list_('banka_pohyby');
    var stavy = list_('stavy');
    var zname = {};
    hodnotySloupce_(pohyby, 'id').forEach(function (id) { zname[String(id)] = true; });

    var radky = objekty_(ucty);
    if (!radky.length) return 'Zatím není připojený žádný účet.';
    var celkem = 0, chyby = [];
    var ted = casTed_();

    radky.forEach(function (u) {
      if (!u.id) return;
      try {
        var zust = stahniZustatek_(u.id);
        var zmeny = { stazeno: ted, chyba: '' };
        if (zust) {
          zmeny.zustatek = zust.castka;
          zmeny.k_datu = zust.datum;
          if (u.ucet_id) zapisStav_(stavy, u.ucet_id, zust.datum, zust.castka);
        }
        var od = u.stazeno ? posunDny_(String(u.stazeno).slice(0, 10), -DNI_PREKRYV) : posunDny_(dnes_(), -DNI_POPRVE);
        var nove = stahniPohyby_(u.id, od).filter(function (t) { return !zname[t.id]; });
        nove.forEach(function (t) { zname[t.id] = true; });
        if (nove.length) pridejRadky_(pohyby, nove.map(function (t) {
          t.ucet_uid = u.id; t.stazeno = ted; t.stav = ''; return t;
        }));
        celkem += nove.length;
        zapisRadek_(ucty, najdiRadek_(ucty, 'id', u.id), zmeny);
      } catch (e) {
        if (/ASPSP_RATE_LIMIT_EXCEEDED/.test(e.message)) props.setProperty('EB_PAUZA_DO', String(Date.now() + PAUZA_LIMIT_H * 3600000));
        chyby.push((u.nazev || u.id) + ': ' + e.message);
        var r = najdiRadek_(ucty, 'id', u.id);
        if (r) zapisRadek_(ucty, r, { chyba: e.message.slice(0, 300), stazeno: ted });
      }
    });
    return 'Staženo nových pohybů: ' + celkem + '.' + (chyby.length ? ' Chyby: ' + chyby.join(' | ') : '');
  } finally {
    zamek.releaseLock();
  }
}

function stahniZustatek_(uid) {
  var r = volej('GET', '/accounts/' + encodeURIComponent(uid) + '/balances');
  var b = r.balances || [];
  if (!b.length) return null;
  b.sort(function (x, y) { return poradi_(x.balance_type) - poradi_(y.balance_type); });
  var vybrany = b[0];
  return { castka: Number(vybrany.balance_amount.amount), datum: String(vybrany.reference_date || dnes_()).slice(0, 10) };
}
function poradi_(typ) { var i = POREDI_ZUSTATKU.indexOf(typ); return i < 0 ? 99 : i; }

function stahniPohyby_(uid, odData) {
  var out = [], klic = null, stran = 0;
  do {
    var q = '?date_from=' + odData + (klic ? '&continuation_key=' + encodeURIComponent(klic) : '');
    var r = volej('GET', '/accounts/' + encodeURIComponent(uid) + '/transactions' + q);
    (r.transactions || []).forEach(function (t) {
      if (t.status && t.status !== 'BOOK') return; // jen zaúčtované – čekající se mění
      out.push(prevedPohyb_(uid, t));
    });
    klic = r.continuation_key || null;
    stran++;
  } while (klic && stran < 50);
  return out;
}

function prevedPohyb_(uid, t) {
  var castka = Number(t.transaction_amount.amount);
  if (t.credit_debit_indicator === 'DBIT') castka = -Math.abs(castka);
  else castka = Math.abs(castka);
  var odchozi = castka < 0;
  var strana = odchozi ? t.creditor : t.debtor;
  var ucet = odchozi ? t.creditor_account : t.debtor_account;
  var popis = (t.remittance_information || []).join(' ').replace(/\s+/g, ' ').trim();
  if (!popis && t.bank_transaction_code && t.bank_transaction_code.description) popis = t.bank_transaction_code.description;
  var datum = String(t.booking_date || t.value_date || t.transaction_date || dnes_()).slice(0, 10);
  var protiucet = ucet ? (ucet.iban || (ucet.other && ucet.other.identification) || '') : '';
  var id = t.entry_reference || t.transaction_id;
  if (!id) {
    // banka nedala id → otisk z obsahu (stejná platba = stejné id)
    var bajty = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, [uid, datum, castka, popis, protiucet].join('|'));
    id = 'h' + bajty.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 20);
  }
  return {
    id: uid.slice(0, 8) + ':' + id,
    datum: datum,
    castka: castka,
    mena: t.transaction_amount.currency || 'CZK',
    protistrana: (strana && strana.name) || '',
    protiucet: protiucet,
    popis: popis
  };
}

/** Do listu stavy zapíše zůstatek, jen když se k tomu dni liší od posledního zapsaného. */
function zapisStav_(stavy, ucetId, datum, castka) {
  var vse = objekty_(stavy).filter(function (s) { return s.ucet_id === ucetId; });
  vse.sort(function (a, b) { return String(a.datum) < String(b.datum) ? -1 : 1; });
  var posl = vse[vse.length - 1];
  if (posl && String(posl.datum) === datum && Math.abs(Number(posl.zustatek) - castka) < 0.005) return;
  pridejRadek_(stavy, { id: 'b' + Utilities.getUuid().replace(/-/g, '').slice(0, 9), datum: datum, ucet_id: ucetId, zustatek: castka, zdroj: 'banka' });
}

/* ---------------- Enable Banking: podpis a volání ---------------- */

function volej(metoda, cesta, telo) {
  var moznosti = {
    method: metoda.toLowerCase(),
    headers: { Authorization: 'Bearer ' + jwt_() },
    muteHttpExceptions: true,
    contentType: 'application/json'
  };
  if (telo) moznosti.payload = JSON.stringify(telo);
  var r = UrlFetchApp.fetch(EB_API + cesta, moznosti);
  var kod = r.getResponseCode();
  var text = r.getContentText();
  var json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { message: text }; }
  if (kod >= 300) {
    var chyba = [json.error, json.message, json.detail ? JSON.stringify(json.detail) : ''].filter(Boolean).join(' – ');
    throw new Error('Enable Banking ' + kod + ': ' + (chyba || text.slice(0, 200)));
  }
  return json;
}

function jwt_() {
  var props = PropertiesService.getScriptProperties();
  var appId = (props.getProperty('EB_APP_ID') || '').trim();
  if (!appId) throw new Error('Chybí vlastnost skriptu EB_APP_ID (ID aplikace z Enable Banking).');
  var klic = upravKlic_(props.getProperty('EB_KLIC'));
  var ted = Math.floor(Date.now() / 1000);
  var hlava = { typ: 'JWT', alg: 'RS256', kid: appId };
  var obsah = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: ted, exp: ted + 3600 };
  var vstup = b64_(JSON.stringify(hlava)) + '.' + b64_(JSON.stringify(obsah));
  var podpis = Utilities.computeRsaSha256Signature(vstup, klic);
  return vstup + '.' + Utilities.base64EncodeWebSafe(podpis).replace(/=+$/, '');
}
function b64_(s) { return Utilities.base64EncodeWebSafe(s, Utilities.Charset.UTF_8).replace(/=+$/, ''); }

/** Klíč z vlastnosti skriptu (vložený třeba bez zalomení řádků) → PEM, kterému Apps Script rozumí. */
function upravKlic_(pem) {
  if (!pem) throw new Error('Chybí vlastnost skriptu EB_KLIC (obsah souboru .pem).');
  if (/BEGIN RSA PRIVATE KEY/.test(pem)) throw new Error('Klíč je ve formátu „RSA PRIVATE KEY“. Apps Script potřebuje „PRIVATE KEY“ (PKCS#8) – viz návod, část Časté potíže.');
  if (/ENCRYPTED/.test(pem)) throw new Error('Klíč je zaheslovaný. Potřebuji klíč bez hesla.');
  var telo = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/[^A-Za-z0-9+\/=]/g, '');
  if (telo.length < 200) throw new Error('Vlastnost EB_KLIC nevypadá jako soukromý klíč.');
  var radky = telo.match(/.{1,64}/g).join('\n');
  return '-----BEGIN PRIVATE KEY-----\n' + radky + '\n-----END PRIVATE KEY-----\n';
}

function nactiRelace() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('EB_RELACE') || '[]'); } catch (e) { return []; }
}

/* ---------------- práce s listy (podle hlavičky) ---------------- */

function list_(nazev) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nazev);
  if (!sh) throw new Error('V tabulce chybí list „' + nazev + '“. Zapni v aplikaci Nastavení → Moduly → Napojení na banku.');
  return sh;
}
function hlavicka_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); }

function objekty_(sh) {
  var n = sh.getLastRow();
  if (n < 2) return [];
  var hl = hlavicka_(sh);
  return sh.getRange(2, 1, n - 1, hl.length).getValues().map(function (r) {
    var o = {};
    hl.forEach(function (h, i) { o[h] = r[i] instanceof Date ? isoZData_(r[i]) : (typeof r[i] === 'number' && h === 'datum' ? isoZeSeriove_(r[i]) : r[i]); });
    return o;
  });
}
function hodnotySloupce_(sh, sloupec) {
  var hl = hlavicka_(sh), i = hl.indexOf(sloupec), n = sh.getLastRow();
  if (i < 0 || n < 2) return [];
  return sh.getRange(2, i + 1, n - 1, 1).getValues().map(function (r) { return r[0]; });
}
function najdiRadek_(sh, sloupec, hodnota) {
  var v = hodnotySloupce_(sh, sloupec);
  for (var i = 0; i < v.length; i++) if (String(v[i]) === String(hodnota)) return i + 2;
  return 0;
}
function bunka_(nazevSloupce, v) {
  if (v === undefined || v === null) return '';
  if ((nazevSloupce === 'datum' || nazevSloupce === 'k_datu' || nazevSloupce === 'souhlas_do') && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return naSeriove_(String(v));
  // text, který by tabulka vzala jako vzorec, číslo nebo datum, se uloží jako text (apostrof se do buňky neukládá)
  if (typeof v === 'string' && v !== '' && (/^[=+@\-]/.test(v) || /^[\d.,\s\/:-]+$/.test(v) || nazevSloupce === 'stazeno')) return "'" + v;
  return v;
}
function radekZObjektu_(hl, o) { return hl.map(function (h) { return h in o ? bunka_(h, o[h]) : ''; }); }
function pridejRadek_(sh, o) { pridejRadky_(sh, [o]); }
function pridejRadky_(sh, objs) {
  if (!objs.length) return;
  var hl = hlavicka_(sh);
  var od = sh.getLastRow() + 1;
  sh.getRange(od, 1, objs.length, hl.length).setValues(objs.map(function (o) { return radekZObjektu_(hl, o); }));
  ['datum', 'k_datu', 'souhlas_do'].forEach(function (s) {
    var i = hl.indexOf(s);
    if (i >= 0) sh.getRange(od, i + 1, objs.length, 1).setNumberFormat('d.m.yyyy');
  });
}
function zapisRadek_(sh, radek, zmeny) {
  if (!radek) return;
  var hl = hlavicka_(sh);
  hl.forEach(function (h, i) {
    if (h in zmeny) {
      var c = sh.getRange(radek, i + 1);
      c.setValue(bunka_(h, zmeny[h]));
      if (h === 'datum' || h === 'k_datu' || h === 'souhlas_do') c.setNumberFormat('d.m.yyyy');
    }
  });
}

/* ---------------- datum a drobnosti ---------------- */

var DEN_MS = 86400000;
var NULA = Date.UTC(1899, 11, 30);
function naSeriove_(iso) { var p = iso.split('-').map(Number); return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - NULA) / DEN_MS); }
function isoZeSeriove_(n) { return new Date(NULA + Math.round(n) * DEN_MS).toISOString().slice(0, 10); }
function isoZData_(d) { return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd'); }
function casTed_() { return Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH:mm'); }
function dnes_() { return Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd'); }
function posunDny_(iso, n) { return isoZeSeriove_(naSeriove_(iso) + n); }
function datumCesky(iso) { if (!iso) return '–'; var p = iso.split('-').map(Number); return p[2] + '. ' + p[1] + '. ' + p[0]; }

function adresaSkriptu() {
  var url = ScriptApp.getService().getUrl();
  if (!url) throw new Error('Skript ještě není nasazený jako webová aplikace (Nasadit → Nové nasazení → Webová aplikace).');
  return url.replace(/\/dev$/, '/exec');
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function odkazZpet() { return '<p><a target="_top" href="https://lervaz.github.io/finance/">← Zpět do aplikace Finance</a></p>'; }
function stranka(nadpis, telo) {
  return HtmlService.createHtmlOutput('<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#1b1f24}' +
    'a{color:#2563eb}li{margin:6px 0}</style><h1>' + esc(nadpis) + '</h1>' + telo)
    .setTitle('Finance – ' + nadpis)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
