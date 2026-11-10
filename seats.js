// A chi appartiene un posto al tavolo. L'identificativo del posto è noto a tutti i giocatori (serve per mostrare il
// tavolo), quindi da solo non basta per rientrare: serve la chiave segreta ricevuta sedendosi, oppure lo stesso account.
const crypto = require('crypto');

const newSeatKey = () => crypto.randomBytes(16).toString('hex');

function claimSeat(room, msg, user) {
  const players = [...room.players.values()];
  const mine = user && players.find((p) => p.userId === user.id);
  if (mine) return mine;
  const p = typeof msg.pid === 'string' ? room.players.get(msg.pid) : null;
  if (!p || !p.key || msg.key !== p.key) return null;
  if (p.userId && p.userId !== user?.id) return null;
  return p;
}

module.exports = { claimSeat, newSeatKey };
