// Mana: costi (CR 107.4), pool (CR 106.4) e pagamento (CR 601.2g-h).
const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];

function emptyPool(extra = {}) {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...extra };
}

function parseCost(text = '') {
  const cost = emptyPool({ generic: 0 });
  for (const [, symbol] of String(text).matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(symbol)) cost.generic += Number(symbol);
    else if (COLORS.includes(symbol)) cost[symbol]++;
    else throw new Error(`Simbolo di mana non supportato: {${symbol}}`);
  }
  return cost;
}

const total = (pool) => COLORS.reduce((s, c) => s + pool[c], 0);

function canPay(pool, cost) {
  if (COLORS.some((c) => pool[c] < cost[c])) return false;
  const colored = COLORS.reduce((s, c) => s + cost[c], 0);
  return total(pool) - colored >= cost.generic;
}

// Restituisce il pool rimasto. Il generico consuma prima l'incolore, poi il colore più abbondante,
// così restano disponibili più colori diversi per le magie successive.
function pay(pool, cost) {
  if (!canPay(pool, cost)) throw new Error('Mana insufficiente per pagare il costo');
  const left = emptyPool();
  for (const c of COLORS) left[c] = pool[c] - cost[c];
  for (let n = cost.generic; n > 0; n--) {
    const from = left.C > 0 ? 'C' : COLORS.filter((c) => c !== 'C').sort((a, b) => left[b] - left[a])[0];
    left[from]--;
  }
  return left;
}

module.exports = { COLORS, emptyPool, parseCost, canPay, pay, total };
