// Scenari di test: partite già pronte con mazzi semplici, così ogni test descrive solo ciò che gli serve.
const { createGame } = require('../engine');

const repeat = (name, n) => Array(n).fill(name);

// Partita Commander con N giocatori (A, B, C, D…), ciascuno con 99 terre base e un comandante
function commanderGame({ players = 4, seed = 1, land = 'Forest', commander = 'Krenko, Mob Boss', librarySize = 99, ...options } = {}) {
  const ids = ['A', 'B', 'C', 'D'].slice(0, players);
  return createGame({
    seed,
    players: ids.map((id) => ({ id, commanders: [commander], library: repeat(land, librarySize) })),
    ...options,
  });
}

// Scelte predefinite per le decisioni che il test non vuole controllare: nessun attacco, nessun blocco,
// scarto delle prime carte della mano
function autoDecide(game) {
  const d = game.decision;
  if (d.type === 'declareAttackers') game.perform(d.player, { type: 'declareAttackers', attackers: [] });
  else if (d.type === 'declareBlockers') game.perform(d.player, { type: 'declareBlockers', blocks: [] });
  else if (d.type === 'discard') game.perform(d.player, { type: 'discard', objects: game.zone(d.player, 'hand').slice(0, d.count).map((o) => o.id) });
  else if (d.type === 'chooseTarget') game.perform(d.player, { type: 'chooseTarget', target: d.optional ? null : d.options[0] });
  else if (d.type === 'confirm') game.perform(d.player, { type: 'confirm', yes: true });
  else if (d.type === 'search') game.perform(d.player, { type: 'search', objects: d.options.slice(0, d.max) });
  else if (d.type === 'scry') game.perform(d.player, { type: 'scry', top: d.cards, bottom: [] });
  else if (d.type === 'putBack') game.perform(d.player, { type: 'putBack', objects: game.zone(d.player, 'hand').slice(0, d.count).map((o) => o.id) });
  else if (d.type === 'chooseCards') game.perform(d.player, { type: 'chooseCards', objects: d.options.slice(0, d.count) });
  else if (d.type === 'chooseSacrifice') game.perform(d.player, { type: 'chooseSacrifice', object: d.options[0] });
  else throw new Error(`Decisione non gestita: ${d.type}`);
}

// Tutti i giocatori passano la priorità finché non cambia il passo o la Pila si risolve
function passAll(game) {
  const where = () => `${game.turn}/${game.step}/${game.stack.map((o) => o.id).join(',')}`;
  const start = where();
  for (let i = 0; i < 12 && where() === start && (game.priority || game.decision); i++) {
    if (game.decision && i > 0) return; // una decisione nata adesso la lascio al test
    if (game.decision) autoDecide(game);
    else game.perform(game.priority, { type: 'pass' });
  }
}

// Porta la partita alla dichiarazione degli attaccanti e attacca: attackers = [[id, difensore], …]
function attackWith(game, attackers) {
  advanceTo(game, 'declareAttackers');
  game.perform(game.active, { type: 'declareAttackers', attackers: attackers.map(([object, defender]) => ({ object, defender })) });
}

// Avanza fino a un passo preciso del turno indicato
function advanceTo(game, step, turn = game.turn) {
  for (let guard = 0; guard < 500; guard++) {
    if (game.step === step && game.turn === turn) return;
    passAll(game);
  }
  throw new Error(`Passo ${step} del turno ${turn} non raggiunto`);
}

// Mette sul campo le terre indicate e le tappa tutte, riempiendo il mana pool
function addMana(game, pid, lands) {
  for (const name of lands) {
    const id = game.setup.putOnBattlefield(pid, name);
    game.perform(pid, { type: 'activateMana', object: id });
  }
}

// Mette una carta in mano, aggiunge il mana indicato e la lancia
function castCard(game, pid, name, mana = [], extra = {}) {
  const id = game.setup.putInHand(pid, name);
  addMana(game, pid, mana);
  game.perform(pid, { type: 'cast', object: id, ...extra });
  return id;
}

// Passa finché la Pila non è vuota, gestendo le decisioni con le scelte predefinite
function resolveAll(game) {
  for (let i = 0; i < 50 && (game.stack.length || game.decision); i++) {
    if (game.decision) autoDecide(game);
    else game.perform(game.priority, { type: 'pass' });
  }
}

const tokensOf = (game, pid) => game.zone(pid, 'battlefield').filter((o) => o.isToken);
const named = (game, pid, zone, name) => game.zone(pid, zone).filter((o) => o.name === name);

module.exports = { commanderGame, passAll, advanceTo, addMana, attackWith, castCard, resolveAll, tokensOf, named, repeat };
