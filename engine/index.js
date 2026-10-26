// Motore delle regole Commander: punto d'ingresso.
const { Game } = require('./game');

const createGame = (options) => new Game(options);

module.exports = { createGame };
