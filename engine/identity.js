// Colori (CR 105.2) e identità di colore (CR 903.4) di una carta.
const WUBRG = ['W', 'U', 'B', 'R', 'G'];

const symbolsIn = (text = '') => [...String(text).matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);

// Colori di una carta: quelli dei simboli nel costo, oppure quelli dichiarati (token)
function colorsOf(def) {
  if (def.colors) return def.colors;
  const found = new Set(symbolsIn(def.cost).filter((s) => WUBRG.includes(s)));
  return WUBRG.filter((c) => found.has(c));
}

// Identità di colore: colori del costo più i simboli di mana nel testo, qui rappresentati dal mana prodotto
function colorIdentity(def) {
  if (def.colorIdentity) return WUBRG.filter((c) => def.colorIdentity.includes(c)); // carte ricavate da Scryfall
  const found = new Set(colorsOf(def));
  const effects = [].concat(def.effect || [], ...(def.modes || []), ...(def.abilities || []).map((a) => a.effect || []));
  for (const a of def.abilities || []) {
    if (a.kind === 'mana' && /^[WUBRGC]+$/.test(a.produce)) for (const c of a.produce) found.add(c);
    if (a.kind === 'mana' && a.produce === 'choice') for (const c of a.options) if (WUBRG.includes(c)) found.add(c);
    for (const s of symbolsIn(a.cost)) if (WUBRG.includes(s)) found.add(s);
  }
  for (const e of effects) if (e && e.kind === 'addMana' && WUBRG.includes(e.color)) found.add(e.color);
  return WUBRG.filter((c) => found.has(c));
}

module.exports = { WUBRG, colorsOf, colorIdentity };
