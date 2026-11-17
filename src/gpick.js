/* ---------------- Google Drive's own chooser, for both pages ----------------
   Built into Grading Studio and into the Planner. Each page says how it signs in (gpHost(), its own): Grading Studio through its
   Google line (src/app/drive.js), the Planner through src/planner/pldrive.js. The app gets only the files picked in Google's chooser
   (drive.file), never a look at the rest of the Drive.
   Any place that takes files from the computer through a file input can take them from Drive too: gpOn(input) fills the input with
   the picked files and tells it they changed, so what happens next is what happens with a file from the computer. A button with
   data-gdrive="<selector of the input>" does that by itself; gpBtn() draws one, only where Google is set up. */
const GP_FOLDER = 'application/vnd.google-apps.folder';
const GP_W = 'application/vnd.openxmlformats-officedocument.', GP_GA = 'application/vnd.google-apps.';
const GP_EXT = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', svg: 'image/svg+xml',
  docx: GP_W + 'wordprocessingml.document', dotx: GP_W + 'wordprocessingml.template', docm: 'application/vnd.ms-word.document.macroEnabled.12', dotm: 'application/vnd.ms-word.template.macroEnabled.12',
  pptx: GP_W + 'presentationml.presentation', potx: GP_W + 'presentationml.template', xlsx: GP_W + 'spreadsheetml.sheet', csv: 'text/csv', tsv: 'text/tab-separated-values', txt: 'text/plain', md: 'text/markdown', json: 'application/json', zip: 'application/zip' };
