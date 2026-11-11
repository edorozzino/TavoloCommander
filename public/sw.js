// Service worker: l'interfaccia resta disponibile anche quando il server non risponde.
// Le partite richiedono comunque il server (WebSocket): senza, l'app mostra un avviso.
const VERSION = 'tavolo-commander-v21';
const SHELL = [
  '/', '/index.html', '/style.css', '/app.js', '/builder.js', '/auto.js', '/mobile.js', '/fx.js', '/vendor/qrcode.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg',
];
const SHARED_ASSETS = ['svgs.scryfall.io', 'fonts.googleapis.com', 'fonts.gstatic.com']; // simboli di mana e caratteri

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cachedPage = (req) => caches.match(req).then((hit) => hit || caches.match('/index.html'));

async function isHostingPlaceholder(req, res) {
  const type = res.headers.get('content-type') || '';
  if (req.mode !== 'navigate') return type.includes('text/html') && /\.(css|js|svg|png|webmanifest)$/.test(new URL(req.url).pathname);
  if (!res.ok || !type.includes('text/html') || new URL(res.url).pathname === '/login') return false; // 401 = pagina di ingresso vera
  return !(await res.clone().text()).includes('id="boot"');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return; // dati sempre dal server
    if (/^\/(login|admin|invito)(\/|$)/.test(url.pathname)) return; // accesso: mai in cache, i link d'invito sono segreti
    // prima la rete (così gli aggiornamenti arrivano subito), poi la cache
    event.respondWith(
      fetch(req).then(async (res) => {
        // Un hosting addormentato risponde con la sua pagina di attesa: non va messa in cache al posto dei nostri file
        if (await isHostingPlaceholder(req, res)) return (await cachedPage(req)) || res;
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cachedPage(req)),
    );
    return;
  }
  if (SHARED_ASSETS.includes(url.hostname)) {
    // simboli e caratteri cambiano raramente: dalla cache, aggiornando in background
    event.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    }));
  }
});
