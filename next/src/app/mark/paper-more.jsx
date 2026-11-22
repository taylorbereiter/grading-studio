// More for this paper, on the marking screen beside the student's name (src/app/student.js whoMore and the bar's person buttons), with
// what the current app's score panel had as links (src/app/panels.js: Edit rubric by the Score heading, All keys, Change the type on a
// formative panel, and src/app/export.js oneOutHtml: Export <name>'s paper now with "Exported at…" under the student). The menu holds
// what is used now and then, so the panel keeps few things to press: Student details, Only this student, Use as an example, Type notes
// instead, Put the score on the paper, the anchor paper, Export this paper now, Edit rubric, Mark key and All keys. Its items are Find
// commands too. Readings… (mark/readings.jsx) opens the files shown above the papers, and the cards above the paper come from here
// too; the Transcripts box (mark/transcripts.jsx) opens from Setup. Both are loaded from here, so the router keeps no line for them.
// A lazy part of its own (router.js PARTS.pmore); mark.jsx only places it.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Menu, Sheet, ShortcutList, toast } from '../../ui/index.js';
import { state, use, noScore, gradeOf, ibSetup } from '../../engines/gcore.js';
import { shownName, anonOn, viewable, namesNow } from '../../engines/gdraw.js';
import { notesFileOf } from '../../engines/gmedia.js';
import { t } from '../../i18n/t.js';
import { addCommand } from '../../services/commands.js';
import { library } from '../../students/index.js';
import { PARTS, href } from '../router.js';
import * as C from './change.js';
import { anchorName } from './score-more.jsx';
import './lines.js';
import './setup-lines.js';
import './paper-lines.js';
import './top-lines.js';

const M = () => PARTS.marking().then(m => m.M);
// Readings (mark/readings.jsx): loaded when the menu or the paper first needs them; RD once it is there
let RD = null, rdWait = null;
const rdSubs = new Set();
const readingsPart = () => rdWait || (rdWait = import('./readings.jsx').then(m => { RD = m; rdSubs.forEach(f => f()); return m; }));
function useReadings() {
  const [, tick] = useState(0);
  useEffect(() => { if (RD) return; const f = () => tick(n => n + 1); rdSubs.add(f); readingsPart().catch(e => console.error(e)); return () => rdSubs.delete(f); }, []);
  return RD;
}
// The readings above this student's paper (src/app/student.js refCard), before the paper itself
export function ReadingCards({ st }) {
  const R = useReadings();
  return R ? <R.Cards st={st} /> : null;
}
// Transcripts for every recording (src/app/readings.js openTranscripts), from Setup: the part with the box
export const transcripts = () => import('./transcripts.jsx');
// the top bar's average, full screen and the Setup menu's links (mark/topbar.jsx), loaded the same way
export const topbar = () => import('./topbar.jsx');
// the roster name of the student on screen (src/people.js personOf): null when the class's roster doesn't know them
function rosterName(st) {
  const b = state().batch, c = b && b.classId != null ? (library.json(null) || { classes: [] }).classes.find(k => k.id === b.classId) : null;
  if (!c) return null;
  if (st.gap && c.names.includes(st.key)) return { c, n: st.key };
  const n = (namesNow().roster.get(st.key) || [])[0];
  return n ? { c, n } : null;
}
const when = ms => { const d = new Date(ms); return d.toDateString() === new Date().toDateString() ? t('setup.r_today', { t: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }) : t('setup.r_on', { d: d.toLocaleDateString([], { day: 'numeric', month: 'short' }) }); };

// One student's paper on its own, with the options on the Return tab (screens/mark-out.jsx one): saved as a file, kept as exported
async function exportNow(st, name) {
  const [E, m] = await Promise.all([PARTS.outEngine(), M()]);
  E.withMarking(m);
  if (E.exporting()) return toast(t('setup.r_busy'));
  try {
    const x = await E.exportOne(st);
    if (x.none) toast(t('setup.r_one_nothing', { name }));
    else { E.saveFile(x.name, x.blob); toast(x.n === 1 ? t('setup.r_one_saved', { name: x.name }) : t('setup.r_one_zip', { n: x.n })); }
  } catch (er) { console.error(er); toast(t('setup.r_wrong', { why: er.message || String(er) })); }
  m.changedNow();
}

