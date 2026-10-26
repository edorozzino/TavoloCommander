// CR 107.4 (simboli di mana), 601.2f-h (pagamento dei costi)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCost, canPay, pay, emptyPool } = require('../engine/mana');

test('interpreta un costo con mana generico e colorato', () => {
  assert.deepEqual(parseCost('{2}{R}{R}'), { generic: 2, W: 0, U: 0, B: 0, R: 2, G: 0, C: 0 });
});

test('un costo vuoto non richiede mana', () => {
  assert.deepEqual(parseCost(''), emptyPool({ generic: 0 }));
});

test('si può pagare quando il colore richiesto è presente', () => {
  assert.equal(canPay({ ...emptyPool(), R: 2, G: 1 }, parseCost('{1}{R}{R}')), true);
});

test('non si può pagare se manca un simbolo colorato, anche con abbastanza mana totale', () => {
  assert.equal(canPay({ ...emptyPool(), R: 1, G: 2 }, parseCost('{1}{R}{R}')), false);
});

test('il generico si paga prima con il mana incolore, conservando i colori', () => {
  const left = pay({ ...emptyPool(), R: 2, G: 1, C: 1 }, parseCost('{1}{R}'));
  assert.deepEqual(left, { ...emptyPool(), R: 1, G: 1 });
});

test('{C} richiede mana incolore, non un colore qualsiasi', () => {
  assert.equal(canPay({ ...emptyPool(), G: 3 }, parseCost('{C}')), false);
  assert.equal(canPay({ ...emptyPool(), C: 1 }, parseCost('{C}')), true);
});

test('pagare un costo non pagabile è un errore', () => {
  assert.throws(() => pay({ ...emptyPool(), G: 1 }, parseCost('{R}')), /mana/i);
});
