// The services built once in stage 1, without a browser: the theme saved through the saved-work layer (and refused in a window
// that may not write), the assistant's name from the teacher's setting, undo, the shortcut registry and the command list.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const store = new Map();
before(() => {
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size; } };
  globalThis.document = { documentElement: { dataset: {} } };
  // No Locks API and no other windows: the lock lets this one write (lock.js 'writer-no-locks'), with nothing left running.
  Object.defineProperty(globalThis, 'navigator', { value: { platform: 'Linux' }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true, writable: true });
});

test('theme: Graphite by default, Midnight for a teacher who chose dark before, never written until chosen', async () => {
  const th = await import('../src/services/theme.js');
  store.clear(); assert.equal(th.savedLook(), 'graphite');
  store.set('gs.theme', '"dark"'); assert.equal(th.savedLook(), 'midnight');
  assert.ok(!store.has('gs.look'), 'reading the theme writes nothing');
  store.set('gs.look', '"plum"'); assert.equal(th.savedLook(), 'plum');
  store.set('gs.look', '"neon"'); assert.equal(th.savedLook(), 'midnight', 'an unknown theme is ignored');
  assert.equal(th.applyLook('ocean'), 'ocean'); assert.equal(document.documentElement.dataset.look, 'ocean');
  assert.equal(store.get('gs.look'), '"neon"', 'showing a theme saves nothing');
});
test('theme: saved only by a window that may write, through the lock', async () => {
  const th = await import('../src/services/theme.js'), lock = await import('../src/shared/lock.js');
  store.clear(); lock.stop();
  assert.equal(th.saveLook('ink'), false, 'a window without the lock does not save');
  assert.ok(!store.has('gs.look')); assert.equal(document.documentElement.dataset.look, 'ink', 'but shows it');
  await lock.start(); assert.ok(lock.isWriter());
  assert.equal(th.saveLook('porcelain'), true); assert.equal(store.get('gs.look'), '"porcelain"');
  assert.equal(store.get('gs.theme'), undefined, 'the current app’s own theme key is left alone');
  lock.stop();
});
test('the theme key is in the registry, on the planning side (teacher-wide settings, stage 2)', async () => {
  const { LOCAL, entryFor } = await import('../src/shared/keys.js');
  const e = entryFor('gs.look', LOCAL); assert.ok(e); assert.equal(e[1], 'planning'); assert.equal(e[2], 'pref');
});
test('assistant: name and link from the teacher’s words; none named means none', async () => {
  const { assistant, KNOWN } = await import('../src/services/assistant.js');
  store.clear(); assert.deepEqual(assistant(), { name: '', link: '', tab: false, known: false });
  store.set('gs.words', JSON.stringify({ ai: KNOWN[0][0] })); assert.equal(assistant().link, KNOWN[0][1]);
  store.set('gs.words', JSON.stringify({ ai: 'My school bot', link: 'https://bot.example.org/x', tab: true })); assert.deepEqual(assistant(), { name: 'My school bot', link: 'https://bot.example.org/x', tab: true, known: false });
  store.set('gs.words', JSON.stringify({ ai: 'Bot', link: 'javascript:alert(1)' })); assert.equal(assistant().link, '', 'only https links');
  store.set('gs.words', JSON.stringify({ scale12: true })); assert.equal(assistant().name, KNOWN[1][0], 'words saved before the question keep the older default, as the Planner does');
  store.set('gs.words', JSON.stringify({ scale12: true, ai: '' })); assert.equal(assistant().name, '');
});
test('undo: steps, redo, snapshots, grouping and forget', async () => {
  const u = await import('../src/services/undo.js');
  u.forget(); let v = { n: 1 };
  const done = u.snapshot('changed', () => v, x => { v = x; }); v = { n: 2 }; done();
  u.track('again', () => v, x => { v = x; }, () => { v = { n: 3 }; });
  assert.equal(u.state().next, 'again');
  u.undo(); assert.deepEqual(v, { n: 2 }); u.undo(); assert.deepEqual(v, { n: 1 }); assert.equal(u.undo(), null);
  u.redo(); assert.deepEqual(v, { n: 2 }); assert.ok(u.state().canRedo);
  assert.equal(u.snapshot('nothing', () => v, x => { v = x; })(), null, 'no change, no step');
  let s = ''; u.forget();
  for (const c of 'abc') { const b = s; s += c; const a = s; u.record({ label: 'typing', group: 'box1', undo: () => { s = b; }, redo: () => { s = a; } }); }
  u.undo(); assert.equal(s, '', 'typing in one box is one step: undo goes back to before it'); u.redo(); assert.equal(s, 'abc');
  u.forget(); assert.equal(u.state().canUndo, false);
});
test('shortcuts: one registry, the list made from it, not run while typing unless asked', async () => {
  const s = await import('../src/services/shortcuts.js');
  const ran = [];
  const off = s.register({ id: 't-next', keys: 'j', label: 'keys.next_student', group: 'keys.group_marking', run: () => ran.push('j') });
  s.register({ id: 't-cmd', keys: 'mod+k', label: 'cmd.open', inInputs: true, run: () => ran.push('k') });
  const ev = (key, o = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'BODY' }, preventDefault() {}, ...o });
  assert.ok(s.handle(ev('j'))); assert.ok(!s.handle(ev('j', { target: { tagName: 'TEXTAREA' } })));
  assert.ok(s.handle(ev('k', { ctrlKey: true, metaKey: true, target: { tagName: 'INPUT' } })));
  assert.deepEqual(ran, ['j', 'k']);
  const l = s.list(); assert.ok(l.find(g => g.group === 'keys.group_marking').items.some(i => i.id === 't-next'));
  off(); assert.ok(!s.list().some(g => g.items.some(i => i.id === 't-next')));
  assert.throws(() => s.register({ id: 'x', keys: 'x' }));
});
test('commands: every typed word must start a word of the label', async () => {
  const c = await import('../src/services/commands.js');
  c.addCommand({ id: 'a', label: 'Open the calendar', group: 'Go', run() {} });
  c.addCommand({ id: 'b', label: 'Calendar settings', group: 'Do', run() {} });
  c.addCommand({ id: 'h', label: 'Hidden', group: 'Do', when: () => false, run() {} });
  assert.deepEqual(c.findCommands('cal').map(x => x.id), ['b', 'a']);
  assert.deepEqual(c.findCommands('open cal').map(x => x.id), ['a']);
  assert.ok(!c.findCommands('').some(x => x.id === 'h'));
});
test('add-a-file values: a student-side item is a reference, never a copy', async () => {
  const f = await import('../src/services/files.js');
  const r = f.refValue({ store: 'examples', id: 7, label: '' });
  assert.deepEqual(r, { kind: 'ref', side: 'students', store: 'examples', id: '7', label: '' });
  assert.ok(f.isValue(r) && !('blob' in r));
  assert.ok(f.accepts({ kind: 'file', name: 'a.PDF', type: 'application/pdf' }, 'image/*,.pdf'));
  assert.ok(!f.accepts({ kind: 'file', name: 'a.exe', type: 'application/x' }, 'image/*,.pdf'));
  assert.ok(f.accepts(r, 'image/*'));
});

// Settings' own copy of the first teacher's words (app/screens/settings-me.js) is the grading engines' (engines/gways.js ME_OLD).
test('Settings reads a library with no settings of hers the way the grading engines do', () => {
  const fs = require('fs'), path = require('path'), src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  const g = /const ME_OLD = (\{[^}]*\})/.exec(src('engines/gways.js'))[1], s = /export const ME_OLD = (\{[^}]*\})/.exec(src('app/screens/settings-me.js'))[1];
  const KNOWN = [['', ''], ['K1', '']];
  assert.deepEqual(Function('KNOWN', 'return ' + s)(KNOWN), Function('return ' + g)().ai === undefined ? null : { ...Function('return ' + g)(), ai: 'K1' });
});
