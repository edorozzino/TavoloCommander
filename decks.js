// Archivio dei mazzi salvati, condiviso da tutti i dispositivi collegati al server.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.DECKS_FILE || path.join(__dirname, 'data', 'decks.json');

// Su un hosting con disco non permanente (Render gratuito) l'archivio vive anche in un database Upstash Redis:
// il file locale resta la copia di lavoro, il database quella che sopravvive ai riavvii.
const REMOTE_KEY = 'tavolo-commander:decks';
const remote = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  get enabled() { return !!(this.url && this.token); },
  async command(args) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`Upstash ha risposto ${res.status}`);
    return (await res.json()).result;
  },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PUSH_ATTEMPTS = 5;
let dirty = false;
let pushing = null;

// Le scritture si accorpano: si manda sempre lo stato più recente, una richiesta alla volta
function pushRemote(retryMs = 2000) {
  if (!remote.enabled) return Promise.resolve();
  dirty = true;
  pushing ||= (async () => {
    let failures = 0;
    while (dirty) {
      dirty = false;
      try {
        await remote.command(['SET', REMOTE_KEY, JSON.stringify(decks)]);
        failures = 0;
      } catch (err) {
        dirty = true;
        failures++;
        console.error(`Salvataggio dei mazzi sul database non riuscito (${failures}/${PUSH_ATTEMPTS}): ${err.message}`);
        if (failures >= PUSH_ATTEMPTS) { dirty = false; break; }
        await sleep(retryMs);
      }
    }
  })().finally(() => { pushing = null; });
  return pushing;
}

// Da chiamare prima di aprire il server. Se il database è configurato ma non risponde l'avvio fallisce:
// partire con l'archivio vuoto sovrascriverebbe i mazzi salvati al primo salvataggio.
async function init({ attempts = 5, retryMs = 2000 } = {}) {
  if (!remote.enabled) return;
  for (let i = 1; ; i++) {
    try {
      const stored = await remote.command(['GET', REMOTE_KEY]);
      if (stored == null) {
        if (Object.keys(decks).length) await remote.command(['SET', REMOTE_KEY, JSON.stringify(decks)]);
      } else {
        decks = JSON.parse(stored);
        save();
      }
      return;
    } catch (err) {
      if (i >= attempts) throw new Error(`Database dei mazzi non raggiungibile: ${err.message}`);
      await sleep(retryMs);
    }
  }
}

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

function persist() {
  save();
  pushRemote();
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
  init,
  flush: () => pushing || Promise.resolve(),
  list: () => Object.values(decks).sort((a, b) => b.updated - a.updated).map(summary),
  get: (id) => decks[id] || null,
  put(id, input) {
    const deckId = id && /^[a-f0-9]{12}$/.test(id) ? id : crypto.randomBytes(6).toString('hex');
    decks[deckId] = { id: deckId, ...clean(input), updated: Date.now() };
    persist();
    return decks[deckId];
  },
  remove(id) {
    if (!decks[id]) return false;
    delete decks[id];
    persist();
    return true;
  },
};
