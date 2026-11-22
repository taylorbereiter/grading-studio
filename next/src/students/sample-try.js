// The sample's things to try (src/welcome.js sampleGo): its first class, and the downloads of its marked essay and its quiz. Ids only,
// for the sample strip through crossings.js sampleForShell.
import { readLibrary } from './counts.js';
export function sampleTry() {
  const c = (readLibrary().classes || [])[0];
  if (!c) return null;
  const it = k => { for (const u of c.units || []) for (const x of u.items || []) if (x.sampleKey === k) return x.batchId || null; return null; };
  return { classId: String(c.id), paper: it('essay'), quiz: it('quiz') };
}
