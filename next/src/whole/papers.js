// Papers through Drive (src/app/drive.js dvNames … dvPullOne, planLite): each file once, named by what's in it (its SHA-256), in the
// app's own hidden folder. A computer sends up the papers it keeps, in the background, after each sync of the marks; the sync file
// lists a download's files once they are all there. Another device fetches a download's papers the first time she opens it there,
// and a phone fetches one student's at a time. Late files come with the marks. The copies of big lessons for a phone go up here too.
import { gsync, G } from './google.js';
import { keptBytes } from './apply.js';
import { P, S, LITE, syncNow, setPapersState, PHONE } from './drive.js';
import { papers, meta, added } from '../students/index.js';
import { takePapers, takeMeta } from '../students/write.js';
import { setText as lsSet } from '../shared/ls.js';
import { sampleOn } from '../app/sample.js';

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const D = { names: null, up: null, full: false };
async function names() {
  if (D.names) return D.names;
  const m = new Map(); let page = '';
  do {
    const j = await (await gsync('files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)&q=' + encodeURIComponent("name contains '.dat' and trashed=false") + (page ? '&pageToken=' + page : ''))).json();
    for (const f of j.files || []) m.set(f.name, f.id); page = j.nextPageToken;
  } while (page);
  return (D.names = m);
}
export async function put(bytes) {
  const hash = await sha(bytes), name = hash + '.dat', have = await names();
  if (have.has(name)) return { hash, size: bytes.length };
  const m = JSON.stringify({ name, parents: ['appDataFolder'] });
  let id;
  if (bytes.length <= 4e6) {
    const fd = new FormData(); fd.append('metadata', new Blob([m], { type: 'application/json' })); fd.append('file', new Blob([bytes]));
    id = (await (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id;
  } else {
    const at = (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Length': String(bytes.length) }, body: m })).headers.get('Location');
    id = (await (await gsync(at + '&fields=id', { method: 'PUT', body: new Blob([bytes]) })).json()).id;
  }
  have.set(name, id);
  return { hash, size: bytes.length };
}
export async function get(ref) {
  let id = (await names()).get(ref.hash + '.dat');
  if (!id) { D.names = null; id = (await names()).get(ref.hash + '.dat'); }
  if (!id) throw Object.assign(new Error('not in Drive'), { why: 'gone' });
  const bytes = new Uint8Array(await (await gsync('files/' + id + '?alt=media')).arrayBuffer());
  if (bytes.length !== ref.size || await sha(bytes) !== ref.hash) throw Object.assign(new Error('damaged'), { why: 'damaged' });
  return bytes;
}
const under = id => IDBKeyRange.bound(id + '|', id + '|￿');
// One download's papers and late files, sent up; its line in the sync file once every file is there.
async function send(id) {
  const rec = await papers.get(id); if (!rec || !rec.entries) return null;
  const list = [];
  for (let i = 0; i < rec.entries.length; i++) { const data = await keptBytes(id, i, rec.entries[i]); list.push({ path: rec.entries[i].path, ...(data ? await put(data) : {}) }); }
  const late = {};
  for (const [k, r] of await added.entries(under(id))) if (r) { const { data, ...x } = r; late[k.slice(id.length + 1)] = { ...x, ...await put(data) }; }
  return { label: rec.label || '', papers: list, added: late };
}
async function up() {
  let sent = 0;
  for (const m of (await meta.entries()).map(([, v]) => v).filter(Boolean).sort((a, b) => b.t - a.t)) {
    if (!m.papers || !G.email) continue;
    const have = P.files[m.id], late = await added.keys(under(m.id));
    if (have && late.every(k => have.added && k.slice(m.id.length + 1) in have.added)) continue;
    try {
      setPapersState('sending');
      const f = await send(m.id); if (!f) continue;
      (P.sent ||= {})[m.id] = f; P.files[m.id] = f; sent++;
    } catch (e) {
      if (/storageQuotaExceeded|quota/i.test(e && e.message)) { D.full = true; setPapersState('full'); return; }
      console.warn(e); setPapersState('notsent'); return;
    }
  }
  if (sent) { try { lsSet('gs.cloudP', JSON.stringify(P.files)); } catch {} await syncNow(); P.sent = null; } else if (!S.busy) setPapersState('');
}
export function upSoon() { if (!D.up && !D.full && !PHONE && !sampleOn()) D.up = up().finally(() => { D.up = null; }); }
export const upNow = async () => { while (D.up) await D.up; upSoon(); return D.up; };
// Late files come with the marks; papers wait until she opens them (pull).
export const source = files => ({
  papers: async () => null, edit: async () => null,
  async added(id, k) { const r = files[id] && files[id].added && files[id].added[k]; if (!r) return null; const { hash, size, ...x } = r; return { ...x, data: await get({ hash, size }) }; },
});
export const inDrive = id => !!P.files[id] && !!G.email && !sampleOn();
// A download's papers from her Drive, kept in this browser from then on. onStep(n, of).
export async function pull(id, onStep) {
  const f = P.files[id]; if (!f) return null;
  const entries = []; let n = 0;
  for (const e of f.papers) { entries.push({ path: e.path, data: e.hash ? await get(e) : null }); onStep && onStep(++n, f.papers.length); }
  const rec = { id, label: f.label || '', entries };
  await takePapers(id, rec);
  const m = { ...((await meta.get(id)) || { id }), papers: true, size: entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) };
  await takeMeta(id, m);
  return rec;
}
// One student's files only, for a quick look on a phone. Not kept.
export async function pullOne(id, key) {
  const f = P.files[id]; if (!f) return [];
  const out = []; for (const e of f.papers.filter(e => e.hash && e.path.split('/')[0] === key)) out.push({ path: e.path, data: await get(e) });
  return out;
}

/* the copies of big lessons for a phone (src/app/drive.js planLite, planLiteMake): each picture over 20 KB goes to Drive once and
   the copy names it (gsblob:<sha-256>:<bytes>:<type>). Next week's lessons first, a few seconds' worth each sync. */
const LITE_PIC = 20000, PLAN_BIG = 2e6, T = { ms: 8000 };
async function lite(x) {
  const l = JSON.parse(JSON.stringify(x));
  const upPic = async src => {
    const m = src.length > LITE_PIC && /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(src); if (!m) return src;
    const bin = atob(m[2]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const r = await put(bytes);
    return 'gsblob:' + r.hash + ':' + r.size + ':' + m[1];
  };
  for (const s of Array.isArray(l.slides) ? l.slides : []) {
    if (!s || typeof s !== 'object') continue;
    if (s.img && typeof s.img.src === 'string') s.img.src = await upPic(s.img.src);
    if (Array.isArray(s.ctx)) for (const c of s.ctx) if (c && typeof c.src === 'string') c.src = await upPic(c.src);
    if (s.video && typeof s.video === 'object') delete s.video.thumb;
  }
  return JSON.stringify(l).length > PLAN_BIG ? null : l;
}
const iso = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export async function liteMake() {
  if (PHONE || !LITE.due.length) return false;
  const today = iso(Date.now()), next = x => (Array.isArray(x.slots) ? x.slots : []).map(s => s && typeof s.date === 'string' ? s.date : '').filter(d => d >= today).sort()[0] || '~';
  const due = LITE.due.map(x => [next(x), x]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (b[1].updated || 0) - (a[1].updated || 0)).map(a => a[1]);
  LITE.due = [];
  const t0 = Date.now(); let made = 0;
  for (const x of due) {
    if (made && Date.now() - t0 > T.ms) break;
    try { LITE.made.set(x.id, { updated: x.updated || 0, lite: await lite(x) }); made++; } catch (e) { console.warn(e); }
  }
  return made > 0;
}
P.source = source; P.upSoon = upSoon; P.liteMake = liteMake;
