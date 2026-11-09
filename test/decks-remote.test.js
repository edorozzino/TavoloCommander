// Archivio dei mazzi su database esterno, per gli hosting con disco non permanente
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MOD = require.resolve('../decks');
const KEY = 'tavolo-commander:decks';
const INPUT = { name: 'Goblin', commanders: ['Krenko, Mob Boss'], cards: [{ name: 'Mountain', count: 99 }] };
let dir, db, failing, calls, realFetch;

function load(local) {
  if (local) fs.writeFileSync(process.env.DECKS_FILE, JSON.stringify(local));
  delete require.cache[MOD];
  return require('../decks');
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'decks-'));
  process.env.DECKS_FILE = path.join(dir, 'decks.json');
  process.env.UPSTASH_REDIS_REST_URL = 'https://db.example';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'segreto';
  db = new Map();
  failing = 0;
  calls = [];
  realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const args = JSON.parse(opts.body);
    calls.push({ url, auth: opts.headers.Authorization, args });
    if (failing > 0) { failing--; return { ok: false, status: 503 }; }
    if (args[0] === 'SET') db.set(args[1], args[2]);
    return { ok: true, json: async () => ({ result: args[0] === 'GET' ? db.get(args[1]) ?? null : 'OK' }) };
  };
});

afterEach(() => {
  global.fetch = realFetch;
  for (const k of ['DECKS_FILE', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k];
  fs.rmSync(dir, { recursive: true, force: true });
  delete require.cache[MOD];
});

const deck = (id) => ({ id, name: id, author: '', commanders: [], cards: [], maybe: [], updated: 1 });

test('all\'avvio il database ha la precedenza sul file locale', async () => {
  db.set(KEY, JSON.stringify({ a: deck('a') }));
  const decks = load({ vecchio: deck('vecchio') });
  await decks.init();
  assert.deepEqual(decks.list().map((d) => d.id), ['a']);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(process.env.DECKS_FILE))), ['a']);
});

test('con il database vuoto i mazzi locali vengono copiati', async () => {
  const decks = load({ a: deck('a') });
  await decks.init();
  assert.deepEqual(Object.keys(JSON.parse(db.get(KEY))), ['a']);
});

test('salvare ed eliminare aggiorna il database, autenticandosi con il token', async () => {
  const decks = load();
  await decks.init();
  const saved = decks.put(null, INPUT);
  await decks.flush();
  assert.equal(JSON.parse(db.get(KEY))[saved.id].name, 'Goblin');
  assert.equal(calls.at(-1).auth, 'Bearer segreto');
  decks.remove(saved.id);
  await decks.flush();
  assert.deepEqual(JSON.parse(db.get(KEY)), {});
});

test('scritture ravvicinate: al database arriva lo stato finale', async () => {
  const decks = load();
  await decks.init();
  const ids = [1, 2, 3].map((n) => decks.put(null, { ...INPUT, name: `M${n}` }).id);
  await decks.flush();
  assert.deepEqual(Object.keys(JSON.parse(db.get(KEY))).sort(), [...ids].sort());
});

test('se il database non risponde all\'avvio il server non parte e non scrive nulla', async () => {
  failing = 99;
  const decks = load({ a: deck('a') });
  await assert.rejects(decks.init({ attempts: 2, retryMs: 0 }), /non raggiungibile/);
  assert.equal(calls.filter((c) => c.args[0] === 'SET').length, 0);
});

test('senza configurazione funziona solo con il file, senza chiamate di rete', async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  const decks = load();
  await decks.init();
  decks.put(null, INPUT);
  await decks.flush();
  assert.equal(calls.length, 0);
  assert.equal(decks.list().length, 1);
});
