// Undo of a library step puts back only what that step changed (audit H-004): a change saved since, from a download being opened,
// Settings, another window or Drive, stays. Lists of classes, units and cards are matched by id.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const lib = () => ({ v: 3, me: { name: 'Teacher' }, gone: {}, classes: [{ id: 'c1', name: 'Art 9', names: ['Aria Testwell', 'Bram Sample'], units: [
  { id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Essay' }, { id: 'i2', name: 'Quiz' }] },
  { id: 'u2', name: 'Unit 2', items: [] }] }] });
const copy = v => JSON.parse(JSON.stringify(v));

test('a rename taken back leaves a card link, a setting and a new class made since', async () => {
  const { patch, apply } = await import('../src/students/libpatch.js');
  const before = lib(), after = copy(before); after.classes[0].units[0].name = 'Poems';
  const back = patch(after, before), fwd = patch(before, after);
  const now = copy(after);
  now.classes[0].units[0].items[0].batchId = 'b1';   // a download opened from the card
  now.me.name = 'Ms T';                                // Settings
  now.classes.push({ id: 'c2', name: 'Drama', names: [], units: [] });   // another window
  apply(now, back);
  assert.equal(now.classes[0].units[0].name, 'Unit 1');
  assert.equal(now.classes[0].units[0].items[0].batchId, 'b1');
  assert.equal(now.me.name, 'Ms T');
  assert.deepEqual(now.classes.map(c => c.id), ['c1', 'c2']);
  apply(now, fwd);
  assert.equal(now.classes[0].units[0].name, 'Poems');
  assert.equal(now.classes[0].units[0].items[0].batchId, 'b1');
});

test('a card added, deleted or moved is taken back by id, around cards added elsewhere', async () => {
  const { patch, apply } = await import('../src/students/libpatch.js');
  // added
  let before = lib(), after = copy(before); after.classes[0].units[0].items.push({ id: 'i3', name: 'Poster' });
  let now = copy(after); now.classes[0].units[0].items.unshift({ id: 'i9', name: 'From the other window' });
  apply(now, patch(after, before));
  assert.deepEqual(now.classes[0].units[0].items.map(i => i.id), ['i9', 'i1', 'i2']);
  // deleted: comes back in its place, with what it had
  before = lib(); before.classes[0].units[0].items[1].typed = { max: 10 }; after = copy(before); after.classes[0].units[0].items.splice(1, 1); after.gone = { i2: 1 };
  now = copy(after); now.classes[0].units[0].items[0].name = 'Essay 2';
  apply(now, patch(after, before));
  assert.deepEqual(now.classes[0].units[0].items.map(i => [i.id, i.name]), [['i1', 'Essay 2'], ['i2', 'Quiz']]);
  assert.deepEqual(now.classes[0].units[0].items[1].typed, { max: 10 });
  assert.deepEqual(now.gone, { i2: 1 }, 'the deleted list is left to the save, as before');
  // moved up: the order goes back, the rest stays
  before = lib(); after = copy(before); after.classes[0].units[0].items.reverse();
  now = copy(after); now.classes[0].units[1].name = 'Changed elsewhere';
  apply(now, patch(after, before));
  assert.deepEqual(now.classes[0].units[0].items.map(i => i.id), ['i1', 'i2']);
  assert.equal(now.classes[0].units[1].name, 'Changed elsewhere');
});

test('a card moved to another unit, and a roster edit, go back and forward', async () => {
  const { patch, apply } = await import('../src/students/libpatch.js');
  const before = lib(), after = copy(before);
  const [it] = after.classes[0].units[0].items.splice(0, 1); after.classes[0].units[1].items.push(it);
  after.classes[0].names = ['Bram Sample', 'Aria Testwell', 'Cleo Fixture'];
  const now = copy(after);
  apply(now, patch(after, before));
  assert.deepEqual(now.classes[0].units.map(u => u.items.map(i => i.id)), [['i1', 'i2'], []]);
  assert.deepEqual(now.classes[0].names, ['Aria Testwell', 'Bram Sample']);
  apply(now, patch(before, after));
  assert.deepEqual(now, after);
});
