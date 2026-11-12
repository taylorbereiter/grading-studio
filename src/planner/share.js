/* ================= Planner: a lesson file to share =================
   One small file (Title.gslesson) that opens again as the same lesson in any Grading Studio: on another
   computer, in another browser, or for another teacher. It is a .zip inside:
     gslesson.json   { kind: 'grading-studio-lesson', version: 1, lesson: {...},
                       files: [{ name, kind: 'doc'|'other', type, path }], final: { name, path } | null }
     images/…        the slide pictures ("img.src" in the lesson points here)
     files/…         the lesson's materials (a document made here is its HTML, so it stays editable)
     final/…         the finished PowerPoint, if one was uploaded (it can't be made again from the slides)
     README.txt      a line for anyone who opens it by hand
   What stays behind: which classes and days it is on, taught notes, comments and asks for Claude, screenshots
   for Claude, earlier versions and finished decks. A lesson holds no student data, and a shared file keeps it so.
   Opening one never replaces a lesson: if the same lesson is already here, it comes in as a separate copy. */
const SHARE_EXT = '.gslesson';
const SHARE_KIND = 'grading-studio-lesson';
const isShareFile = f => !!f && /\.gslesson$/i.test(f.name || '');
const shareName = l => (plainTitle(l.title) || 'Lesson').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Lesson';
// The parts of a lesson that travel. Everything about one teacher's classes, or meant only for Claude, is left out.
function shareLesson(l) {
  const c = JSON.parse(JSON.stringify(l));
  for (const k of ['_file', '_mod', 'pending', 'slots', 'taught', 'talk', 'claudeNote', 'status', 'unit', 'library', 'variantOf', 'variant', 'files', 'final', 'finals']) delete c[k];
  c.slides = c.slides.map(s => { const { ask, talk, ctx, ...keep } = s; return keep; });
  return c;
}
async function shareBuild(l) {
  const te = new TextEncoder(), z = {}, used = new Set();
  const put = (dir, name, u8) => {
    let n = safeName(name), k = 2; while (used.has((dir + n).toLowerCase())) n = safeName(name).replace(/(\.\w+)?$/, m => ' (' + (k++) + ')' + m);
    used.add((dir + n).toLowerCase()); z[dir + n] = [u8, { level: 0 }]; return dir + n;
  };
  const imgs = new Map(), data = lessonForFile(shareLesson(l), imgs);
  for (const [path, src] of imgs) z[path] = [b64ToU8(src.slice(src.indexOf(',') + 1)), { level: 0 }];
  const files = [];
  for (const f of l.files || []) {
    const b = await fileBlob(f.id); if (!b) continue;
    files.push({ name: f.name, kind: f.kind === 'doc' ? 'doc' : 'other', type: b.type || f.type || '', path: put('files/', f.name, new Uint8Array(await b.arrayBuffer())) });
  }
  let final = null;
  if (l.final) { const b = await fileBlob(l.final.id); if (b) final = { name: l.final.name, path: put('final/', l.final.name, new Uint8Array(await b.arrayBuffer())) }; }
  z['gslesson.json'] = te.encode(JSON.stringify({ kind: SHARE_KIND, version: 1, made: new Date().toISOString().slice(0, 10), lesson: data, files, final }, null, 2));
  z['README.txt'] = te.encode('A lesson from Grading Studio.\r\nOpen it in the Planner: Import a lesson, then choose this file (or drop it on the Planner).\r\n');
  return fflate.zipSync(z);
}
async function shareSave(l) {
  if (!l) return;
  editorCommit();
  let u8; try { u8 = await shareBuild(l); } catch (e) { console.error(e); return toast('The lesson file couldn’t be made'); }
  const name = shareName(l) + SHARE_EXT;
  saveBlob(name, new Blob([u8], { type: 'application/octet-stream' }));
  toast('Saved “' + name + '” (' + finSize(u8.length) + '). Open it in any Grading Studio with Import a lesson.', 6000);
}

const u8ToB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function shareOpen(file) {
  let z, j;
  try { z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { return toast('That lesson file couldn’t be opened'); }
  try { j = JSON.parse(fflate.strFromU8(z['gslesson.json'])); } catch { return toast('That isn’t a lesson file'); }
  if (!j || j.kind !== SHARE_KIND || !j.lesson || !Array.isArray(j.lesson.slides)) return toast('That isn’t a lesson file');
  if (+j.version > 1) toast('That lesson file is from a newer Grading Studio. Some of it may not come in.', 5000);
  // Pictures come back inline, the way the Planner keeps them; a path that isn't in the file is dropped.
  const pic = src => { const m = /^images\/[^/]+\.(png|jpe?g)$/i.exec(src || ''); const d = m && z[src]; return d ? 'data:image/' + (/png/i.test(m[1]) ? 'png' : 'jpeg') + ';base64,' + u8ToB64(d) : src; };
  const x = shareLesson(normLesson({ ...j.lesson, slides: (j.lesson.slides || []).map(s => s && typeof s === 'object' ? { ...s, img: s.img && typeof s.img === 'object' ? { ...s.img, src: pic(s.img.src) } : undefined } : s) }));
  const l = normLesson(x); l.slides.forEach(s => { if (s.img && !imgSrc(s.img.src)) delete s.img; });
  const copy = L.lessons.some(o => o.id === l.id);
  if (copy) { l.id = lid(); l.slides.forEach(s => { s.id = lid(); }); }
  l.created = l.updated = Date.now();
  l.files = [];
  let big = 0;
  for (const f of Array.isArray(j.files) ? j.files : []) {
    const d = f && z[f.path]; if (!d) continue;
    if (d.length > MAX_FILE) { big++; continue; }
    const id = lid(), kind = f.kind === 'doc' ? 'doc' : 'other', b = new Blob([d], { type: kind === 'doc' ? DOC_TYPE : String(f.type || '') || mimeOf(String(f.name || '')) });
    await kvSet('file:' + id, b);
    l.files.push({ id, name: uniqueName(l, String(f.name || 'File')), kind, type: b.type, size: b.size, added: Date.now() });
  }
  if (!l.files.length) delete l.files;
  const fd = j.final && z[j.final.path];
  if (fd && fd.length <= MAX_FILE) {
    const id = lid(); await kvSet('file:' + id, new Blob([fd], { type: MIME.pptx }));
    l.final = { id, name: String(j.final.name || shareName(l) + '.pptx'), size: fd.length, at: Date.now(), sig: finSig(l) };
  }
  L.lessons.push(l); await lPut(l);
  const n = (l.files || []).length;
  toast('Opened “' + l.title + '”: ' + l.slides.length + ' slide' + (l.slides.length === 1 ? '' : 's') + (n ? ', ' + n + ' material' + (n === 1 ? '' : 's') : '') + (l.final ? ', the finished PowerPoint' : '') + '. It is under Not on the timetable until you put it on a day.' +
    (copy ? ' You already had this lesson, so this is a separate copy.' : '') + (big ? ' Too big to keep (over 40 MB): ' + big + ' file' + (big === 1 ? '' : 's') + '.' : ''), 8000);
  openLesson(l);
}
