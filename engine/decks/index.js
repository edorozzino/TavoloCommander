// Mazzi iniziali pronti da giocare (vedi la specifica: uno per stile di gioco)
const goblins = require('./goblins');
const talrand = require('./talrand');
const ghalta = require('./ghalta');
const konrad = require('./konrad');

module.exports = { STARTER_DECKS: [goblins, talrand, ghalta, konrad] };
