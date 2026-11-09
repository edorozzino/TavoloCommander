// Quando un giocatore umano passa da solo, sul modello di MTG Arena: il gioco si ferma solo se c'è una decisione che conta.
// canAct è una funzione perché calcolare le mosse possibili è costoso e spesso non serve.

const COMBAT_WINDOWS = new Set(['declareAttackers', 'declareBlockers']);
const inMyMain = (g, pid) => g.active === pid && (g.step === 'main1' || g.step === 'main2') && g.stack.length === 0;
const attacksDeclared = (g) => COMBAT_WINDOWS.has(g.step) && g.combat?.attackers.size > 0;

// "Passa fino a una risposta" si ferma quando un altro gioca qualcosa o c'è un attacco, se si può rispondere
function needsResponse(g, pid, canAct) {
  return (g.stack.some((o) => o.controller !== pid) || attacksDeclared(g)) && canAct();
}

// La modalità di passaggio ancora valida in questo momento
function nextPassMode(g, pid, player, canAct) {
  if (player.passMode === 'turn') return player.passTurn === g.turn ? 'turn' : null;
  if (player.passMode === 'response') return inMyMain(g, pid) || needsResponse(g, pid, canAct) ? null : 'response';
  return null;
}

function shouldAutoPass(g, pid, player, canAct) {
  if (player.passMode) return true;
  if (player.autoPass === false || inMyMain(g, pid)) return false;
  if (!canAct()) return true;
  // Si potrebbe agire: ci si ferma solo nei momenti in cui di solito si agisce davvero
  return !(g.stack.length || attacksDeclared(g) || (g.active !== pid && g.step === 'end'));
}

// Passare il turno vale anche come "non attacco"; le altre scelte restano sempre al giocatore
function autoAnswer(g, pid, player) {
  return player.passMode === 'turn' && g.decision.type === 'declareAttackers' && g.decision.player === pid
    ? { type: 'declareAttackers', attackers: [] }
    : null;
}

module.exports = { nextPassMode, shouldAutoPass, autoAnswer };
