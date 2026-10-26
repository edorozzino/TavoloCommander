// Errore di regola: il codice serve all'interfaccia per spiegare "perché no?" al giocatore.
class RuleError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = { RuleError };