// st: the student on screen, cur: where they are. onSolo: Only this student (none while it is on). onSetup: Rubric setup.
export function PaperMore({ st, cur, onSolo, onSetup }) {
  const [box, setBox] = useState(null), R = useReadings();
  const items = moreItems(st, cur, { onSolo, onSetup, open: setBox, R });
  // the same things from Find (gaps A-003), for the student on screen; each runs what the menu has at the time
  const now = useRef(items); now.current = items;
  const cmds = items.filter(x => x.onSelect && !/^an-/.test(x.id));
  useEffect(() => { const th = t('mark.cmd_this');
    const offs = cmds.map(x => addCommand({ id: 'pm-' + x.id, label: x.label, group: th, icon: x.icon, run: () => { const y = now.current.find(z => z.id === x.id); if (y) y.onSelect(); } }));
    return () => offs.forEach(f => f()); }, [cmds.map(x => x.label).join('|')]);
  return <>
    <Menu label={t('top.pm_more')} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('top.pm_more')} data-pmore />} items={items} />
    {box && box.k === 'who' && <Details who={box.who} onClose={() => setBox(null)} />}
    {box && box.k === 'mkey' && <MarkKeySheet onClose={() => setBox(null)} />}
    {box && box.k === 'rd' && R && <R.ReadingsDialog st={st} cur={cur} onClose={() => setBox(null)} />}
    {box && box.k === 'keys' && <Sheet open title={t('keys.title')} onClose={() => setBox(null)}><div data-pmkeys><ShortcutList /></div></Sheet>}
  </>;
}
function moreItems(st, cur, { onSolo, onSetup, open, R }) {
  const name = shownName(st, cur), g = gradeOf(st), fm = state().batch.assignment && state().batch.assignment.type === 'fm', rub = state().setup.mode === 'rubric';
  const who = !anonOn() && rosterName(st), np = notesFileOf(st), vid = st.files.some(f => f.kind === 'media' || f.kind === 'link');
  const ex = st.files.some(f => !f.virtual && !f.rubric && (viewable(f) || f.kind === 'docx'));
  const anch = st.files.length && !noScore(st) && C.anchorsHere(), on = st.grade.anchor || '';
  return [
    ...(who ? [{ id: 'who', label: t('top.pm_details'), icon: 'user', onSelect: () => open({ k: 'who', who }) }] : []),
    ...(onSolo ? [{ id: 'solo', label: t('mark.solo_start'), sub: t('mark.solo_tip'), icon: 'user', kbd: 'I', onSelect: onSolo }] : []),
    { id: 'rd', label: t('top.rd_menu'), sub: R && R.count(st) ? t('top.rd_menu_n', { n: R.count(st) }) : undefined, icon: 'book', onSelect: () => readingsPart().then(() => open({ k: 'rd' }), e => console.error(e)) },
    ...(ex ? [{ id: 'ex', label: t('setup.f_example'), icon: 'spark', onSelect: () => PARTS.exsave().then(m => m.useExample(st), e => console.error(e)) }] : []),
    { id: 'tn', label: np ? t('top.pm_notes') : t('mark.tn_title'), icon: 'note', onSelect: () => PARTS.typed().then(m => m.typeNotes(), e => console.error(e)) },
    ...(vid ? [] : [{ id: 'tm', label: t('setup.tm_title'), icon: 'clock', onSelect: () => PARTS.typed().then(m => m.timerOpen(), e => console.error(e)) }]),
    ...(!fm && !noScore(st) && g.total != null && !ibSetup() ? [{ id: 'stamp', label: t('mark.stamp_tip'), icon: 'stamp', onSelect: () => M().then(m => { if (!state().pages.length) return toast(t('mark.stamp_open')); if (m.scoreStamp(null)) toast(t('mark.stamp_where')); }) }] : []),
    ...(st.files.length ? [{ id: 'out', label: anonOn() ? t('top.pm_export_anon') : t('top.pm_export', { name }), icon: 'download', onSelect: () => exportNow(st, name) }] : []),
    ...(anch ? [{ sep: true }, { heading: t('paper.an_label') }, ...C.ANCHOR_LV.map(lv => ({ id: 'an-' + lv, label: anchorName(lv), checked: on === lv,
      onSelect: () => { if (C.setAnchor(st, lv)) toast(t('paper.an_set', { lv: anchorName(lv) })); } }))] : []),
    { sep: true },
    ...(onSetup && !fm ? [{ id: 'edit', label: rub ? t('top.pm_edit') : t('mark.su_menu'), icon: 'edit', onSelect: onSetup }] : []),
    { id: 'mkey', label: t('setup.sg_mk_h'), icon: 'stamp', onSelect: () => open({ k: 'mkey' }) },
    { id: 'keys', label: t('top.pm_keys'), icon: 'keyboard', kbd: '?', onSelect: () => open({ k: 'keys' }) },
  ];
}

