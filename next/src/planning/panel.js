// The classic Planner and Beside share this record. Resizing changes only the width.
import { localKey } from '../shared/records.js';
import { saved } from '../shared/saved.js';

const panel = localKey('planning', 'gsp.panel');
export function savePanel(value) {
  if (value === undefined) panel.remove(); else panel.setJson(value);
  saved({ kind: 'pref', id: panel.key, side: 'planning' });
}
