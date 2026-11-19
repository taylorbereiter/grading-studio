// The Planner's engines (engines/planner.js, made from the current Planner's own code) with this teacher's plan in their memory.
// A screen calls engine(plan) and uses what comes back: L.setup, L.lessons, L.units and the default look are the plan it was given.
// The teacher's own slide template gives slides their background picture (tplPreview), worked out again only when it changes.
import * as E from '../engines/planner.js';

let tpl = null;
export function engine(p) {
  if (p) {
    E.L.setup = p.setup; E.L.lessons = p.lessons; E.L.units = p.units; E.L.defLook = p.deflook; E.L.activities = p.activities; E.L.words = p.words || null;
    const t = (p.setup && p.setup.template) || null; if (t !== tpl) { tpl = t; E.tplPreview(); }
  }
  return E;
}
