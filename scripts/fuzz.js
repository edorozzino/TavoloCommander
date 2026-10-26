// Uso: node scripts/fuzz.js [partite=1000] [turni=25]
const { randomGame } = require('../test/simulator');

const games = Number(process.argv[2]) || 1000;
const maxTurns = Number(process.argv[3]) || 25;
const t0 = Date.now();
let accepted = 0;
let rejected = 0;
let finished = 0;
for (let seed = 1; seed <= games; seed++) {
  const s = randomGame(seed, { players: 2 + (seed % 3), maxTurns });
  accepted += s.accepted;
  rejected += s.rejected;
  if (s.winner) finished++;
}
console.log(`${games} partite senza crash in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`azioni accettate ${accepted}, rifiutate dalle regole ${rejected}, partite concluse con un vincitore ${finished}`);
