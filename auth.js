// Password di accesso facoltativa: con TAVOLO_PASSWORD impostata, sito, API e WebSocket richiedono il login.
// Il login lascia un cookie che vale finché la password non cambia.
const crypto = require('crypto');

const COOKIE = 'tavolo_auth';
const ONE_YEAR = 365 * 24 * 3600;
// Dopo troppi tentativi sbagliati il login si blocca per tutti: dietro Tailscale Funnel ogni richiesta arriva dallo stesso indirizzo
const MAX_FAILURES = 20;
const FAILURE_WINDOW = 10 * 60 * 1000;
const LOCK_TIME = 10 * 60 * 1000;
const WORDS = [
  'drago', 'goblin', 'elfo', 'fata', 'golem', 'sfinge', 'idra', 'grifone', 'angelo', 'demone', 'vampiro', 'zombie',
  'spirito', 'titano', 'kraken', 'fenice', 'chimera', 'gigante', 'nano', 'troll', 'orco', 'licantropo', 'leviatano', 'basilisco',
  'mago', 'strega', 'cavaliere', 'paladino', 'ladro', 'monaco', 'druido', 'sciamano', 'bardo', 'chierico', 'guerriero', 'arciere',
  'spada', 'scudo', 'lancia', 'ascia', 'arco', 'martello', 'corona', 'anello', 'amuleto', 'bacchetta', 'tomo', 'pergamena',
  'palude', 'isola', 'montagna', 'foresta', 'pianura', 'deserto', 'vulcano', 'ghiacciaio', 'caverna', 'torre', 'castello', 'rovina',
  'fiamma', 'gelo', 'tuono', 'fulmine', 'ombra', 'luce', 'nebbia', 'tempesta', 'marea', 'vento', 'cenere', 'cristallo',
  'rubino', 'zaffiro', 'smeraldo', 'diamante', 'onice', 'ambra', 'perla', 'giada', 'opale', 'topazio', 'quarzo', 'ossidiana',
  'lupo', 'corvo', 'serpente', 'orso', 'gufo', 'falco', 'tigre', 'leone', 'ragno', 'scorpione', 'pantera', 'cervo',
  'pozione', 'rituale', 'incanto', 'maledizione', 'profezia', 'portale', 'reliquia', 'trono', 'stendardo', 'bastione', 'labirinto', 'santuario',
  'alba', 'tramonto', 'eclissi', 'cometa', 'stella', 'luna', 'sole', 'aurora', 'abisso', 'oracolo', 'segreto', 'destino',
];

// Password facile da dettare a voce: tre parole a caso e un numero (circa 1,5·10⁸ combinazioni)
function generatePassword() {
  const word = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${word()}-${word()}-${word()}-${crypto.randomInt(10, 100)}`;
}

// Icone e manifest restano pubblici, così il browser può proporre l'installazione dell'app anche prima del login
const PUBLIC_PATHS = ['/manifest.webmanifest', '/login'];

function createAuth(password) {
  const enabled = Boolean(password);
  const token = enabled ? crypto.createHmac('sha256', password).update('tavolo-commander').digest('hex') : '';
  const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

  function cookies(req) {
    const out = {};
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function isAuthorized(req) {
    if (!enabled) return true;
    const given = cookies(req)[COOKIE];
    return Boolean(given) && crypto.timingSafeEqual(digest(given), digest(token));
  }

  function isPublic(pathname) {
    return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/icons/');
  }

  function checkPassword(given) {
    return enabled && crypto.timingSafeEqual(digest(given), digest(password));
  }

  let failures = [];
  let lockedUntil = 0;
  // 'ok', 'wrong' oppure 'locked' (troppi errori di recente)
  function attempt(given, now = Date.now()) {
    if (now < lockedUntil) return 'locked';
    if (checkPassword(given)) return 'ok';
    failures = failures.filter((t) => now - t < FAILURE_WINDOW);
    failures.push(now);
    if (failures.length >= MAX_FAILURES) {
      lockedUntil = now + LOCK_TIME;
      failures = [];
    }
    return 'wrong';
  }

  function loginCookie(req) {
    const https = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    return `${COOKIE}=${token}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`;
  }

  return { enabled, isAuthorized, isPublic, checkPassword, attempt, loginCookie };
}

function loginPage(error = '') {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tavolo Commander</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon.svg">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #14161c; color: #e8e8ec; font: 16px system-ui, sans-serif; }
  form { width: min(320px, calc(100vw - 32px)); display: grid; gap: 12px; }
  h1 { margin: 0 0 8px; font-size: 1.4rem; text-align: center; }
  input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #3a3e4a; }
  input { background: #1e2129; color: inherit; }
  button { background: #4f8fe0; border-color: #4f8fe0; color: #fff; cursor: pointer; }
  p { margin: 0; color: #e05252; text-align: center; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>Tavolo Commander</h1>
  <input type="password" name="password" placeholder="Password del tavolo" autocomplete="current-password" autofocus required>
  <button type="submit">Entra</button>
  ${error ? `<p>${error}</p>` : ''}
</form>
</body>
</html>`;
}

module.exports = { createAuth, loginPage, generatePassword };
