// New student work on Home, as Today has it (src/app/wiring.js, the drop and the pick buttons; src/app/open.js intake):
// - dropped anywhere on Home: files, a folder or a ZIP, read as they come (a single folder is the download itself, its name the
//   download's); while files are dragged over, Home says where they go. A lesson pack, a lesson file or a .lesson.json dropped here
//   still goes to the Planner (plan/packs.js dropped), as it does anywhere else;
// - Bring in papers, a menu on Home: Files or a ZIP…, A folder…, From Google Drive…, A scan to split… (split onto a class's names,
//   mark/split.jsx) and Files to match to a roster… (mark/bringin.jsx), the same as on an assignment, with none yet.
// This part is light and carries no lines of its own: Home's words come as L, and the bringing in itself (with the marking
// screen's lines) is a part loaded once something is dropped or picked (home/bring.jsx, PARTS.homebring).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Icon, Menu, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { useSaving } from '../../services/saving.js';

const files = e => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
const busyElse = () => !!document.querySelector('dialog[open], [data-welcome]');
// A dropped folder or file, walked into [{ path, file }] (src/app/wiring.js walkEntry)
async function walk(en, at, out) {
  if (en.isFile) { const f = await new Promise((ok, no) => en.file(ok, no)); out.push({ path: at + f.name, file: f }); return; }
  const r = en.createReader();
  for (;;) { const l = await new Promise((ok, no) => r.readEntries(ok, no)); if (!l.length) break; for (const x of l) await walk(x, at + en.name + '/', out); }
}
// One folder holding everything is the download itself: its name is the download's, and it is taken off each path.
const oneFolder = list => {
  const top = list.length && list[0].path.includes('/') ? list[0].path.split('/')[0] : '';
  return top && list.every(x => x.path.startsWith(top + '/')) ? { list: list.map(x => ({ ...x, path: x.path.slice(top.length + 1) })), label: top } : { list, label: '' };
};
export async function fromDrop(entries, list) {
  if (!entries.length) return { list: list.map(f => ({ path: f.name, file: f })), label: '' };
  const out = []; for (const en of entries) await walk(en, '', out);
  return entries.length === 1 && entries[0].isDirectory ? oneFolder(out) : { list: out, label: '' };
}
const picked = l => oneFolder([...l].map(f => ({ path: f.webkitRelativePath || f.name, file: f })));
const readLib = () => import('../../students/counts.js').then(m => m.readLibrary());
// Files only, and each a lesson file, a .json or a ZIP that is a lesson pack: the Planner's, not student work.
async function lessonDrop(entries, list) {
  if (!list.length || entries.some(en => en.isDirectory) || !list.every(f => /\.(zip|gslesson|json)$/i.test(f.name))) return false;
  if (list.every(f => /\.(gslesson|json)$/i.test(f.name))) return true;
  const P = await PARTS.packs();
  for (const f of list) if (/\.zip$/i.test(f.name) && !await P.isPack(f)) return false;
  return true;
}

// The step both share: what was brought, handed to the part that opens it. Returns [bring, what it draws, busy].
function useBring(L) {
  const [job, setJob] = useState(null);
  const bring = (got, { cls, drive } = {}) => {
    if (!got.list.length || job) return;
    PARTS.homebring().then(m => setJob({ B: m.Bring, got, cls, drive }), e => { console.error(e); toast(L.failed); });
  };
  return [bring, job && <job.B job={job} onEnd={() => setJob(null)} />, !!job];
}

