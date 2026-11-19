// A rubric brought in for an assignment from its card (src/rubricup.js rubricRead, ruHtml, ruWire, ruPut; D-901, B-001, B-004,
// B-008): in New and Edit assignment, and from the card's Bring in menu before any papers. A Word rubric's table and a PDF made from a
// document are read for their rows (gsetup ruFromWord, ruFromPdf); a picture or a scan can only be the copy to mark on. Nothing is
// sent anywhere. What is picked goes on the card's own setup (setupOver, rubricRowsInto) and the copy is kept as Rubric setup keeps
// it (gs.rp.<id>), so the marking screen opens with it and asks there if scores already given would change (open.js rubricAt).
// The first rubric set up for an assignment added to several classes goes to the copies that have none (screens.js shareRubric).
import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Button, Checkbox, Dialog, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { setupOver, fmtNum, state, use } from '../../engines/gcore.js';
import * as B from '../../engines/gbook.js';
import { libraryChange } from '../../students/undo.js';
import { gradingSetup } from '../../students/index.js';
import { PARTS } from '../router.js';
import { DriveButton } from '../drive-button.jsx';
import '../mark/lines.js';
import '../mark/setup-lines.js';
import './lines.js';
import { heicSay } from '../mark/heic.js';

const J = v => JSON.parse(JSON.stringify(v));
const itemIn = (l, id) => { for (const c of [...l.classes, l.loose]) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return it; } return null; };
const ACCEPT = '.docx,.docm,.pdf,.png,.jpg,.jpeg,.heic,.heif,.webp,image/*,application/pdf';

// file: a File. Gives { name, word, page: bytes of the copy to mark on (a PDF, or the Word file), rows: [{ name, levels }], top } or throws.
export async function readRubric(file) {
  const bytes = new Uint8Array(await file.arrayBuffer()), name = file.name;
  const [S, E] = await Promise.all([import('../../engines/gsetup.js'), import('../../engines/gopen.js')]);
  if (/\.(docx|docm|dotx|dotm)$/i.test(name)) {
    const Z = state().fflate || await PARTS.zip(); use({ fflate: Z });
    let got = null; try { got = S.ruFromWord(bytes); } catch (e) { console.error(e); }
    if (!got && !Z.unzipSync(bytes)['word/document.xml']) throw new Error('not word');
    return { name, word: true, page: bytes, rows: got ? got.rows : [], top: got ? got.top : 0 };
  }
  const [P, PDFLib] = await Promise.all([PARTS.pdf(), PARTS.pdflib()]);
  if (!state().pdfjsLib) use({ pdfjsLib: P.pdfjs() });
  use({ PDFLib });
  heicSay(name);
  const m = await E.makeFile(name, bytes);
  if (m.kind !== 'pdf' && m.kind !== 'img') throw new Error('not a page');
  await PDFLib.PDFDocument.load(m.data, { ignoreEncryption: true });
  let got = null; if (m.kind === 'pdf' && m.data === bytes) try { got = await S.ruFromPdf(bytes); } catch (e) { console.error(e); }
  return { name, word: false, page: m.data, rows: got ? got.rows : [], top: got ? got.top : 0 };
}

// Puts what was picked on the card (and on its linked copies when also), as one undo step. Gives true once it's on.
export async function putRubric(id, got, also) {
  if (!got || (!got.rows && !got.copy)) return true;
  const r = got.r, S = await import('../../engines/gsetup.js');
  let page = null;
  if (got.copy) {
    const W = await PARTS.write(), pid = Math.random().toString(36).slice(2, 10);
    let bin = ''; for (let i = 0; i < r.page.length; i += 0x8000) bin += String.fromCharCode.apply(null, r.page.subarray(i, i + 0x8000));
    try { W.keepRubricPage(pid, btoa(bin)); } catch (e) { console.error(e); toast(t('setup.su_too_big')); return false; }
    page = { id: pid, name: r.name };
  }
  let name = '';
  const ok = await libraryChange(t('class.ru_step'), l => {
    B.bookUse({ lib: l });
    const it = itemIn(l, id); if (!it) return;
    const d = J(setupOver(it.setup || gradingSetup.json(null)));
    if (got.rows) S.rubricRowsInto(d, r);
    if (page) { d.rubricPage = page; d.rubricPos = r.word ? 'start' : 'end'; }
    delete d.spot; it.setup = d; name = it.name;
    if (it.group) for (const c of [...l.classes, l.loose]) for (const u of c.units) for (const x of u.items) if (x !== it && x.group === it.group && !x.setup) x.setup = J(d);
    if (also) for (const { it: x } of B.lkTwins(it)) x.setup = B.lkCopy(d);
  }, true).catch(e => { console.error(e); toast(t('mark.cannot')); return false; });
  if (ok === false) return false;
  toast(t('class.ru_set', { name }));
  return true;
}

