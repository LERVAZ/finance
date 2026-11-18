/* Nápověda v aplikaci: načte docs/NAVOD.md a převede ho na HTML (jednoduchý Markdown:
   nadpisy, odstavce, odrážky, číslované seznamy, tučné, kód, odkazy, obrázky, tabulky ne). */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Řádkové formátování v už escapovaném textu. */
function radek(t, zaklad) {
  return t
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => '<img src="' + (/^https?:/.test(src) ? src : zaklad + src) + '" alt="' + alt + '" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => /^https?:/.test(url)
      ? '<a href="' + url + '" target="_blank" rel="noopener">' + txt + '</a>'
      : '<a href="#' + url.replace(/^#/, '') + '">' + txt + '</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

const kotva = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Markdown → HTML. zaklad = cesta, ke které se vztahují relativní obrázky (např. 'docs/'). */
export function mdNaHtml(md, zaklad = '') {
  const out = [];
  let seznam = null, odstavec = [];
  const zavriOdstavec = () => { if (odstavec.length) { out.push('<p>' + radek(odstavec.join(' '), zaklad) + '</p>'); odstavec = []; } };
  const zavriSeznam = () => { if (seznam) { out.push('</' + seznam + '>'); seznam = null; } };
  for (const surovy of md.replace(/\r/g, '').split('\n')) {
    const r = esc(surovy);
    let m;
    if (!r.trim()) { zavriOdstavec(); zavriSeznam(); continue; }
    if ((m = r.match(/^(#{1,4})\s+(.*)$/))) {
      zavriOdstavec(); zavriSeznam();
      const u = Math.min(m[1].length + 1, 4);
      out.push('<h' + u + ' id="' + kotva(m[2]) + '">' + radek(m[2], zaklad) + '</h' + u + '>');
      continue;
    }
    if ((m = r.match(/^\s*([-*]|\d+\.)\s+(.*)$/))) {
      zavriOdstavec();
      const typ = /\d/.test(m[1]) ? 'ol' : 'ul';
      if (seznam !== typ) { zavriSeznam(); out.push('<' + typ + '>'); seznam = typ; }
      out.push('<li>' + radek(m[2], zaklad) + '</li>');
      continue;
    }
    if (/^&gt;\s?/.test(r)) { zavriOdstavec(); zavriSeznam(); out.push('<div class="note">' + radek(r.replace(/^&gt;\s?/, ''), zaklad) + '</div>'); continue; }
    if (seznam) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + radek(r.trim(), zaklad) + '</li>'); continue; }
    odstavec.push(r.trim());
  }
  zavriOdstavec(); zavriSeznam();
  return out.join('\n');
}

let cache = null;
/** Načte návod (jednou za spuštění). */
export async function nactiNavod() {
  if (cache) return cache;
  const r = await fetch('docs/NAVOD.md', { cache: 'no-cache' });
  if (!r.ok) throw new Error('Návod se nepodařilo načíst (jsi online?).');
  cache = mdNaHtml(await r.text(), 'docs/');
  return cache;
}
