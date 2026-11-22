// Settings > Grading and scales, the points colour under Settings > Marking, and the unit plan tool's name under Settings > Classes and
// terms: the current app's src/welcome.js meSetRender ('grading'), its #setPane handlers (data-meway, meRowTop, meRowHalf, mebl, mebp)
// and src/app/start.js setPtsInk. How she usually grades is kept on the library (lib.me.grade) and as her last setup (gs.setup), so the
// next new assignment starts from it; both change as one undo step. Choosing a way for the first time happens at once with Undo, where
// the current app asks first. Boxes save when she leaves them (preact/compat turns onChange into every key). Loaded only on those settings pages (PARTS.setgrade).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Card, Select, Switch, TextInput, HeldInput, Slider, Segmented, Button, IconButton, toast } from '../../ui/index.js';
import { applySize } from '../../services/size.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { library, gradingSetup } from '../../students/index.js';
import { prefs } from '../../students/prefs.js';
import { mailGet, mailSet, MAIL_APPS } from '../../students/mailpref.js';
import { onSaved } from '../../shared/saved.js';
import * as undoList from '../../services/undo.js';
import { GRADE_WAYS, gradeWay, meGrade, ME_OLD, useLib } from '../../engines/gways.js';
import { readLibrary, J, change, useLibraryPlain } from './settings-me.js';
import { rowScaleOf, rowsTop, rowHalf, rowsSay, ROW_TOP, COLORS, PTS_AMBER } from '../../engines/gcore.js';
import { PROOF, PUNCT, markLabel0, MARK_MEAN, MARK_KEY } from '../../engines/gkey.js';
import { drawStamp } from '../../engines/gdraw.js';
import '../mark/setup-lines.js';

const ROW_TOP_MAX = 10;
export const useLibrary = () => { const L = useLibraryPlain(); useLib(L); return L; };
const WAYS = { rubric: ['setup.sg_way_rubric', 'setup.sg_way_rubric_say'], points: ['setup.sg_way_points', 'setup.sg_way_points_say'], percent: ['setup.sg_way_percent', 'setup.sg_way_percent_say'], letters: ['setup.sg_way_letters', 'setup.sg_way_letters_say'], myp: ['setup.sg_way_myp', 'setup.sg_way_myp_say'], ib7: ['setup.sg_way_ib7', 'setup.sg_way_ib7_say'] };
const wayName = k => t(WAYS[k][0]), waySay = k => t(WAYS[k][1]);
const INKS = { red: 'setup.sg_c_red', blue: 'setup.sg_c_blue', green: 'setup.sg_c_green', purple: 'setup.sg_c_purple', black: 'setup.sg_c_black' };

