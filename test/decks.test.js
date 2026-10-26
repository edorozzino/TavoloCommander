// Mazzi iniziali: validi per Commander e composti solo da carte che il motore conosce e che hanno un test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { CARDS, getCard } = require('../engine/cards');
const { colorIdentity } = require('../engine/identity');
const { STARTER_DECKS } = require('../engine/decks');

for (const deck of STARTER_DECKS) {
  test(`${deck.name}: esattamente 100 carte comandante incluso (CR 903.5a)`, () => {
    assert.equal(deck.cards.reduce((s, e) => s + e.count, 0) + 1, 100);
  });

  test(`${deck.name}: una sola copia di ogni carta tranne le terre base (CR 903.5b)`, () => {
    for (const e of deck.cards) if (e.count > 1) assert.ok(getCard(e.name).supertypes?.includes('Basic'), `${e.name} ×${e.count}`);
    const names = deck.cards.map((e) => e.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(!names.includes(deck.commander));
  });

  test(`${deck.name}: tutte le carte rispettano l'identità di colore del comandante (CR 903.5c)`, () => {
    const allowed = new Set(colorIdentity(getCard(deck.commander)));
    for (const e of deck.cards) {
      const outside = colorIdentity(getCard(e.name)).filter((c) => !allowed.has(c));
      assert.deepEqual(outside, [], `${e.name} è fuori identità`);
    }
  });

  test(`${deck.name}: il comandante è una creatura leggendaria (CR 903.3)`, () => {
    const c = getCard(deck.commander);
    assert.ok(c.supertypes?.includes('Legendary') && c.types.includes('Creature'));
  });
}

test('ogni carta definita nel motore compare in almeno un test', () => {
  const dir = __dirname;
  const text = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js') && f !== 'decks.test.js')
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const missing = Object.keys(CARDS).filter((n) => !text.includes(`'${n}'`) && !text.includes(`"${n}"`));
  assert.deepEqual(missing, []);
});

test("l'identità di colore considera costo e mana prodotto", () => {
  assert.deepEqual(colorIdentity(getCard('Krenko, Mob Boss')), ['R']);
  assert.deepEqual(colorIdentity(getCard('Sol Ring')), []);
  assert.deepEqual(colorIdentity(getCard('Mountain')), ['R']);
  assert.deepEqual(colorIdentity(getCard('Cruel Celebrant')), ['W', 'B']);
});