const GP_IMG = ['png', 'jpg', 'gif', 'webp', 'heic', 'heif', 'svg'].map(x => GP_EXT[x]);
// How Google's own files come down, best first: as Office files where the page keeps them editable (the Planner), else as a PDF.
const gpWays = office => ({ document: office ? ['docx', 'pdf'] : ['pdf', 'docx'], presentation: office ? ['pptx', 'pdf'] : ['pdf', 'pptx'], spreadsheet: office ? ['xlsx', 'csv', 'pdf'] : ['pdf', 'xlsx', 'csv'], drawing: ['png', 'pdf'] });
// What an input takes (its accept), as the kinds the chooser shows (null: anything) and the way each kind of Google file comes down.
function gpKinds(accept, office) {
  let mimes = [];
  for (const t of String(accept || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) {
    if (t === 'image/*') mimes.push(...GP_IMG);
    else if (t[0] === '.' && GP_EXT[t.slice(1)]) mimes.push(GP_EXT[t.slice(1)]);
    else if (t[0] !== '.' && !t.endsWith('/*')) mimes.push(t);
    else { mimes = null; break; }   // a kind of file Drive has no name for (.gslesson, video/*): show everything
  }
  if (mimes && !mimes.length) mimes = null;
  if (mimes && mimes.includes('application/zip')) mimes.push('application/x-zip-compressed');
  const ok = m => !mimes || mimes.includes(m), want = {};
  for (const [k, ways] of Object.entries(gpWays(office))) { const w = ways.find(x => ok(GP_EXT[x])); if (w) want[k] = w; }
  return { mimes: mimes && [...new Set(mimes.concat(Object.keys(want).map(k => GP_GA + k)))], want };
}
let gpP = null;
function gpLoadPicker() {
  if (window.google && google.picker) return Promise.resolve();
  return gpP || (gpP = new Promise((res, rej) => {
    const fail = () => { gpP = null; rej(new Error('Couldn’t reach Google. Check the internet connection.')); };
    const go = () => gapi.load('picker', { callback: res, onerror: fail });
    if (window.gapi && gapi.load) return go();
    const s = document.createElement('script'); s.src = 'https://apis.google.com/js/api.js'; s.async = true; s.onload = go; s.onerror = fail; document.head.appendChild(s);
  }));
}
// Google's chooser. o: { mimes (null: any file), folder: pick a folder, parent + parentName: a first tab that opens there, multi, title }.
// Gives [{ id, name, size, mime, parent }], or [] if it is closed.
async function gpPick(token, cid, key, o = {}) {
  await gpLoadPicker();
  const P = google.picker;
  return new Promise(res => {
    // Tabs: the chosen folder first (if any), then My Drive from the top, Shared with me, and shared drives. Each one opens folder by folder.
    const mk = (label, set) => {
      const v = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(true).setMode(P.DocsViewMode.LIST);
      // Choosing a folder still lists what is inside, so a folder doesn't look empty; picking a file in it chooses its folder.
      if (o.folder) v.setSelectFolderEnabled(true);
      if (o.mimes) v.setMimeTypes(o.mimes.concat(GP_FOLDER).join(','));
      if (v.setLabel) v.setLabel(label);
      set(v); return v;
    };
    const views = [];
    if (o.parent && !o.folder) views.push(mk(o.parentName || 'Last folder', v => v.setParent(o.parent)));
    views.push(mk('My Drive', v => v.setParent('root')));
    views.push(mk('Shared with me', v => v.setOwnedByMe && v.setOwnedByMe(false)));
    views.push(mk('Shared drives', v => v.setEnableDrives && v.setEnableDrives(true)));
    const b = new P.PickerBuilder().setOAuthToken(token).setAppId(cid.split('-')[0]).setOrigin(location.origin);
    views.forEach(v => b.addView(v));
    b.enableFeature(P.Feature.SUPPORT_DRIVES).setCallback(d => {
      if (d[P.Response.ACTION] === P.Action.PICKED) res((d[P.Response.DOCUMENTS] || []).map(x => o.folder && x.mimeType !== GP_FOLDER ? (x.parentId ? { id: x.parentId, name: 'Folder with ' + x.name, mimeType: GP_FOLDER } : null) : x).filter(x => x && (o.folder || x.mimeType !== GP_FOLDER)).map(x => ({ id: x.id, name: x.name, size: +x.sizeBytes || 0, mime: x.mimeType || '', ...(x.parentId ? { parent: x.parentId } : {}) })));
      else if (d[P.Response.ACTION] === P.Action.CANCEL) res([]);
    });
    if (o.title) b.setTitle(o.title);
    if (key && !/@@/.test(key)) b.setDeveloperKey(key);
    if (o.multi) b.enableFeature(P.Feature.MULTISELECT_ENABLED);
    b.build().setVisible(true);
  });
}
// Where one picked file comes down from, and the name and kind it has here. A Google Doc, Slides, Sheet or Drawing is saved out as want says.
function gpUrl(d, want) {
  const k = d.mime.startsWith(GP_GA) ? d.mime.slice(GP_GA.length) : '';
  if (!k) return { url: 'files/' + encodeURIComponent(d.id) + '?alt=media&supportsAllDrives=true', name: d.name, type: d.mime };
  const w = (want || {})[k] || 'pdf', type = GP_EXT[w];
  return { url: 'files/' + encodeURIComponent(d.id) + '/export?mimeType=' + encodeURIComponent(type), name: d.name.toLowerCase().endsWith('.' + w) ? d.name : d.name + '.' + w, type };
}
// Fills a file input with files picked in Drive, then tells it they changed, the way the computer's file chooser does.
async function gpOn(inp) {
  const h = typeof gpHost === 'function' && gpHost(); if (!h) return inp.click();
  try {
    const k = gpKinds(inp.accept, h.office || !!inp.dataset.office);
    const picked = await h.pick({ multi: inp.multiple, mimes: k.mimes, title: inp.multiple ? 'Choose files' : 'Choose a file' });
    if (!picked.length) return;
    h.say('Getting it from Drive…');
    const files = [];
    for (const d of picked) { const u = gpUrl(d, k.want), r = await h.get(u.url); files.push(new File([await r.blob()], u.name.replace(/[\\/]+/g, '-'), { type: u.type || r.headers.get('content-type') || '' })); }
    const dt = new DataTransfer(); files.forEach(f => dt.items.add(f));
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (e) { console.error(e); h.say((e && e.message) || String(e)); }
}
// The button beside a place that takes files. sel: the file input it fills (empty: the one beside it). Nothing where Google isn't set up (a double-click copy).
const gpBtn = (sel = '', cls) => typeof gpHost === 'function' && gpHost() ? '<button type="button" class="' + (cls || 'btn sm ghost') + '" data-gdrive="' + sel + '">From Google Drive…</button>' : '';
// A Drive button that does what the button before it does (the same data-a="…"), marked data-drv: the file input that press opens is
// filled from Drive instead (gpClick in place of input.click()).
let gpArm = 0;
const gpClick = inp => { const d = Date.now() - gpArm < 1500; gpArm = 0; return d ? gpOn(inp) : inp.click(); };
// small: just Drive's mark, where a row has no room for the words (they show on hover and to a screen reader).
const GP_ICO = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="vertical-align:-3px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round"><path d="M8.5 3.5h7l6 10.5-3.5 6h-12L2.5 14z M8.5 3.5l6 10.5h7 M15.5 3.5l-9.5 16.5 M2.5 14h12"/></svg>';
const gpDrv = (attrs, cls, small) => typeof gpHost === 'function' && gpHost() ? '<button type="button" class="' + (cls || 'btn sm ghost') + '" data-drv ' + attrs + (small ? ' title="From Google Drive…" aria-label="From Google Drive…">' + GP_ICO : '>From Google Drive…') + '</button>' : '';
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('[data-drv]')) gpArm = Date.now();
  const b = e.target.closest && e.target.closest('[data-gdrive]'); if (!b) return;
  const inp = b.dataset.gdrive ? document.querySelector(b.dataset.gdrive) : b.parentElement.querySelector('input[type=file]'); if (!inp) return;
  e.preventDefault();
  gpOn(inp);
}, true);