export function HomeDrop({ L }) {
  const [over, setOver] = useState(false), [bring, box, busy] = useBring(L);
  const bringRef = useRef(bring); bringRef.current = bring;
  useEffect(() => {
    let left = 0;
    const on = e => { if (!files(e) || busyElse()) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (e.type === 'dragenter') left++; setOver(true); };
    const off = e => { if (e.type === 'dragleave' && --left > 0) return; left = 0; setOver(false); };
    const drop = async e => {
      if (!files(e) || busyElse()) return;
      e.preventDefault(); left = 0; setOver(false);
      // what was dropped is read while the drop lasts; the folders are walked after
      const entries = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean), list = [...e.dataTransfer.files];
      try {
        if (await lessonDrop(entries, list)) return (await PARTS.packs()).dropped(list);
        bringRef.current(await fromDrop(entries, list));
      } catch (er) { console.error(er); toast(L.failed); }
    };
    const evs = [['dragenter', on], ['dragover', on], ['dragleave', off], ['drop', drop]];
    for (const [n, f] of evs) document.addEventListener(n, f);
    return () => { for (const [n, f] of evs) document.removeEventListener(n, f); };
  }, []);
  return <>
    {(over || busy) && <div class="hdrop" role="status" data-hdrop={busy ? 'busy' : 'over'}><Icon name="download" />
      <div><h2>{busy ? L.busy : L.h}</h2>{!busy && <p>{L.say}</p>}</div></div>}
    {box}
  </>;
}

export function HomeBring({ L }) {
  const S = useSaving(), [bring, box, busy] = useBring(L), [part, setPart] = useState(null), drive = useRef(null);
  const fl = useRef(null), fd = useRef(null), sc = useRef(null);
  const pick = r => { drive.current = null; r.current.value = ''; r.current.click(); };
  const took = l => { const d = drive.current; drive.current = null; bring(picked(l), { drive: d }); };
  const scan = f => f && Promise.all([PARTS.split(), readLib()]).then(([M, lib]) => setPart({ split: M, f, lib }), e => console.error(e));
  const match = () => Promise.all([PARTS.bringin(), readLib()]).then(([B, lib]) => setPart({ B, lib, ask: true }), e => console.error(e));
  const g = S ? S.google() : {};
  const items = [{ label: L.files, icon: 'file', onSelect: () => pick(fl) }, { label: L.folder, icon: 'folder', onSelect: () => pick(fd) },
    ...(g.pickNow ? [{ label: t('file.from_drive_pick'), icon: 'drive', onSelect: () => S.driveFill(fl.current, { title: t('drive.pick_many'), papers: true, picked: p => { drive.current = p[0] && { id: p[0].id, name: p[0].name, kind: p.length === 1 && /\.zip$/i.test(p[0].name) ? 'zip' : 'files' }; } }).catch(e => { console.error(e); toast(t('drive.failed')); }) }] : []),
    { label: L.scan, icon: 'image', onSelect: () => pick(sc) }, { label: L.match, icon: 'people', onSelect: match }];
  return <>
    <Menu label={L.bring} items={items} trigger={b => <Button {...b} icon="upload" disabled={busy} data-hbring>{L.bring}</Button>} />
    <input ref={fl} type="file" multiple hidden accept=".zip,.pdf,.docx,.docm,.doc,.png,.jpg,.jpeg,.heic,.heif,.gif,.webp,.mp4,.mov,.m4v,.webm,.mp3,.m4a,.wav,.txt,.md" onChange={e => took(e.currentTarget.files)} data-hbring-in="files" />
    <input ref={fd} type="file" multiple hidden webkitdirectory="" onChange={e => took(e.currentTarget.files)} data-hbring-in="folder" />
    <input ref={sc} type="file" hidden accept=".pdf,application/pdf" onChange={e => scan(e.currentTarget.files[0])} data-hbring-in="scan" />
    {part && part.split && <part.split.Split file={part.f} asg={null} lib={part.lib} onClose={() => setPart(null)} />}
    {part && part.B && part.ask && <part.B.FilesOrFolder kind="match" onClose={() => setPart(null)} onPick={list => setPart({ ...part, ask: false, list })} />}
    {part && part.B && !part.ask && <part.B.MatchRoster list={part.list} lib={part.lib} classId={null} onClose={() => setPart(null)} onGo={(entries, cls) => { setPart(null); bring({ list: entries, label: '' }, { cls }); }} />}
    {box}
  </>;
}