export function GradingSettings() {
  const L = useLibrary(), g = meGrade(), way = g ? g.way : '';
  const pick = k => {
    const w = gradeWay(k); if (!w || way === k) return;
    change(t('setup.sg_step_way'), me => { me.grade = { way: w[0], setup: J(w[3]), ...(w[4] ? { bands: w[4].map(b => b.slice()) } : {}) }; return J(w[3]); }, t('setup.sg_way_done', { way: wayName(k) }));
  };
  const keys = e => {
    if (!/^Arrow/.test(e.key)) return;
    e.preventDefault(); const i = GRADE_WAYS.findIndex(w => w[0] === way), d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const k = GRADE_WAYS[(i + d + GRADE_WAYS.length) % GRADE_WAYS.length][0]; pick(k);
    setTimeout(() => { const b = document.querySelector('[data-sgway="' + k + '"]'); if (b) b.focus(); }, 50);
  };
  const rowScale = (top, half) => change(t('setup.sg_step_rows'), me => {
    const su = { ...meGrade().setup }; for (const k of ['top', 'tops', 'half']) delete su[k];
    Object.assign(su, rowScaleOf({ top, half })); me.grade = { ...me.grade, setup: su }; return su;
  }, t('setup.sg_rows_done', { how: rowsSay(rowScaleOf({ top, half })) }));
  const band = (i, part, v) => change(t('setup.sg_step_bands'), me => {
    const bands = g.bands.map((b, k) => k !== i ? b.slice() : part === 'l' ? [b[0], (String(v).trim() || b[1]).slice(0, 12)] : [k === g.bands.length - 1 ? 0 : Math.max(0, Math.min(100, Math.round(+v) || 0)), b[1]]);
    me.grade = { ...me.grade, bands };
  });
  const tops = g ? rowsTop(g.setup) || ROW_TOP : ROW_TOP;
  return <>
    <Card title={t('setup.sg_way_h')}>
      <p class="mute">{t('setup.sg_way_about')}</p>
      <div class="sg-ways" role="radiogroup" aria-label={t('setup.sg_way_h')} onKeyDown={keys}>
        {GRADE_WAYS.map(([k]) => <button type="button" class={'sg-way' + (way === k ? ' on' : '')} role="radio" aria-checked={way === k} tabIndex={way === k || (!way && k === GRADE_WAYS[0][0]) ? 0 : -1} onClick={() => pick(k)} data-sgway={k}>
          <b>{wayName(k)}</b><span>{waySay(k)}</span></button>)}
      </div>
      {!g && <p class="hint" data-sgnone>{t('setup.sg_way_none')}</p>}
      {g && g.way === 'rubric' && <div class="sg-rows">
        <Select label={t('setup.sg_rows_top')} value={String(tops)} options={Array.from({ length: ROW_TOP_MAX }, (_, k) => ({ value: String(k + 1), label: String(k + 1) }))} onChange={v => rowScale(+v, rowHalf(g.setup))} data-sgtop />
        <Switch label={t('setup.sg_rows_half')} checked={rowHalf(g.setup)} onChange={v => rowScale(tops, v)} />
        <p class="hint">{t('setup.sg_rows_about')}</p>
      </div>}
    </Card>
    {g && g.bands && <Card title={t(g.way === 'ib7' ? 'setup.sg_bands_ib' : 'setup.sg_bands')}>
      <p class="mute">{t('setup.sg_bands_about')}</p>
      <div class="sg-bands">{g.bands.map((b, i) => <div class="sg-band" data-sgband={i}>
        <HeldInput class="input" type="text" maxLength={12} value={b[1]} aria-label={t('setup.sg_band_name', { n: i + 1 })} onChange={e => band(i, 'l', e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-raw data-sgbl={i} />
        <span>{t('setup.sg_from')}</span>
        <HeldInput class="input" type="number" min="0" max="100" step="1" value={b[0]} disabled={i === g.bands.length - 1} aria-label={t('setup.sg_band_from', { name: b[1] })} onChange={e => band(i, 'p', e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-sgbp={i} />
        <span>%</span></div>)}</div>
    </Card>}
    <span hidden data-sglib={L.me ? 1 : 0} />
  </>;
}

// Settings > Marking. Mark colors (src/quiz.js inkRows, Settings' #setInkRows): the colour of ✗ and the pen (gs.ink), of checks
// (gs.checkInk) and of points written on a paper (gs.ptsInk: the pen's colour, one colour, or by credit). Paper and text (src/app/display.js
// openDisplay): new text boxes, fit width or the whole page, and Word documents' text size and line spacing (gs.disp). Kept on this computer.
// A chip that stays on or off. Made once here, so a choice doesn't make the buttons again and lose the keyboard's place.
const Chip = ({ on, onClick, children, ...rest }) => <button type="button" class="chip" aria-pressed={String(!!on)} onClick={onClick} {...rest}>{children}</button>;
// A set of colours that belong together: one stop in the Tab order (the one that is on), the arrow keys among them (as mark/rove.js).
function InkRow({ label, children }) {
  const r = useRef(null), all = () => [...r.current.querySelectorAll('button')];
  useEffect(() => { const b = all(), on = b.find(x => x === document.activeElement) || b.find(x => x.getAttribute('aria-pressed') === 'true') || b[0]; b.forEach(x => { x.tabIndex = x === on ? 0 : -1; }); });
  const key = e => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key], b = all(), i = b.indexOf(document.activeElement); if (!d || i < 0) return; e.preventDefault(); const n = b[(i + d + b.length) % b.length]; b.forEach(x => { x.tabIndex = x === n ? 0 : -1; }); n.focus(); };
  return <div class="sg-inkrow" role="group" aria-label={label} ref={r} onKeyDown={key} data-rove><span>{label}</span>{children}</div>;
}
const DISP0 = { tsize: 14, fit: 'width', dfs: 15, dlh: 1.45 };
const okInk = (k, d) => (COLORS[k] ? k : d);
export function MarkingSettings() {
  const [, again] = useState(0), re = () => again(n => n + 1);
  const ink = okInk(prefs.get('gs.ink', 'red'), 'red'), chk = okInk(prefs.get('gs.checkInk', 'green'), 'green');
  const pts = (k => (k === 'credit' || COLORS[k] ? k : ''))(prefs.get('gs.ptsInk', ''));
  const disp = { ...DISP0, ...(prefs.get('gs.disp', null) || {}) };
  const setDisp = (k, v) => { prefs.set('gs.disp', { ...(prefs.get('gs.disp', null) || {}), [k]: v }); re(); };
  // Back to normal (src/app/display.js data-reset): the text boxes, the paper's fit, Word's size and spacing and the app's text size as
  // they start; how a grade is cropped on the sheet (trim) stays
  const dispReset = () => { const d = prefs.get('gs.disp', null) || {}; if (d.trim != null) prefs.set('gs.disp', { trim: d.trim }); else prefs.del('gs.disp'); prefs.del('gs.zoom'); applySize(1); re(); };
  const setPts = k => { if (k) prefs.set('gs.ptsInk', k); else prefs.del('gs.ptsInk'); re(); };
  const sw = c => <i class="sg-sw" style={{ background: c }} />;
  const row = (label, on, pick, attr) => <InkRow label={label}>
    {Object.entries(COLORS).map(([k, c]) => <Chip on={on === k} onClick={() => { pick(k); re(); }} {...{ [attr]: k }}>{sw(c)}{t(INKS[k])}</Chip>)}</InkRow>;
  return <>
    <Card title={t('setup.sg_inks_h')}>
      <p class="mute">{t('setup.sg_inks_about')}</p>
      {row(t('setup.sg_ink_x'), ink, k => prefs.set('gs.ink', k), 'data-sgink')}
      {row(t('setup.sg_ink_ok'), chk, k => prefs.set('gs.checkInk', k), 'data-sgchk')}
      <InkRow label={t('setup.sg_pts_h')}>
        <Chip on={pts === ''} onClick={() => setPts('')} data-sgpts="">{t('setup.sg_pts_pen')}</Chip>
        {Object.entries(COLORS).map(([k, c]) => <Chip on={pts === k} onClick={() => setPts(k)} data-sgpts={k}>{sw(c)}{t(INKS[k])}</Chip>)}
        <Chip on={pts === 'credit'} onClick={() => setPts('credit')} data-sgpts="credit">{t('setup.sg_pts_credit')} {sw(COLORS[chk])}{sw(PTS_AMBER)}{sw(COLORS[ink])}</Chip></InkRow>
      {pts === 'credit' && <p class="hint">{t('setup.sg_pts_credit_say')}</p>}
    </Card>
    <Card title={t('setup.sg_disp_h')}><div class="sg-disp">
      <Slider label={t('setup.sg_tsize')} min={8} max={32} step={1} value={+disp.tsize || 14} onInput={v => setDisp('tsize', v)} format={v => t('setup.sg_pt', { n: v })} />
      <div class="sg-line"><span>{t('setup.sg_fit')}</span><Segmented label={t('setup.sg_fit')} value={disp.fit === 'page' ? 'page' : 'width'} onChange={v => setDisp('fit', v)} options={[{ value: 'width', label: t('setup.sg_fit_width') }, { value: 'page', label: t('setup.sg_fit_page') }]} /></div>
      <Slider label={t('setup.sg_dfs')} min={12} max={24} step={1} value={+disp.dfs || 15} onInput={v => setDisp('dfs', v)} format={v => t('setup.sg_px', { n: v })} />
      <div class="sg-line"><span>{t('setup.sg_dlh')}</span><Segmented label={t('setup.sg_dlh')} value={String(+disp.dlh || 1.45)} onChange={v => setDisp('dlh', +v)} options={[{ value: '1.3', label: t('setup.sg_dlh_tight') }, { value: '1.45', label: t('setup.sg_dlh_normal') }, { value: '1.8', label: t('setup.sg_dlh_roomy') }]} /></div>
      <p class="hint">{t('setup.sg_disp_about')}</p>
      <div><Button onClick={dispReset} data-sgdreset>{t('setup.l_reset')}</Button></div>
    </div></Card>
    <Card title={t('setup.sg_names_h')}><p class="mute">{t('setup.sg_names_about')}</p>
      <span data-sgnames><Segmented label={t('setup.sg_names_h')} value={prefs.get('gs.nameFind', false) ? 'find' : 'mine'} onChange={v => { if (v === 'find') prefs.set('gs.nameFind', true); else prefs.del('gs.nameFind'); re(); }}
        options={[{ value: 'mine', label: t('setup.sg_names_mine') }, { value: 'find', label: t('setup.sg_names_find') }]} /></span></Card>
    <Card title={t('setup.sg_while_h')}><div class="sg-while">
      <span data-sglist><Switch label={t('setup.sg_list_kept')} checked={prefs.get('gs.listOpen', null) !== false} onChange={v => { prefs.set('gs.listOpen', !!v); re(); }} /></span>
      <span data-sgenter><Switch label={t('setup.sg_enter_next')} checked={prefs.get('gs.enterNext', null) !== false} onChange={v => { if (v) prefs.del('gs.enterNext'); else prefs.set('gs.enterNext', false); re(); }} /></span>
      <p class="hint">{t('setup.sg_while_about')}</p>
    </div></Card>
    <SavedComments />
    <MarkKey />
  </>;
}

// Her saved comments (gs.bank, students/comments.js): changed in place, moved up, or removed with Undo. The comment box offers the same list.
function SavedComments() {
  const [bank, setBank] = useState(null), [add, setAdd] = useState('');
  useEffect(() => { let live = true; const read = () => PARTS.cbank().then(m => m.readBank()).then(b => { if (live) setBank(b); });
    read(); const off = onSaved(e => { if (e.kind === 'setting' && e.id === 'gs.bank') read(); }); return () => { live = false; off(); }; }, []);
  if (!bank) return null;
  const change = (label, fn, said) => PARTS.cbank().then(m => { m.changeBank(label, fn); if (said) toast(said, { undo: () => undoList.undo() }); });
  const edit = (i, v) => { v = String(v || '').trim(); if (v === bank[i]) return; if (!v) return remove(i); change(t('setup.sg_cb_step_edit'), l => { l[i] = v; return l.filter((c, k) => k === i || c !== v); }); };
  const remove = i => change(t('setup.sg_cb_step_remove'), l => { l.splice(i, 1); return l; }, t('setup.sg_cb_removed'));
  const up = i => change(t('setup.sg_cb_step_move'), l => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; return l; });
  const plus = () => { const v = add.trim(); if (!v) return; setAdd(''); change(t('setup.sg_cb_step_add'), l => (l.includes(v) ? l : [v, ...l])); };
  return <Card title={t('setup.sg_cb_h')}>
    <p class="mute">{t('setup.sg_cb_about')}</p>
    <ol class="sg-cb">{bank.map((c, i) => <li key={c + i} data-sgcb={i}>
      <TextInput label={t('setup.sg_cb_n', { n: i + 1 })} value={c} maxLength={600} data-raw onBlur={e => edit(i, e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <IconButton icon="chu" label={t('setup.sg_cb_up')} disabled={i === 0} onClick={() => up(i)} data-sgcbup={i} />
      <IconButton icon="trash" label={t('setup.sg_cb_remove')} onClick={() => remove(i)} data-sgcbrm={i} /></li>)}</ol>
    {!bank.length && <p class="mute">{t('setup.sg_cb_none')}</p>}
    <div class="sg-cbadd"><TextInput label={t('setup.sg_cb_add')} value={add} maxLength={600} onInput={setAdd} onKeyDown={e => { if (e.key === 'Enter') plus(); }} data-raw data-sgcbnew /><Button onClick={plus} data-sgcbadd>{t('setup.sg_cb_add_btn')}</Button></div>
  </Card>;
}

// A mark as it looks on the paper (src/stamps.js stampPicture), in her pen colour
function MarkPic({ k }) {
  const ref = useRef(null);
  useEffect(() => { const c = ref.current, dpr = window.devicePixelRatio || 1, sz = 30; c.width = c.height = Math.round(sz * dpr); c.style.width = c.style.height = sz + 'px';
    const x = c.getContext('2d'); x.scale(dpr, dpr); drawStamp(x, { t: 'stamp', k, x: sz / 2, y: sz / 2, size: 16, color: COLORS[okInk(prefs.get('gs.ink', 'red'), 'red')] }); }, [k]);
  return <canvas ref={ref} class="sg-mkpic" aria-hidden="true" />;
}
// The mark key (src/stamps.js openMarkKey, gs.markKey): her own name and meaning for each proofreading and punctuation mark, and
// whether returned papers get a key page listing the ones used. Each box saves when she leaves it.
export function MarkKey() {
  const [, again] = useState(0), re = () => again(n => n + 1);
  const set0 = () => { const v = prefs.get(MARK_KEY, null); return v && typeof v === 'object' ? v : {}; };
  const setKey = change => { const v = { ...set0() }; change(v); prefs.set(MARK_KEY, v); re(); };
  const s = set0(), name = k => { const v = (s.names || {})[k]; return typeof v === 'string' && v.trim() ? v.trim() : markLabel0(k); };
  const mean = k => { const m = s.means || {}; return typeof m[k] === 'string' ? m[k].trim() : (MARK_MEAN[k] || ''); };
  const setName = (k, v) => setKey(o => { o.names = { ...(o.names || {}) }; if (v.trim() && v.trim() !== markLabel0(k)) o.names[k] = v; else delete o.names[k]; });
  const setMean = (k, v) => setKey(o => { o.means = { ...(o.means || {}) }; if (v.trim() !== (MARK_MEAN[k] || '')) o.means[k] = v; else delete o.means[k]; });
  const usual = k => setKey(o => { o.names = { ...(o.names || {}) }; o.means = { ...(o.means || {}) }; delete o.names[k]; delete o.means[k]; });
  const row = ([k]) => { const own = typeof (s.names || {})[k] === 'string' && s.names[k].trim() || typeof (s.means || {})[k] === 'string';
    return <div class="sg-mk" key={k} data-sgmk={k}><MarkPic k={k} />
      <TextInput label={t('setup.sg_mk_name')} value={name(k)} maxLength={40} data-raw onBlur={e => { if (e.currentTarget.value !== name(k)) setName(k, e.currentTarget.value); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <TextInput label={t('setup.sg_mk_mean')} value={mean(k)} maxLength={300} data-raw onBlur={e => { if (e.currentTarget.value.trim() !== mean(k)) setMean(k, e.currentTarget.value); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      {own && <button type="button" class="link" onClick={() => usual(k)} data-sgmkusual={k}>{t('setup.sg_mk_usual')}</button>}</div>; };
  return <Card title={t('setup.sg_mk_h')}>
    <span data-sgmkon><Switch label={t('setup.sg_mk_on')} checked={s.on !== false} onChange={v => setKey(o => { o.on = v; })} /></span>
    <p class="hint">{t('setup.sg_mk_about')}</p>
    <h4 class="sg-mkh">{t('setup.sg_mk_proof')}</h4>{PROOF.map(row)}
    <h4 class="sg-mkh">{t('setup.sg_mk_punct')}</h4>{PUNCT.map(row)}
  </Card>;
}

// The word on unit plan links, for example the name of the school's unit planner (src/app/library.js unitLinkName). Only words on screen.
export function ClassesSettings() {
  const L = useLibrary(), now = String((L.me || ME_OLD).unit || '').trim();
  const save = v => { v = String(v || '').trim().slice(0, 40); if (v === now) return; change(t('setup.sg_step_unit'), me => { me.unit = v; }, v ? t('setup.sg_unit_done', { name: v }) : t('setup.sg_unit_none')); };
  const att = !(L.me && L.me.att === false), kept = (L.classes || []).reduce((a, c) => a + Object.keys(c.att || {}).filter(d => /^\d{4}-\d\d-\d\d$/.test(d)).length, 0);
  const [mail, setMail] = useState(mailGet);
  return <>
    <Card title={t('setup.sg_unit_h')}>
      <TextInput label={t('setup.sg_unit_label')} hint={t('setup.sg_unit_about')} value={now} maxLength={40} onBlur={e => save(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-raw data-sgunit />
    </Card>
    <Card title={t('setup.sg_att_h')}>
      <p class="mute small">{t('setup.sg_att_say')}</p>
      <span data-sgatt><Switch label={t('setup.sg_att_on')} checked={att} onChange={v => change(t('setup.sg_att_step'), me => { if (v) delete me.att; else me.att = false; })} /></span>
      {!att && kept > 0 && <p class="mute small" data-sgatt-kept>{t('setup.sg_att_kept', { n: kept })}</p>}
    </Card>
    <Card title={t('setup.sg_mail_h')}>
      <p class="mute small">{t('setup.sg_mail_say')}</p>
      <span data-sgmail><Segmented label={t('setup.sg_mail_h')} value={mail} onChange={v => { mailSet(v); setMail(v); }} options={MAIL_APPS.map(k => ({ value: k, label: t(MAILS[k]) }))} /></span>
    </Card>
  </>;
}
const MAILS = { gmail: 'setup.sg_mail_gmail', outlook: 'setup.sg_mail_outlook', app: 'setup.sg_mail_app' };
