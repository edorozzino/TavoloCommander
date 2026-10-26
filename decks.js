// Archivio dei mazzi salvati, condiviso da tutti i dispositivi collegati al server.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, 'data', 'decks.json');

let decks = {};
try {
  decks = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  decks = {};
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(decks, null, 1));
  fs.renameSync(tmp, FILE);
}

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
    commanders: d.commanders,
    count: d.cards.reduce((s, e) => s + e.count, 0) + d.commanders.length,
    updated: d.updated,
  };
}

module.exports = {
  list: () => Object.values(decks).sort((a, b) => b.updated - a.updated).map(summary),
  get: (id) => decks[id] || null,
  put(id, input) {
    const deckId = id && /^[a-f0-9]{12}$/.test(id) ? id : crypto.randomBytes(6).toString('hex');
    decks[deckId] = { id: deckId, ...clean(input), updated: Date.now() };
    save();
    return decks[deckId];
  },
  remove(id) {
    if (!decks[id]) return false;
    delete decks[id];
    save();
    return true;
  },
};
