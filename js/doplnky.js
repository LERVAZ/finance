/* Volitelné části, které nejsou ve zveřejněné verzi (jsou v .gitignore):
   - import.js (+ import-prevod.js, import-porovnani.js): jednorázový import ze staré tabulky autora.
   Načítají se jen při běhu na vlastním počítači (localhost), na webu se o ně aplikace ani nepokusí. */
export const doplnky = { import: null };

export async function nactiDoplnky() {
  const lokalne = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (!lokalne) return;
  try { doplnky.import = await import('./import.js'); } catch (e) { doplnky.import = null; }
}
