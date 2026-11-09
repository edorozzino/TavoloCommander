// Pulizia dei tavoli senza nessuno collegato
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sweepRooms, EMPTY_TABLE_TTL: TTL } = require('../room-sweep');

const room = (code, online) => ({ code, sockets: new Set(online ? ['ws'] : []) });
function run(rooms, now) {
  const closed = [];
  sweepRooms(new Map(rooms.map((r) => [r.code, r])), (r) => closed.push(r.code), now);
  return closed;
}

test('un tavolo vuoto si chiude solo dopo 30 minuti', () => {
  const r = room('a', false);
  assert.deepEqual(run([r], 0), []);
  assert.deepEqual(run([r], TTL - 1), []);
  assert.deepEqual(run([r], TTL), ['a']);
});

test('un tavolo con qualcuno collegato non si chiude', () => {
  assert.deepEqual(run([room('a', true)], 10 * TTL), []);
});

test('se qualcuno torna il conteggio riparte', () => {
  const r = room('a', false);
  run([r], 0);
  r.sockets.add('ws');
  run([r], TTL - 1);
  r.sockets.clear();
  assert.deepEqual(run([r], TTL), []);
  assert.deepEqual(run([r], 2 * TTL), ['a']);
});
