// Archivio JSON su file, con copia facoltativa su un database Upstash Redis per gli hosting con disco non permanente:
// il file locale resta la copia di lavoro, il database quella che sopravvive ai riavvii.
const fs = require('fs');
const path = require('path');

const PUSH_ATTEMPTS = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createStore({ file, remoteKey, empty = () => ({}) }) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    value = empty();
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const remoteEnabled = Boolean(url && token);
  let dirty = false;
  let pushing = null;

  async function command(args) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`Upstash ha risposto ${res.status}`);
    return (await res.json()).result;
  }

  function writeFile() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 1));
    fs.renameSync(tmp, file);
  }

  // Le scritture si accorpano: si manda sempre lo stato più recente, una richiesta alla volta
  function push(retryMs = 2000) {
    if (!remoteEnabled) return;
    dirty = true;
    pushing ||= (async () => {
      let failures = 0;
      while (dirty) {
        dirty = false;
        try {
          await command(['SET', remoteKey, JSON.stringify(value)]);
          failures = 0;
        } catch (err) {
          dirty = true;
          failures++;
          console.error(`Salvataggio su database non riuscito (${failures}/${PUSH_ATTEMPTS}): ${err.message}`);
          if (failures >= PUSH_ATTEMPTS) { dirty = false; break; }
          await sleep(retryMs);
        }
      }
    })().finally(() => { pushing = null; });
  }

  return {
    get value() { return value; },
    // Da chiamare prima di aprire il server. Se il database è configurato ma non risponde l'avvio fallisce:
    // partire con un archivio vuoto sovrascriverebbe i dati salvati alla prima scrittura.
    async init({ attempts = 5, retryMs = 2000 } = {}) {
      if (!remoteEnabled) return;
      for (let i = 1; ; i++) {
        try {
          const stored = await command(['GET', remoteKey]);
          if (stored == null) {
            if (Object.keys(value).length) await command(['SET', remoteKey, JSON.stringify(value)]);
          } else {
            value = JSON.parse(stored);
            writeFile();
          }
          return;
        } catch (err) {
          if (i >= attempts) throw new Error(`Database non raggiungibile: ${err.message}`);
          await sleep(retryMs);
        }
      }
    },
    save() {
      writeFile();
      push();
    },
    flush: () => pushing || Promise.resolve(),
  };
}

module.exports = { createStore };