// What an assignment's rubric is, in a few words. What the teacher wrote stays as written in every language.
function Says({ su }) {
  if (!su) return <span class="mute" data-rusays>{t('class.ru_none')}</span>;
  return <span data-rusays>{su.mode === 'rubric' ? <span>{t('setup.su_rows')}: <span data-raw>{(su.criteria || []).join(' · ')}</span></span>
    : <span>{t('class.ru_total', { n: fmtNum(+su.outOf || 0) })}</span>}
    {su.rubricPage && <span><br />{t('setup.su_page')}: <span data-raw>{su.rubricPage.name || t('setup.su_page_name')}</span></span>}</span>;
}

// The part of a box that brings in a rubric. su: the card's setup. onGot(got): what was read and picked, or null. now: a Use this
// rubric button puts it on the card straight away (onUse after); without it the box's own Save does, with putRubric.
export function RubricField({ su, onGot, now, onUse }) {
  const inp = useRef(null), [got, setGot0] = useState(null), [busy, setBusy] = useState(false);
  const setGot = g => { setGot0(g); if (onGot) onGot(g); };
  const read = async f => {
    if (!f) return; setBusy(true);
    try { const r = await readRubric(f); setGot({ r, rows: !!r.rows.length, copy: !r.rows.length }); }
    catch (e) { console.error(e); toast(t('setup.su_bad_file')); }
    setBusy(false);
  };
  const use = async () => { if (!got.rows && !got.copy) return toast(t('class.ru_tick')); if (await onUse(got)) setGot(null); };
  const r = got && got.r;
  return <div class="cp-fld rubup" data-rubup>
    <span class="lab">{t('class.ru_h')}</span>
    <Says su={su} />
    <div class="rurow">
      <input type="file" ref={inp} accept={ACCEPT} hidden data-rufile onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; read(f); }} />
      <Button size="sm" disabled={busy} onClick={() => inp.current.click()} data-rupick>{t('setup.su_bring')}</Button>
      <DriveButton input={inp} office />
    </div>
    <p class="mute small">{t('class.ru_say')}</p>
    {r && <div class="rugot" data-rugot>
      <p><b data-raw>{r.name}</b></p>
      {r.rows.length ? <div><p>{t('setup.su_found')}</p>
        <ol class="rurows">{r.rows.map(x => <li><b data-raw>{x.name}</b>{Object.keys(x.levels).length > 0 && <span class="mute small" data-raw> {Object.entries(x.levels).sort((a, b) => b[0] - a[0]).map(([v, s]) => v + ': ' + s).join(' · ').slice(0, 160)}</span>}</li>)}</ol>
        <span data-rurows><Checkbox label={t('class.ru_score')} checked={got.rows} onChange={v => setGot({ ...got, rows: v })} /></span></div>
        : <p class="mute small" data-runo>{t('class.ru_norows')}</p>}
      <span data-rucopy><Checkbox label={t('class.ru_copy')} checked={got.copy} onChange={v => setGot({ ...got, copy: v })} /></span>
      {now && <div><Button size="sm" variant="primary" onClick={use} data-ruuse>{t('class.ru_use')}</Button></div>}
    </div>}
  </div>;
}

// From the card's Bring in menu (the current app's Open box): the rubric part on its own, used at once.
export function RubricBox({ it, onClose }) {
  const use = async got => { const ok = await putRubric(it.id, got, false); if (ok) onClose(true); return ok; };
  return <Dialog open title={t('class.ru_t', { name: it.name })} onClose={() => onClose(false)} actions={<Button onClick={() => onClose(false)}>{t('setup.u_cancel')}</Button>}>
    <RubricField su={it.setup || null} now onUse={use} />
  </Dialog>;
}
