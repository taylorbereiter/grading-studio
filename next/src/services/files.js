// What the add-a-file control hands back. Four kinds, one shape, so any screen can hold any of them:
//   { kind: 'file',  name, type, size, blob }            a file from this computer (picked, dragged in or pasted)
//   { kind: 'drive', id, name, type, url }               a Google Drive file (the picker is a slot the screen fills)
//   { kind: 'link',  url, name }                         a web address
//   { kind: 'ref',   side: 'students', store, id, label } a pointer to something on the student side (a strong example's picture).
// A ref is never copied into planning storage. Parts never open one themselves: the screen passes resolve(ref), which may draw it
// on this device, and without it (or when it gives nothing back) a placeholder tile is drawn. See the stage 1 brief, decision 1.
export const fileValue = f => ({ kind: 'file', name: f.name || '', type: f.type || '', size: f.size || 0, blob: f });
export const driveValue = d => ({ kind: 'drive', id: String(d.id), name: d.name || '', type: d.mimeType || d.type || '', url: d.url || '' });
export const linkValue = (url, name) => ({ kind: 'link', url: String(url), name: name || '' });
export const refValue = ({ store, id, label }) => ({ kind: 'ref', side: 'students', store, id: String(id), label: label || '' });
export const isValue = v => !!v && ['file', 'drive', 'link', 'ref'].includes(v.kind);
export const isImage = v => !!v && /^image\//.test(v.type || '');
// Files from a paste or a drop, as values.
export function filesFrom(dt) {
  if (!dt) return [];
  const out = [];
  if (dt.files && dt.files.length) for (const f of dt.files) out.push(fileValue(f));
  else if (dt.items) for (const it of dt.items) if (it.kind === 'file') { const f = it.getAsFile(); if (f) out.push(fileValue(f)); }
  return out;
}
// Whether a file fits an accept list as <input accept> writes it ("image/*,.pdf").
export function accepts(v, accept) {
  if (!accept || v.kind !== 'file') return true;
  const name = (v.name || '').toLowerCase(), type = v.type || '';
  return accept.split(',').map(s => s.trim().toLowerCase()).some(a => a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? type.startsWith(a.slice(0, -1)) : type === a);
}
