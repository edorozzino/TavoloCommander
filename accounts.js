// Accesso su invito: l'admin crea link monouso, chi ne usa uno diventa un utente con un ruolo e una sessione revocabile.
// Nell'archivio finiscono solo gli hash di link e sessioni: chi legge il database non può usarli per entrare.
const crypto = require('crypto');
const path = require('path');
const { createStore } = require('./store');
const { createAuth } = require('./auth');

const ROLES = ['player', 'guest'];
const INVITE_LIFETIME = 48 * 3600 * 1000;
const SESSION_COOKIE = 'tavolo_session';
const ONE_YEAR = 365 * 24 * 3600;
const ADMIN = { id: 'admin', name: 'Admin', role: 'admin' };
const INVITE_LINK = /\/invito\/([a-f0-9]{64})\b/;

const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
const empty = () => ({ users: {}, sessions: {}, invites: {} });

class AccountError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function createAccounts({ store, now = Date.now }) {
  const data = () => store.value;
  const liveInvite = (id) => {
    const invite = data().invites[id];
    return invite && invite.expires > now() ? invite : null;
  };
  const nameTaken = (name) => Object.values(data().users).some((u) => u.name.toLowerCase() === name.toLowerCase());

  function pruneInvites() {
    for (const [id, invite] of Object.entries(data().invites)) if (invite.expires <= now()) delete data().invites[id];
  }

  return {
    createInvite(role) {
      if (!ROLES.includes(role)) throw new AccountError('BAD_ROLE', 'Ruolo non valido');
      pruneInvites();
      const token = newToken();
      const id = hash(token);
      data().invites[id] = { role, expires: now() + INVITE_LIFETIME };
      store.save();
      return { id, token, role, expires: data().invites[id].expires };
    },
    isInviteValid: (token) => Boolean(liveInvite(hash(token))),
    // Il link si consuma solo qui, quando l'invitato conferma il nome: le anteprime di WhatsApp lo aprono soltanto
    redeem(token, rawName) {
      const id = hash(token);
      const invite = liveInvite(id);
      if (!invite) throw new AccountError('INVITE_INVALID', 'Questo invito è già stato usato o è scaduto');
      const name = String(rawName ?? '').trim().slice(0, 24);
      if (!name) throw new AccountError('NAME_REQUIRED', 'Scegli un nome');
      if (name.toLowerCase() === ADMIN.name.toLowerCase() || nameTaken(name)) throw new AccountError('NAME_TAKEN', 'Questo nome è già in uso');
      delete data().invites[id];
      const user = { id: crypto.randomBytes(8).toString('hex'), name, role: invite.role, created: now() };
      data().users[user.id] = user;
      const session = newToken();
      data().sessions[hash(session)] = { userId: user.id };
      store.save();
      return { user, session };
    },
    userForSession(token) {
      if (!token) return null;
      const session = data().sessions[hash(token)];
      return (session && data().users[session.userId]) || null;
    },
    state() {
      pruneInvites();
      return {
        users: Object.values(data().users).sort((a, b) => a.name.localeCompare(b.name)),
        invites: Object.entries(data().invites).map(([id, i]) => ({ id, role: i.role, expires: i.expires })),
      };
    },
    cancelInvite(id) {
      if (!data().invites[id]) return false;
      delete data().invites[id];
      store.save();
      return true;
    },
    setRole(id, role) {
      if (!ROLES.includes(role)) throw new AccountError('BAD_ROLE', 'Ruolo non valido');
      if (!data().users[id]) return false;
      data().users[id].role = role;
      store.save();
      return true;
    },
    removeUser(id) {
      if (!data().users[id]) return false;
      delete data().users[id];
      for (const [key, s] of Object.entries(data().sessions)) if (s.userId === id) delete data().sessions[key];
      store.save();
      return true;
    },
  };
}

function createAccountsStore() {
  return createStore({ file: process.env.ACCOUNTS_FILE || path.join(__dirname, 'data', 'accounts.json'), remoteKey: 'tavolo-commander:accounts', empty });
}

// Stessa interfaccia di createAuth: l'admin entra con la password, gli altri con la sessione creata dall'invito
function createAccountAuth(adminPassword, accounts) {
  const admin = createAuth(adminPassword);
  const user = (req) => (admin.isAuthorized(req) ? ADMIN : accounts.userForSession(admin.cookies(req)[SESSION_COOKIE]));
  return {
    ...admin,
    inviteOnly: true,
    user,
    isAuthorized: (req) => Boolean(user(req)),
    isPublic: (pathname) => admin.isPublic(pathname) || pathname.startsWith('/invito/'),
    sessionCookie(req, session) {
      const https = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
      return `${SESSION_COOKIE}=${session}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`;
    },
  };
}

// Senza account (user null) valgono le regole di sempre: chi è entrato può fare tutto
const canCreateDeck = (user) => !user || user.role !== 'guest';
const canEditDeck = (user, deck) => !user || user.role === 'admin' || (user.role === 'player' && Boolean(deck.owner) && deck.owner === user.id);

module.exports = { createAccounts, createAccountsStore, createAccountAuth, canCreateDeck, canEditDeck, AccountError, INVITE_LINK, ROLES };
