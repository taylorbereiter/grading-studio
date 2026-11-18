// Settings > Grading and scales, the points colour under Settings > Marking, and the unit plan tool's name under Settings > Classes and
// terms: the current app's src/welcome.js meSetRender ('grading'), its #setPane handlers (data-meway, meRowTop, meRowHalf, mebl, mebp)
// and src/app/start.js setPtsInk. How she usually grades is kept on the library (lib.me.grade) and as her last setup (gs.setup), so the
// next new assignment starts from it; both change as one undo step. Choosing a way for the first time happens at once with Undo, where
// the current app asks first. Boxes save when she leaves them (preact/compat turns onChange into every key). Loaded only on those settings pages (PARTS.setgrade).
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Select, Switch, TextInput, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { library, gradingSetup } from '../../students/index.js';
import { prefs } from '../../students/prefs.js';
import { onSaved } from '../../shared/saved.js';
import * as undoList from '../../services/undo.js';
import { GRADE_WAYS, gradeWay, meGrade, ME_OLD, useLib } from '../../engines/gways.js';
import { rowScaleOf, rowsTop, rowHalf, rowsSay, ROW_TOP, COLORS, PTS_AMBER, CHECK_INK } from '../../engines/gcore.js';
import '../mark/setup-lines.js';
import '../mark/lines.js';

const readLibrary = () => library.json(null) || {};
const J = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const ROW_TOP_MAX = 10;
const useLibrary = () => {
  const [, again] = useState(0);
  useEffect(() => onSaved(e => { if (e.kind === 'library' || e.kind === 'setting') again(n => n + 1); }), []);
  const L = readLibrary(); useLib(L); return L;
};
// lib.me and gs.setup as they are, put back or forward as one step
async function put(me, su, keepSu) {
  const W = await PARTS.write();
  await W.saveLibrary(l => { if (me) l.me = J(me); else delete l.me; });
  if (keepSu) W.saveSetting('gs.setup', su == null ? null : J(su));
}
async function change(label, f, said) {
  const L = readLibrary(), me0 = J(L.me || null), su0 = gradingSetup.json(null);
  const me1 = J(L.me || ME_OLD), su1 = f(me1);   // f changes her settings and gives the new last setup, or undefined to leave it
  const keepSu = su1 !== undefined;
  if (JSON.stringify(me1) === JSON.stringify(L.me || null) && (!keepSu || JSON.stringify(su1) === JSON.stringify(su0))) return;   // nothing changed: no step
  await put(me1, su1, keepSu);
  undoList.record({ label, undo: () => put(me0, su0, keepSu), redo: () => put(me1, su1, keepSu) });
  if (said) toast(said, { undo: undoList.undo });
}
const WAYS = { rubric: ['setup.sg_way_rubric', 'setup.sg_way_rubric_say'], points: ['setup.sg_way_points', 'setup.sg_way_points_say'], percent: ['setup.sg_way_percent', 'setup.sg_way_percent_say'], letters: ['setup.sg_way_letters', 'setup.sg_way_letters_say'], myp: ['setup.sg_way_myp', 'setup.sg_way_myp_say'], ib7: ['setup.sg_way_ib7', 'setup.sg_way_ib7_say'] };
const wayName = k => t(WAYS[k][0]), waySay = k => t(WAYS[k][1]);
const INKS = { red: 'mark.c_red', blue: 'mark.c_blue', green: 'mark.c_green', purple: 'mark.c_purple', black: 'mark.c_black' };

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
        <input class="input" type="text" maxLength={12} value={b[1]} aria-label={t('setup.sg_band_name', { n: i + 1 })} onBlur={e => band(i, 'l', e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-raw data-sgbl={i} />
        <span>{t('setup.sg_from')}</span>
        <input class="input" type="number" min="0" max="100" step="1" value={b[0]} disabled={i === g.bands.length - 1} aria-label={t('setup.sg_band_from', { name: b[1] })} onBlur={e => band(i, 'p', e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-sgbp={i} />
        <span>%</span></div>)}</div>
    </Card>}
    <span hidden data-sglib={L.me ? 1 : 0} />
  </>;
}

// How points are written (src/app/start.js setPtsInk): in the pen's colour, one colour, or by credit. Kept on this computer (gs.ptsInk).
export function MarkingSettings() {
  const [ink, setInk] = useState(() => { const k = prefs.get('gs.ptsInk', ''); return k === 'credit' || COLORS[k] ? k : ''; });
  const choose = k => { if (k) prefs.set('gs.ptsInk', k); else prefs.del('gs.ptsInk'); setInk(k); };
  const Chip = ({ on, onClick, children, ...rest }) => <button type="button" class="chip" aria-pressed={String(!!on)} onClick={onClick} {...rest}>{children}</button>;
  const sw = c => <i class="sg-sw" style={{ background: c }} />;
  return <Card title={t('setup.sg_pts_h')}>
    <p class="mute">{t('setup.sg_pts_about')}</p>
    <div class="sg-chips" role="group" aria-label={t('setup.sg_pts_h')}>
      <Chip on={ink === ''} onClick={() => choose('')} data-sgpts="">{t('setup.sg_pts_pen')}</Chip>
      {Object.entries(COLORS).map(([k, c]) => <Chip on={ink === k} onClick={() => choose(k)} data-sgpts={k}>{sw(c)}{t(INKS[k])}</Chip>)}
      <Chip on={ink === 'credit'} onClick={() => choose('credit')} data-sgpts="credit">{t('setup.sg_pts_credit')} {sw(CHECK_INK)}{sw(PTS_AMBER)}{sw(COLORS.red)}</Chip>
    </div>
    {ink === 'credit' && <p class="hint">{t('setup.sg_pts_credit_say')}</p>}
  </Card>;
}

// The word on unit plan links, for example the name of the school's unit planner (src/app/library.js unitLinkName). Only words on screen.
export function ClassesSettings() {
  const L = useLibrary(), now = String((L.me || ME_OLD).unit || '').trim();
  const save = v => { v = String(v || '').trim().slice(0, 40); if (v === now) return; change(t('setup.sg_step_unit'), me => { me.unit = v; }, v ? t('setup.sg_unit_done', { name: v }) : t('setup.sg_unit_none')); };
  return <Card title={t('setup.sg_unit_h')}>
    <TextInput label={t('setup.sg_unit_label')} hint={t('setup.sg_unit_about')} value={now} maxLength={40} onBlur={e => save(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-raw data-sgunit />
  </Card>;
}