// Student details (src/people.js personCard): the class People page's details for this student, over the paper, with their page a press away
function Details({ who, onClose }) {
  const [P, setP] = useState(null);
  useEffect(() => { PARTS.people().then(setP, e => console.error(e)); }, []);
  return P ? <P.DetailsSheet c={who.c} n={who.n} more={<a class="link" href={href('class', who.c.id, 'people', who.c.names.indexOf(who.n) + 1)} data-pmpage>{t('top.pm_page')}</a>} onClose={onClose} /> : null;
}
// The mark key (src/stamps.js openMarkKey), the same card as Settings > Marking
function MarkKeySheet({ onClose }) {
  const [S, setS] = useState(null);
  useEffect(() => { PARTS.setgrade().then(setS, e => console.error(e)); }, []);
  return <Sheet open title={t('setup.sg_mk_h')} onClose={onClose}>{S ? <div data-pmmkey><S.MarkKey /></div> : <div class="loading" aria-busy="true" />}</Sheet>;
}

// Under the student's name: when this paper last went out on its own (export.js oneOutHtml)
export function Sent({ st }) {
  return st.grade.sent ? <p class="mk-sent" data-pmsent>{t('top.pm_sent', { when: when(st.grade.sent) })}</p> : null;
}
// The Score heading with Edit rubric beside it (panels.js editRubric)
export function ScoreHead({ onSetup }) {
  const rub = state().setup.mode === 'rubric';
  return <h3 class="mk-h mk-shead">{t('mark.score')}<button type="button" class="link" onClick={onSetup} data-editrubric>{rub ? t('top.pm_edit') : t('top.pm_edit_pts')}</button></h3>;
}
// On a formative panel: Change the type (panels.js fbType), the assignment's own box; a type with a score brings the score back
export function ChangeType() {
  const [A, setA] = useState(null), a = state().batch.assignment;
  if (!a || !a.id) return null;
  // the library as saved now goes to the engines (as mark/open.js begin does), and the open work takes the card as it is now
  const done = ok => { setA(null); if (!ok) return; const l = library.json(null), b = state().batch; if (!l) return;
    for (const c of l.classes || []) { c.units ||= []; c.names ||= []; } l.loose ||= { id: '', units: [] }; l.loose.units ||= [];
    use({ lib: l });
    for (const c of [...l.classes, l.loose]) for (const u of c.units) { const it = (u.items || []).find(x => x.id === a.id); if (it) b.assignment = it; }
    M().then(m => m.changedNow()); };
  return <><button type="button" class="link" onClick={() => PARTS.asg().then(m => setA(() => m.AssignmentDialog), e => console.error(e))} data-fbtype>{t('top.pm_type')}</button>
    {A && <A lib={library.json(null)} it={a} onClose={done} />}</>;
}
