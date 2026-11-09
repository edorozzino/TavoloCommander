// Chiude i tavoli rimasti senza nessuno collegato: restano in memoria per sempre se i giocatori chiudono l'app senza uscire.
const EMPTY_TABLE_TTL = 30 * 60 * 1000;

function sweepRooms(rooms, close, now = Date.now(), ttl = EMPTY_TABLE_TTL) {
  for (const room of [...rooms.values()]) {
    if (room.sockets.size) {
      room.emptySince = null;
      continue;
    }
    room.emptySince ??= now;
    if (now - room.emptySince >= ttl) close(room);
  }
}

module.exports = { sweepRooms, EMPTY_TABLE_TTL };
