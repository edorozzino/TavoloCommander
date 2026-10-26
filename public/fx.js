// Animazioni della vista Arena. Le schermate vengono ridisegnate da zero a ogni aggiornamento della partita:
// prima di ridisegnare si fotografa dove stava ogni carta (capture), dopo si confronta e si anima la differenza (play).
// Le carte animabili hanno data-fx="<chiave stabile>", le zone data-fx-area, i punti vita data-fx-life + data-v.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(.2, .8, .2, 1)';
  let snap = null;
  const hints = new Map(); // chiave -> rettangolo da cui far partire la carta (dove l'ha lasciata il trascinamento)

  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  document.body.appendChild(layer);

  const enabled = () => document.documentElement.classList.contains('compact') && !reduced.matches;
  const transformOf = (el) => { const t = getComputedStyle(el).transform; return t === 'none' ? '' : t; };
  const areaOf = (el) => el.closest('[data-fx-area]')?.dataset.fxArea || '';
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  function capture() {
    if (!enabled()) { snap = null; return; }
    const cards = new Map();
    for (const el of document.querySelectorAll('[data-fx]')) {
      if (!el.getClientRects().length) continue;
      cards.set(el.dataset.fx, {
        el, rect: el.getBoundingClientRect(), w: el.offsetWidth, h: el.offsetHeight, t: transformOf(el), area: areaOf(el),
        classes: new Set(el.classList), dmg: Number(el.dataset.fxDmg || 0), token: el.dataset.fxToken === '1',
      });
    }
    const lives = new Map([...document.querySelectorAll('[data-fx-life]')].map((el) => [el.dataset.fxLife, Number(el.dataset.v)]));
    const areas = new Set([...document.querySelectorAll('[data-fx-area]')].map((el) => el.dataset.fxArea));
    snap = { cards, lives, areas };
  }

  // where(chiave) dice dove è finita una carta che non si vede più: 'graveyard', 'exile' o altro
  function play({ where = () => null } = {}) {
    const before = snap;
    snap = null;
    if (!before || !enabled()) { hints.clear(); return; }
    const areasNow = new Set([...document.querySelectorAll('[data-fx-area]')].map((el) => el.dataset.fxArea));
    const seen = new Set();

    for (const el of document.querySelectorAll('[data-fx]')) {
      const key = el.dataset.fx;
      seen.add(key);
      const old = before.cards.get(key);
      const hint = hints.get(key);
      if (old || hint) {
        const from = hint ? { rect: hint, w: hint.width, h: hint.height, t: '' } : old;
        flip(el, from, old && old.area !== areaOf(el) && areaOf(el).startsWith('f'));
        if (old) {
          const dmg = Number(el.dataset.fxDmg || 0);
          if (dmg > old.dmg) hit(el, dmg - old.dmg);
          if (el.classList.contains('attacking') && !old.classes.has('attacking')) lunge(el);
        }
      } else if (before.areas.has(areaOf(el))) {
        enter(el);
      }
    }
    hints.clear();

    for (const [key, old] of before.cards) {
      if (seen.has(key) || !areasNow.has(old.area)) continue; // ancora visibile, o la sua zona non è più a schermo
      const dest = where(key); // null se non si sa (grimorio, mano nascosta, token sparito)
      if (dest === 'stack') continue; // magia lanciata: ci pensa spotlight
      if (dest === 'exile') ghost(old, 'fx-exile', 700);
      else if (dest === 'graveyard' || (!dest && old.token)) burn(old);
      else ghost(old, 'fx-away', 400);
    }

    for (const el of document.querySelectorAll('[data-fx-life]')) {
      const prev = before.lives.get(el.dataset.fxLife);
      const now = Number(el.dataset.v);
      if (prev != null && now !== prev) lifeChange(el, now - prev);
    }
  }

  // ---------- Singoli effetti ----------
  function flip(el, from, landed) {
    const to = el.getBoundingClientRect();
    const a = center(from.rect);
    const b = center(to);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const s = el.offsetWidth ? from.w / el.offsetWidth : 1;
    const t = transformOf(el);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < .02 && from.t === t) return;
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) ${from.t}`, zIndex: 20 },
      { transform: t || 'none', zIndex: 20 },
    ], { duration: 420, easing: EASE });
    if (landed) setTimeout(() => ring(el, 'fx-ring'), 380);
  }

  function enter(el) {
    const t = transformOf(el);
    if (el.closest('.mg-hand')) { // pescata: la carta sale dal fondo
      el.animate([{ transform: `translateY(120%) ${t}`, opacity: 0 }, { transform: t || 'none', opacity: 1 }], { duration: 380, easing: EASE });
      return;
    }
    el.animate([
      { transform: `scale(1.5) ${t}`, opacity: 0, filter: 'brightness(2)', easing: 'ease-in' },
      { transform: `scale(.94) ${t}`, opacity: 1, filter: 'brightness(1.3)', offset: .7, easing: 'ease-out' },
      { transform: t || 'none', opacity: 1, filter: 'none' },
    ], { duration: 460 });
    setTimeout(() => ring(el, 'fx-ring'), 320);
  }

  function lunge(el) {
    const t = transformOf(el);
    const up = el.closest('.mg-opp') ? 1 : -1; // le creature avversarie scendono verso di te, le tue salgono
    el.animate([
      { transform: t || 'none', easing: 'ease-out' },
      { transform: `${t} translateY(${up * 26}px) scale(1.12)`, filter: 'drop-shadow(0 0 12px #ff4a3d)', offset: .45, easing: 'ease-in' },
      { transform: t || 'none' },
    ], { duration: 520 });
    ring(el, 'fx-ring fx-ring-red');
  }

  function hit(el, amount) {
    const t = transformOf(el);
    el.animate([
      { transform: `${t} translateX(0)` }, { transform: `${t} translateX(-6px)`, filter: 'brightness(1.8) saturate(2) hue-rotate(-30deg)' },
      { transform: `${t} translateX(6px)` }, { transform: `${t} translateX(-3px)` }, { transform: `${t} translateX(0)` },
    ], { duration: 360 });
    floatText(el, `−${amount}`, 'fx-num-dmg');
    slash(el);
  }

  function lifeChange(el, delta) {
    floatText(el, delta > 0 ? `+${delta}` : `−${-delta}`, delta > 0 ? 'fx-num-gain' : 'fx-num-dmg');
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)', filter: delta > 0 ? 'drop-shadow(0 0 8px #5fd38a)' : 'drop-shadow(0 0 8px #ff4a3d)' }, { transform: 'scale(1)' }], { duration: 450 });
    if (delta < 0 && el.classList.contains('mg-life')) vignette();
  }

  // Copia della carta sparita, lasciata dov'era per il tempo dell'animazione
  function ghostOf(old) {
    const g = old.el.cloneNode(true);
    g.classList.add('fx-ghost');
    Object.assign(g.style, {
      left: `${old.rect.left + old.rect.width / 2 - old.w / 2}px`, top: `${old.rect.top + old.rect.height / 2 - old.h / 2}px`,
      width: `${old.w}px`, height: `${old.h}px`, transform: old.t || 'none', margin: 0,
    });
    layer.appendChild(g);
    return g;
  }

  function ghost(old, cls, ms) {
    const g = ghostOf(old);
    g.classList.add(cls);
    setTimeout(() => g.remove(), ms);
  }

  // Distruzione: la carta si accende, brucia dal basso verso l'alto e lascia braci
  function burn(old) {
    const g = ghostOf(old);
    g.animate([
      { clipPath: 'inset(0 0 0 0)', filter: 'brightness(1)' },
      { clipPath: 'inset(0 0 0 0)', filter: 'brightness(1.8) sepia(1) saturate(4) hue-rotate(-25deg)', offset: .3, easing: 'ease-in' },
      { clipPath: 'inset(0 0 100% 0)', filter: 'brightness(.6) sepia(1) saturate(4) hue-rotate(-25deg)' },
    ], { duration: 1000, fill: 'forwards' });
    const r = old.rect;
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('span');
      p.className = 'fx-ember';
      p.style.left = `${r.left + Math.random() * r.width}px`;
      p.style.top = `${r.top + r.height * (.3 + Math.random() * .7)}px`;
      layer.appendChild(p);
      p.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${(Math.random() - .5) * 60}px, ${-40 - Math.random() * 70}px) scale(.3)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 600, delay: 200 + Math.random() * 500, easing: 'ease-out', fill: 'both' }).onfinish = () => p.remove();
    }
    setTimeout(() => g.remove(), 1050);
  }

  function ring(el, cls) {
    const r = el.getBoundingClientRect();
    const d = document.createElement('span');
    d.className = cls;
    const size = Math.max(r.width, r.height) * 1.3;
    Object.assign(d.style, { left: `${r.left + r.width / 2 - size / 2}px`, top: `${r.top + r.height / 2 - size / 2}px`, width: `${size}px`, height: `${size}px` });
    layer.appendChild(d);
    setTimeout(() => d.remove(), 600);
  }

  function slash(el) {
    const r = el.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'fx-slash';
    Object.assign(s.style, { left: `${r.left - r.width * .1}px`, top: `${r.top + r.height / 2}px`, width: `${r.width * 1.2}px` });
    layer.appendChild(s);
    setTimeout(() => s.remove(), 450);
  }

  function floatText(el, text, cls) {
    const r = el.getBoundingClientRect();
    const n = document.createElement('span');
    n.className = `fx-num ${cls}`;
    n.textContent = text;
    n.style.left = `${r.left + r.width / 2}px`;
    n.style.top = `${r.top - 28}px`; // sopra l'elemento, per non coprire il numero vero
    layer.appendChild(n);
    setTimeout(() => n.remove(), 1100);
  }

  function vignette() {
    const v = document.createElement('div');
    v.className = 'fx-vignette';
    layer.appendChild(v);
    setTimeout(() => v.remove(), 700);
  }

  // Scritta grande al centro, per esempio all'inizio del proprio turno
  function banner(text) {
    if (!enabled()) return;
    const b = document.createElement('div');
    b.className = 'fx-banner';
    b.innerHTML = `<span>${text}</span>`;
    layer.appendChild(b);
    setTimeout(() => b.remove(), 1500);
  }

  // Magia lanciata: la carta appare grande al centro e poi vola verso la Pila
  function spotlight(img, targetSel) {
    if (!enabled() || !img) return;
    const c = document.createElement('img');
    c.className = 'fx-spot';
    c.src = img;
    c.alt = '';
    // si parte quando l'immagine è pronta, altrimenti l'animazione scorrerebbe su un riquadro vuoto
    c.decode().catch(() => {}).then(() => {
      layer.appendChild(c);
      spotlightRun(c, targetSel);
    });
  }

  function spotlightRun(c, targetSel) {
    const target = targetSel && document.querySelector(targetSel)?.getBoundingClientRect();
    const fly = target ? `translate(${center(target).x - innerWidth / 2}px, ${center(target).y - innerHeight / 2}px) scale(.15)` : 'scale(.6)';
    // l'accelerazione va su ogni tratto: messa sull'intera animazione la farebbe arrivare subito alla fine
    c.animate([
      { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0, easing: EASE },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: .2 },
      { transform: 'translate(-50%, -50%) scale(1.03)', opacity: 1, offset: .75, easing: 'ease-in' },
      { transform: `translate(-50%, -50%) ${fly}`, opacity: 0 },
    ], { duration: 1300, fill: 'forwards' }).onfinish = () => c.remove();
  }

  window.FX = { capture, play, banner, spotlight, hint: (key, rect) => hints.set(key, rect) };
})();
