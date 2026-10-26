// Accademia: ogni lezione si supera seguendo la soluzione prevista e il Maestro gioca le sue mosse
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LESSONS, startLesson, lessonAct, lessonStatus } = require('../lessons');

const find = (g, pid, zone, name) => g.zone(pid, zone).find((o) => o.name === name)?.id
  ?? g.battlefield().find((o) => o.controller === pid && o.name === name && zone === 'battlefield')?.id;
const pass = { type: 'pass' };
// passa finché non si raggiunge il passo indicato del proprio turno (o una decisione propria)
function passUntil(s, step) {
  for (let i = 0; i < 60 && !(s.game.step === step && s.game.priority === 'tu') && !s.game.decision; i++) lessonAct(s, pass);
}

test('ci sono 8 lezioni numerate, ciascuna con titolo, obiettivo e introduzione', () => {
  assert.deepEqual(LESSONS.map((l) => l.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const l of LESSONS) assert.ok(l.title && l.goal && l.intro, l.id);
});

test('ogni lezione all\'inizio dà un suggerimento e non è già superata', () => {
  for (const l of LESSONS) {
    const s = startLesson(l.id);
    const st = lessonStatus(s);
    assert.equal(st.done, false, l.id);
    assert.ok(st.hint.length > 10, l.id);
  }
});

test('lezione 1: giocare una terra e lanciare una creatura', () => {
  const s = startLesson('zone');
  lessonAct(s, { type: 'playLand', object: find(s.game, 'tu', 'hand', 'Forest') });
  lessonAct(s, { type: 'cast', object: find(s.game, 'tu', 'hand', 'Grizzly Bears'), autoPay: true });
  assert.match(lessonStatus(s).hint, /Pila/);
  lessonAct(s, pass);
  assert.equal(lessonStatus(s).done, true);
});

test('lezione 2: pagare una magia di due colori, anche tappando le terre a mano', () => {
  const s = startLesson('mana');
  lessonAct(s, { type: 'activateMana', object: find(s.game, 'tu', 'battlefield', 'Plains') });
  lessonAct(s, { type: 'activateMana', object: find(s.game, 'tu', 'battlefield', 'Swamp') });
  lessonAct(s, { type: 'cast', object: find(s.game, 'tu', 'hand', 'Cruel Celebrant') });
  lessonAct(s, pass);
  assert.equal(lessonStatus(s).done, true);
});

test('lezione 3: arrivare alla fase principale del turno successivo; il Maestro gioca il suo turno', () => {
  const s = startLesson('turno');
  const hints = new Set();
  for (let i = 0; i < 80 && !lessonStatus(s).done; i++) {
    hints.add(lessonStatus(s).hint);
    if (s.game.decision) lessonAct(s, { type: 'discard', objects: s.game.zone('tu', 'hand').slice(0, s.game.decision.count).map((o) => o.id) });
    else lessonAct(s, pass);
  }
  assert.equal(lessonStatus(s).done, true);
  assert.ok(hints.size >= 5, 'i suggerimenti spiegano i diversi passi');
});

test('lezione 4: attaccare, il Maestro blocca, Giant Growth vince lo scontro', () => {
  const s = startLesson('combattimento');
  passUntil(s, 'declareAttackers');
  lessonAct(s, { type: 'declareAttackers', attackers: [{ object: find(s.game, 'tu', 'battlefield', 'Grizzly Bears'), defender: 'maestro' }] });
  passUntil(s, 'declareBlockers');
  const mine = find(s.game, 'tu', 'battlefield', 'Grizzly Bears');
  assert.equal(s.game.combat.attackers.get(mine).blocked, true);
  lessonAct(s, { type: 'cast', object: find(s.game, 'tu', 'hand', 'Giant Growth'), targets: [{ object: mine }], autoPay: true });
  passUntil(s, 'endCombat');
  assert.equal(lessonStatus(s).done, true);
});

test('lezione 4: senza Giant Growth i due orsi muoiono e la lezione si può ripetere', () => {
  const s = startLesson('combattimento');
  passUntil(s, 'declareAttackers');
  lessonAct(s, { type: 'declareAttackers', attackers: [{ object: find(s.game, 'tu', 'battlefield', 'Grizzly Bears'), defender: 'maestro' }] });
  passUntil(s, 'endCombat');
  const st = lessonStatus(s);
  assert.deepEqual([st.done, st.failed], [false, true]);
});

test('lezione 5: il Maestro lancia Lightning Bolt e tu rispondi con Giant Growth', () => {
  const s = startLesson('pila');
  lessonAct(s, pass); // il Maestro riceve la priorità e lancia il fulmine
  assert.equal(s.game.stack.at(-1)?.name, 'Lightning Bolt');
  assert.equal(s.game.priority, 'tu');
  lessonAct(s, { type: 'cast', object: find(s.game, 'tu', 'hand', 'Giant Growth'), targets: [{ object: find(s.game, 'tu', 'battlefield', 'Grizzly Bears') }], autoPay: true });
  for (let i = 0; i < 6 && s.game.stack.length; i++) lessonAct(s, pass);
  assert.equal(lessonStatus(s).done, true);
});

test('lezione 6: un innesco di entrata e un\'abilità attivata creano i Goblin', () => {
  const s = startLesson('abilita');
  lessonAct(s, { type: 'cast', object: find(s.game, 'tu', 'hand', 'Goblin Instigator'), autoPay: true });
  lessonAct(s, pass);
  lessonAct(s, pass);
  lessonAct(s, { type: 'activate', object: find(s.game, 'tu', 'battlefield', 'Krenko, Mob Boss') });
  lessonAct(s, pass);
  assert.equal(lessonStatus(s).done, true);
});

test('lezione 7: Volare, Legame vitale e Travolgere fanno il loro lavoro', () => {
  const s = startLesson('keyword');
  passUntil(s, 'declareAttackers');
  lessonAct(s, { type: 'declareAttackers', attackers: ['Vampire Nighthawk', 'Colossal Dreadmaw'].map((n) => ({ object: find(s.game, 'tu', 'battlefield', n), defender: 'maestro' })) });
  passUntil(s, 'endCombat');
  assert.equal(lessonStatus(s).done, true);
});

test('lezione 8: lanciare il comandante, vederlo tornare nella zona di comando e pagare la tassa', () => {
  const s = startLesson('comandante');
  const cmd = () => s.game.zone('tu', 'command')[0]?.id;
  lessonAct(s, { type: 'cast', object: cmd(), autoPay: true });
  lessonAct(s, pass); // Krenko si risolve
  lessonAct(s, pass); // il Maestro risponde con Lightning Bolt e Krenko torna nella zona di comando
  for (let i = 0; i < 6 && s.game.stack.length; i++) lessonAct(s, pass);
  assert.ok(cmd(), 'Krenko è tornato nella zona di comando');
  assert.match(lessonStatus(s).hint, /tassa/i);
  lessonAct(s, { type: 'cast', object: cmd(), autoPay: true });
  lessonAct(s, pass);
  assert.equal(lessonStatus(s).done, true);
});
