// Google Drive's own chooser (src/gpick.js), for every place that takes files: the app gets only the files picked there (drive.file),
// never a look at the rest of the Drive. fill(input) puts the picked files into a file input and tells it they changed, so what
// happens next is what happens with a file from the computer. Google's own Docs, Slides, Sheets and Drawings come down as Office files
// where the input takes them (a lesson's materials), else as a PDF.
import { gToken, gfetch, gcid, G, whoAmI } from './google.js';

const FOLDER = 'application/vnd.google-apps.folder';
const W = 'application/vnd.openxmlformats-officedocument.', GA = 'application/vnd.google-apps.';
const EXT = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', svg: 'image/svg+xml',
  docx: W + 'wordprocessingml.document', dotx: W + 'wordprocessingml.template', docm: 'application/vnd.ms-word.document.macroEnabled.12', dotm: 'application/vnd.ms-word.template.macroEnabled.12',
  pptx: W + 'presentationml.presentation', potx: W + 'presentationml.template', xlsx: W + 'spreadsheetml.sheet', csv: 'text/csv', tsv: 'text/tab-separated-values', txt: 'text/plain', md: 'text/markdown', json: 'application/json', zip: 'application/zip' };
const IMG = ['png', 'jpg', 'gif', 'webp', 'heic', 'heif', 'svg'].map(x => EXT[x]);
export const VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/x-matroska', 'video/3gpp', 'video/ogg'];
const ways = office => ({ document: office ? ['docx', 'pdf'] : ['pdf', 'docx'], presentation: office ? ['pptx', 'pdf'] : ['pdf', 'pptx'], spreadsheet: office ? ['xlsx', 'csv', 'pdf'] : ['pdf', 'xlsx', 'csv'], drawing: ['png', 'pdf'] });
export function kinds(accept, office) {
  let mimes = [];
  for (const t of String(accept || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) {
    if (t === 'image/*') mimes.push(...IMG);
    else if (t[0] === '.' && EXT[t.slice(1)]) mimes.push(EXT[t.slice(1)]);
    else if (t[0] !== '.' && !t.endsWith('/*')) mimes.push(t);
    else { mimes = null; break; }   // a kind Drive has no name for (.gslesson, video/*): show everything
  }
  if (mimes && !mimes.length) mimes = null;
  if (mimes && mimes.includes('application/zip')) mimes.push('application/x-zip-compressed');
  const ok = m => !mimes || mimes.includes(m), want = {};
  for (const [k, w] of Object.entries(ways(office))) { const x = w.find(y => ok(EXT[y])); if (x) want[k] = x; }
  return { mimes: mimes && [...new Set(mimes.concat(Object.keys(want).map(k => GA + k)))], want };
}
let pp = null;
function loadPicker() {
  if (window.google && google.picker) return Promise.resolve();
  return pp || (pp = new Promise((res, rej) => {
    const fail = () => { pp = null; rej(Object.assign(new Error('offline'), { why: 'offline' })); };
    const go = () => gapi.load('picker', { callback: res, onerror: fail });
    if (window.gapi && gapi.load) return go();
    const s = document.createElement('script'); s.src = 'https://apis.google.com/js/api.js'; s.async = true; s.onload = go; s.onerror = fail; document.head.appendChild(s);
  }));
}
// o: { mimes (null: any file), folder, parent + parentName, multi, title, labels: { mine, shared, drives } }. Gives
// [{ id, name, size, mime, parent }], or [] when it is closed.
export async function pick(o = {}) {
  if (!gcid()) throw Object.assign(new Error('setup'), { why: 'setup' });
  const token = await gToken(true, 'pick');
  if (!G.email) whoAmI().catch(() => {});
  await loadPicker();
  const P = google.picker, L = o.labels || {};
  return new Promise(res => {
    const mk = (label, set) => {
      const v = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(true).setMode(P.DocsViewMode.LIST);
      if (o.folder) v.setSelectFolderEnabled(true);
      if (o.mimes) v.setMimeTypes(o.mimes.concat(FOLDER).join(','));
      if (v.setLabel && label) v.setLabel(label);
      set(v); return v;
    };
    const views = [];
    if (o.parent && !o.folder) views.push(mk(o.parentName || L.last, v => v.setParent(o.parent)));
    views.push(mk(L.mine, v => v.setParent('root')));
    views.push(mk(L.shared, v => v.setOwnedByMe && v.setOwnedByMe(false)));
    views.push(mk(L.drives, v => v.setEnableDrives && v.setEnableDrives(true)));
    const b = new P.PickerBuilder().setOAuthToken(token).setAppId(gcid().split('-')[0]).setOrigin(location.origin);
    views.forEach(v => b.addView(v));
    b.enableFeature(P.Feature.SUPPORT_DRIVES).setCallback(d => {
      if (d[P.Response.ACTION] === P.Action.PICKED) res((d[P.Response.DOCUMENTS] || []).map(x => o.folder && x.mimeType !== FOLDER ? (x.parentId ? { id: x.parentId, name: x.name, mimeType: FOLDER } : null) : x).filter(x => x && (o.folder || x.mimeType !== FOLDER)).map(x => ({ id: x.id, name: x.name, size: +x.sizeBytes || 0, mime: x.mimeType || '', ...(x.parentId ? { parent: x.parentId } : {}) })));
      else if (d[P.Response.ACTION] === P.Action.CANCEL) res([]);
    });
    if (o.title) b.setTitle(o.title);
    if (o.multi) b.enableFeature(P.Feature.MULTISELECT_ENABLED);
    b.build().setVisible(true);
  });
}
function urlOf(d, want) {
  const k = d.mime.startsWith(GA) ? d.mime.slice(GA.length) : '';
  if (!k) return { url: 'files/' + encodeURIComponent(d.id) + '?alt=media&supportsAllDrives=true', name: d.name, type: d.mime };
  const w = (want || {})[k] || 'pdf', type = EXT[w];
  return { url: 'files/' + encodeURIComponent(d.id) + '/export?mimeType=' + encodeURIComponent(type), name: d.name.toLowerCase().endsWith('.' + w) ? d.name : d.name + '.' + w, type };
}
// The picked files as File objects. onStep(n, of).
export async function filesOf(picked, want, onStep) {
  const out = []; let n = 0;
  for (const d of picked) { const u = urlOf(d, want), r = await gfetch(u.url, {}, true, 'pick'); out.push(new File([await r.blob()], u.name.replace(/[\\/]+/g, '-'), { type: u.type || r.headers.get('content-type') || '' })); onStep && onStep(++n, picked.length); }
  return out;
}
// Fills a file input with files picked in Drive, then tells it they changed. o: { office, title, labels, say(n, of), picked(list) }. False when nothing was picked.
export async function fill(inp, o = {}) {
  const k = kinds(inp.accept, o.office || !!inp.dataset.office);
  const picked = await pick({ multi: inp.multiple, mimes: k.mimes, title: o.title, labels: o.labels });
  if (!picked.length) return false;
  const files = await filesOf(picked, k.want, o.say);
  if (o.picked) o.picked(picked);
  const dt = new DataTransfer(); files.forEach(f => dt.items.add(f));
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
// The export into a new folder in Drive (src/app/drive.js saveToDrive): next to the papers she opened from Drive (from: the download's
// drive, { id, kind }), or in My Drive. The app may write only where it made a folder or she picked (drive.file), so when the folder
// beside the opened file isn't one, My Drive. files: { path: bytes }. Gives 'next' or 'root'.
export async function saveTo(name, files, from, onStep) {
  let parent = 'root';
  const gf = (u, o = {}) => gfetch(u, o, true);   // after her press: may ask her to sign in
  if (from && from.id) { try { const j = await (await gf('files/' + from.id + '?fields=parents&supportsAllDrives=true')).json(); parent = from.kind === 'folder' ? from.id : (j.parents && j.parents[0]) || 'root'; } catch {} }
  const mk = async (nm, par) => (await (await gf('files?supportsAllDrives=true&fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nm, mimeType: FOLDER, parents: [par] }) })).json()).id;
  let top; try { top = await mk(name, parent); } catch (e) { if (parent === 'root' || ![403, 404].includes(e.status)) throw e; parent = 'root'; top = await mk(name, parent); }
  const dirs = new Map([['', top]]);
  const dirOf = async d => { if (dirs.has(d)) return dirs.get(d); const i = d.lastIndexOf('/'), up = await dirOf(i < 0 ? '' : d.slice(0, i)); const id = await mk(d.slice(i + 1), up); dirs.set(d, id); return id; };
  const list = Object.entries(files); let n = 0;
  for (const [path, bytes] of list) {
    const i = path.lastIndexOf('/'), par = await dirOf(i < 0 ? '' : path.slice(0, i));
    const fd = new FormData(); fd.append('metadata', new Blob([JSON.stringify({ name: path.slice(i + 1), parents: [par] })], { type: 'application/json' })); fd.append('file', new Blob([bytes], { type: /\.pdf$/i.test(path) ? 'application/pdf' : 'application/octet-stream' }));
    await gf('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', { method: 'POST', body: fd });
    if (onStep) onStep(++n, list.length);
  }
  return parent === 'root' ? 'root' : 'next';
}
