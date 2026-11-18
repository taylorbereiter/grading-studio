// Her own settings in the library (lib.me) and the last setup a new assignment starts from (gs.setup), changed as one undo step.
// Shared by Settings' pages (settings-grading.jsx, settings-more.jsx) without the grading engines, so each page loads only what it draws.
import { useState, useEffect } from 'preact/hooks';
import { toast } from '../../ui/index.js';
import { PARTS } from '../router.js';
import { library, gradingSetup } from '../../students/index.js';
import { onSaved } from '../../shared/saved.js';
import * as undoList from '../../services/undo.js';
import { KNOWN } from '../../services/assistant.js';

// A library saved before she was asked anything has the first teacher's words (engines/gways.js ME_OLD, which next/test/services.test.js
// holds this to): the current app reads lib.me as this when it is missing.
export const ME_OLD = { sys: 'ManageBac', unit: 'Atlas', scale12: true, ai: KNOWN[1][0] };
export const readLibrary = () => library.json(null) || {};
export const meNow = L => (L.me && typeof L.me === 'object' ? L.me : ME_OLD);
export const J = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
export const useLibraryPlain = () => {
  const [, again] = useState(0);
  useEffect(() => onSaved(e => { if (e.kind === 'library' || e.kind === 'setting') again(n => n + 1); }), []);
  return readLibrary();
};
// lib.me and gs.setup as they are, put back or forward as one step
async function put(me, su, keepSu) {
  const W = await PARTS.write();
  await W.saveLibrary(l => { if (me) l.me = J(me); else delete l.me; });
  if (keepSu) W.saveSetting('gs.setup', su == null ? null : J(su));
}
export async function change(label, f, said) {
  const L = readLibrary(), me0 = J(L.me || null), su0 = gradingSetup.json(null);
  const me1 = J(L.me || ME_OLD), su1 = f(me1);   // f changes her settings and gives the new last setup, or undefined to leave it
  const keepSu = su1 !== undefined;
  if (JSON.stringify(me1) === JSON.stringify(L.me || null) && (!keepSu || JSON.stringify(su1) === JSON.stringify(su0))) return;   // nothing changed: no step
  await put(me1, su1, keepSu);
  undoList.record({ label, undo: () => put(me0, su0, keepSu), redo: () => put(me1, su1, keepSu) });
  if (said) toast(said, { undo: undoList.undo });
}
