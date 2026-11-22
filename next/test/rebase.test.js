// Undo and redo as edits on what is stored now (audit H-012): shared/rebase.js. Made-up wording only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const load = () => import(path.join(__dirname, '..', 'src', 'shared', 'rebase.js'));

test('H-012 a comment list: undo of a removal puts it back and keeps what arrived since; a later edit or removal elsewhere stays', async () => {
  const { rebaseList } = await load();
  const before = ['A.', 'B.', 'C.'], after = ['A.', 'C.'];
  assert.deepEqual(rebaseList(['New.', 'A.', 'C.'], after, before, { first: true }), ['New.', 'A.', 'B.', 'C.']);
  assert.deepEqual(rebaseList(['C.'], after, before, { first: true }), ['B.', 'C.'], 'A. removed elsewhere stays removed');
  // undo of an add takes only that one out
  assert.deepEqual(rebaseList(['Other.', 'Star.', 'A.'], ['Star.', 'A.'], ['A.'], { first: true }), ['Other.', 'A.']);
  // redo is the same the other way
  assert.deepEqual(rebaseList(['New.', 'A.', 'B.', 'C.'], before, after, { first: true }), ['New.', 'A.', 'C.']);
});

test('H-012 rubrics by id and the deleted map: a rubric changed since keeps its newer wording; the step\'s own change is undone', async () => {
  const { rebaseList, rebaseMap } = await load();
  const key = { key: x => x.id };
  const r1 = { id: '1', name: 'Essay' }, r1b = { id: '1', name: 'Essay v2' }, r2 = { id: '2', name: 'Lab' }, r3 = { id: '3', name: 'Talk' };
  // the step renamed 1 and removed 2; since then 3 came in
  assert.deepEqual(rebaseList([r1b, r3], [r1b], [r1, r2], key), [r1, r2, r3]);
  // the step renamed 1, then 1 was renamed again elsewhere: undo keeps the newer name
  const r1c = { id: '1', name: 'Essay final' };
  assert.deepEqual(rebaseList([r1c], [r1b], [r1], key), [r1c]);
  // gone: the step marked 2 deleted; since then 3 was deleted elsewhere
  assert.deepEqual(rebaseMap({ 2: 5, 3: 9 }, { 2: 5 }, {}), { 3: 9 });
  assert.deepEqual(rebaseMap({ 3: 9 }, {}, { 2: 5 }), { 3: 9, 2: 5 });
});
