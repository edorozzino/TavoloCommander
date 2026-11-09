// Archivio dei mazzi salvati, condiviso da tutti i dispositivi collegati al server.
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');

const store = createStore({
  file: process.env.DECKS_FILE || path.join(__dirname, 'data', 'decks.json'),
  remoteKey: 'tavolo-commander:decks',
});

const str = (v, max) => String(v ?? '').trim().slice(0, max);

function cleanList(list) {
  const out = [];
  for (const e of Array.isArray(list) ? list.slice(0, 300) : []) {
    const name = str(e?.name, 150);
    const count = Math.max(1, Math.min(99, Math.trunc(Number(e?.count)) || 1));
    if (name) out.push({ name, count });
  }
  return out;
}

function clean(input) {
  return {
    name: str(input.name, 60) || 'Nuovo mazzo',
    author: str(input.author, 24),
    commanders: (Array.isArray(input.commanders) ? input.commanders : []).map((n) => str(n, 150)).filter(Boolean).slice(0, 2),
    cards: cleanList(input.cards),
    maybe: cleanList(input.maybe), // carte "forse", come il side deck di YGOPro
  };
}

function summary(d) {
  return {
    id: d.id,
    name: d.name,
    author: d.author,
    owner: d.owner || null,
    commanders: d.commanders,
    count: d.cards.reduce((s, e) => s + e.count, 0) + d.commanders.length,
    updated: d.updated,
  };
}

module.exports = {
  init: (opts) => store.init(opts),
  flush: () => store.flush(),
  list: () => Object.values(store.value).sort((a, b) => b.updated - a.updated).map(summary),
  get: (id) => store.value[id] || null,
  // owner: id dell'utente che ha creato il mazzo; un mazzo esistente non cambia mai proprietario
  put(id, input, owner = null) {
    const deckId = id && /^[a-f0-9]{12}$/.test(id) ? id : crypto.randomBytes(6).toString('hex');
    const previous = store.value[deckId];
    store.value[deckId] = { id: deckId, ...clean(input), owner: previous ? previous.owner || null : owner, updated: Date.now() };
    store.save();
    return store.value[deckId];
  },
  remove(id) {
    if (!store.value[id]) return false;
    delete store.value[id];
    store.save();
    return true;
  },
};
