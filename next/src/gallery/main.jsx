// The parts gallery (next/gallery.html): every shared part in every state, in each of the six themes and at phone width. Linked
// from nowhere; the planning thread reviews it and the checks picture it. It saves nothing: the theme switch here only shows a
// theme, and the window never asks for the lock. Every name and paper in it is made up.
// ?look=<theme> a theme; ?still=1 no motion (for pictures); ?keys=1 every line as its key (the words check); ?nospeech=1 as if
// the browser could not listen; ?frame=1 drawn inside the phone frame.
import { h, Fragment, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import * as P from '../ui/index.js';
import { THEMES, SCALE } from '../ui/tokens.js';
import { t, setMode, addLines } from '../i18n/t.js';
import GALLERY_LINES from '../../lang/gallery.en.json';
import { applyLook, savedLook, onLook } from '../services/theme.js';
import { assistant } from '../services/assistant.js';
import { addCommand, openCommandBar } from '../services/commands.js';
import * as shortcuts from '../services/shortcuts.js';
import * as undo from '../services/undo.js';
import { refValue, driveValue, linkValue, fileValue } from '../services/files.js';

addLines(GALLERY_LINES);
const Q = new URLSearchParams(location.search);
if (Q.get('keys')) setMode('keys');
if (Q.get('nospeech')) { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch {} window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; }
if (Q.get('still')) document.documentElement.classList.add('still');
applyLook(P.LOOKS.includes(Q.get('look')) ? Q.get('look') : savedLook());
const FRAME = !!Q.get('frame');

// Made-up people and classes. Names are what a teacher types, so they are shown as typed (data-raw), never translated.
const PEOPLE = ['Mira Okafor', 'Theo Lindqvist', 'Ana Ruiz', 'Kenji Watanabe', 'Lena Park'];
const ME = 'Ms. Rowan';
const NAV = { home: 'gallery.nav_home', todo: 'gallery.nav_todo', cal: 'gallery.nav_cal', library: 'gallery.nav_library', settings: 'gallery.nav_settings' };
const BTN = { primary: 'gallery.btn_primary', plain: 'gallery.btn_plain', quiet: 'gallery.btn_quiet' };
const N = ({ children }) => <span data-raw>{children}</span>;
const W = () => window.__gallery || (window.__gallery = { ran: [] });

function Sec({ id, title, children }) {
  return <section class="gsec" id={id} data-shot={id}><h2>{title}</h2><div class="gbody">{children}</div></section>;
}
const Row = ({ label, children }) => <div class="grow"><span class="glab">{label}</span><div class="gitems">{children}</div></div>;

function Tokens({ look }) {
  const th = THEMES[look];
  const names = ['bg', 's', 'g100', 'g200', 'edge', 'faint', 'mute', 'ink2', 'ink', 'acc', 'accSoft', 'accInk', 'ok', 'warn', 'pen', 'inv'];
  return <>
    <Row label={t('gallery.colours')}><div class="sws">{names.map(n => <span class="swc"><i style={{ background: th[n] }} /><code>{n}</code></span>)}</div></Row>
    <Row label={t('gallery.class_colours')}>{th.cls.map((c, i) => <P.ClassDot color={c} size="lg" label={t('gallery.class_colour_n', { n: i + 1 })} />)}</Row>
    <Row label={t('gallery.type')}><div class="gtype">{[6, 5, 4, 3, 2, 1].map(n => <span style={{ fontSize: 'var(--t' + n + ')', fontWeight: n > 4 ? 600 : 400 }}>{t('gallery.type_sample', { n: SCALE['t' + n] })}</span>)}</div></Row>
    <Row label={t('gallery.surfaces')}>{['sh-r', 'sh-r2', 'sh-f'].map(s => <span class="gshadow" style={{ boxShadow: 'var(--' + s + ')' }}><code>{s}</code></span>)}</Row>
  </>;
}

function Gallery() {
  const [look, setLook] = useState(document.documentElement.dataset.look);
  const [width, setWidth] = useState('wide');
  const [seg, setSeg] = useState('week'), [tab, setTab] = useState('lessons');
  const [txt, setTxt] = useState(''), [long, setLong] = useState(''), [sel, setSel] = useState('b');
  const [cb, setCb] = useState(true), [sw, setSw] = useState(true), [sl, setSl] = useState(60);
  const [chips, setChips] = useState({ 0: true, 1: false, 2: true });
  const [sheet, setSheet] = useState(false), [dlg, setDlg] = useState(false);
  const [sort, setSort] = useState({ by: 'name', dir: 'asc' });
  const [count, setCount] = useState(3), [u, setU] = useState(undo.state());
  const [one, setOne] = useState(null), [many, setMany] = useState([]);
  const [withRef, setWithRef] = useState(refValue({ store: 'examples', id: 'ex-1', label: '' }));
  const [cmts, setCmts] = useState([
    { id: 'a', who: ME, at: Date.UTC(2026, 10, 16, 1, 5), text: t('gallery.sample_comment_1'), files: [] },
    { id: 'b', who: PEOPLE[1], at: Date.UTC(2026, 10, 16, 2, 40), text: t('gallery.sample_comment_2'), files: [refValue({ store: 'examples', id: 'ex-2', label: '' })] },
  ]);
  const [nav, setNav] = useState('home');
  useEffect(() => onLook(setLook), []);
  useEffect(() => undo.onUndoChange(setU), []);
  useEffect(() => {
    shortcuts.start();
    const offs = [
      shortcuts.register({ id: 'undo', keys: 'mod+z', label: 'keys.undo', run: () => { const e = undo.undo(); if (e) P.toast(t('undo.undone', { what: e.label })); } }),
      shortcuts.register({ id: 'redo', keys: ['mod+shift+z', 'mod+y'], label: 'keys.redo', run: () => undo.redo() }),
      shortcuts.register({ id: 'help-keys', keys: '?', label: 'keys.show_list', run: () => document.getElementById('keys').scrollIntoView() }),
      shortcuts.register({ id: 'next-student', keys: 'j', group: 'keys.group_marking', label: 'keys.next_student', run: () => W().ran.push('j') }),
      shortcuts.register({ id: 'prev-student', keys: 'k', group: 'keys.group_marking', label: 'keys.prev_student', run: () => W().ran.push('k') }),
      ...['home', 'todo', 'cal', 'library', 'settings'].map(n => addCommand({ id: 'go-' + n, label: t(NAV[n]), group: t('cmd.group_go'), icon: n, run: () => { setNav(n); W().ran.push('go-' + n); } })),
      addCommand({ id: 'theme', label: t('cmd.change_theme'), group: t('cmd.group_do'), icon: 'sun', run: () => document.getElementById('look').scrollIntoView() }),
      addCommand({ id: 'new-lesson', label: t('gallery.cmd_new_lesson'), group: t('cmd.group_do'), icon: 'plus', keys: 'mod+shift+l', run: () => W().ran.push('new-lesson') }),
    ];
    return () => offs.forEach(f => f());
  }, []);
  const ai = assistant();
  // As a later stage will: count changes go through snapshot; here the value lives in this page only.
  const changeCount = d => { const before = count, after = count + d; setCount(after); undo.record({ label: t('gallery.count_changed'), undo: () => setCount(before), redo: () => setCount(after) }); };
  const drivePick = async () => driveValue({ id: 'drive-1', name: t('gallery.sample_drive_file'), mimeType: 'application/pdf' });
  // A drawing standing in for a student-side picture, made here on this device; a real screen asks the student side.
  const resolve = r => r.id === 'ex-1' ? 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#eef0fb"/><path d="M10 20h52M10 32h44M10 44h48M10 56h30" stroke="#3f4cc0" stroke-width="3" stroke-linecap="round"/></svg>') : null;
  const rows = PEOPLE.map((n, i) => ({ id: n, name: n, score: [92, 78, 85, 64, 99][i], late: [0, 2, 0, 1, 0][i] }));
  const sorted = rows.slice().sort((a, b) => (a[sort.by] > b[sort.by] ? 1 : -1) * (sort.dir === 'asc' ? 1 : -1));
  const fakeImage = () => { const c = document.createElement('canvas'); c.width = c.height = 8; return new Promise(r => c.toBlob(b => r(new File([b], 'slide-3.png', { type: 'image/png' })))); };

  if (width === 'phone' && !FRAME) return <div class="gphone-wrap"><Top look={look} width={width} setWidth={setWidth} /><iframe class="gphone" title={t('gallery.phone_frame')} src={'gallery.html?frame=1&look=' + look + (Q.get('keys') ? '&keys=1' : '') + (Q.get('still') ? '&still=1' : '')} /></div>;
  return <div class="gal">
    {!FRAME && <Top look={look} width={width} setWidth={setWidth} />}
    <main class="gmain">
      <Sec id="tokens" title={t('gallery.sec_tokens')}><Tokens look={look} /></Sec>
      <Sec id="icons" title={t('gallery.sec_icons')}><div class="gicons">{P.iconNames().map(n => <span class="gic" title={n}><P.Icon name={n} size="lg" /><code>{n}</code></span>)}</div></Sec>
      <Sec id="buttons" title={t('gallery.sec_buttons')}>
        {['primary', 'plain', 'quiet'].map(v => <Row label={t(BTN[v])}>
          <P.Button variant={v}>{t('gallery.save_lesson')}</P.Button>
          <P.Button variant={v} state="hover">{t('gallery.state_hover')}</P.Button>
          <P.Button variant={v} state="press">{t('gallery.state_press')}</P.Button>
          <P.Button variant={v} state="focus">{t('gallery.state_focus')}</P.Button>
          <P.Button variant={v} disabled>{t('gallery.state_disabled')}</P.Button>
          <P.Button variant={v} icon="plus" size="sm">{t('gallery.small')}</P.Button>
          <P.Button variant={v} icon="play" size="lg">{t('gallery.large')}</P.Button>
        </Row>)}
        <Row label={t('gallery.with_keys')}><P.Button variant="primary" icon="check" kbd="↵">{t('gallery.next_paper')}</P.Button><P.Button icon="search" kbd={shortcuts.pieces('mod+k')} onClick={openCommandBar}>{t('cmd.title')}</P.Button></Row>
        <Row label={t('gallery.icon_buttons')}><P.IconButton icon="undo" label={t('common.undo')} kbd={shortcuts.pieces('mod+z').join(' ')} onClick={() => undo.undo()} disabled={!u.canUndo} /><P.IconButton icon="settings" label={t('gallery.nav_settings')} variant="plain" /><P.IconButton icon="dots" label={t('gallery.more')} size="sm" /><P.IconButton icon="play" label={t('gallery.present')} variant="primary" size="lg" /><P.IconButton icon="trash" label={t('common.remove')} disabled /></Row>
      </Sec>
      <Sec id="choices" title={t('gallery.sec_choices')}>
        <Row label={t('gallery.segmented')}><P.Segmented label={t('gallery.view')} value={seg} onChange={setSeg} options={[{ value: 'class', label: t('gallery.by_class') }, { value: 'week', label: t('gallery.by_time') }, { value: 'month', label: t('gallery.month') }]} /><P.Segmented size="sm" label={t('gallery.score_as')} value="pct" options={[{ value: 'pct', label: '%' }, { value: 'pts', label: t('gallery.points') }]} /><P.Segmented label={t('gallery.view')} value="a" disabled options={[{ value: 'a', label: t('gallery.state_disabled') }, { value: 'b', label: t('gallery.month') }]} /></Row>
        <Row label={t('gallery.tabs')}><div style={{ flex: 1 }}><P.Tabs label={t('gallery.class_page')} value={tab} onChange={setTab} tabs={[{ id: 'lessons', label: t('gallery.tab_line'), icon: 'line' }, { id: 'people', label: t('gallery.tab_people'), count: 24 }, { id: 'grades', label: t('gallery.tab_grades') }, { id: 'goals', label: t('gallery.tab_goals'), disabled: true }]} /></div></Row>
        <Row label={t('gallery.chips')}>{[0, 1, 2].map(i => <P.Chip on={chips[i]} color={THEMES[look].cls[i]} onClick={() => setChips(c => ({ ...c, [i]: !c[i] }))}><N>{['9A', '10B', '11C'][i]}</N></P.Chip>)}<P.Chip on icon="spark">{t('gallery.worked_out')}</P.Chip><P.Chip disabled>{t('gallery.state_disabled')}</P.Chip></Row>
        <Row label={t('gallery.checks')}><P.Checkbox label={t('gallery.check_returned')} checked={cb} onChange={setCb} /><P.Checkbox label={t('gallery.check_off')} checked={false} /><P.Checkbox round label={t('gallery.check_todo')} checked /><P.Checkbox label={t('gallery.state_disabled')} checked disabled /></Row>
        <Row label={t('gallery.switches')}><P.Switch label={t('gallery.switch_att')} checked={sw} onChange={setSw} /><P.Switch label={t('gallery.switch_off')} checked={false} /><P.Switch label={t('gallery.state_disabled')} checked disabled /></Row>
        <Row label={t('gallery.slider')}><div style={{ width: 280 }}><P.Slider label={t('gallery.slider_label')} value={sl} onInput={setSl} format={v => t('gallery.minutes', { n: v })} min={5} max={90} step={5} /></div><div style={{ width: 200 }}><P.Slider label={t('gallery.state_disabled')} value={30} disabled /></div></Row>
      </Sec>
      <Sec id="fields" title={t('gallery.sec_fields')}>
        <div class="ggrid">
          <P.TextInput label={t('gallery.lesson_title')} placeholder={t('gallery.lesson_title_ph')} value={txt} onInput={setTxt} hint={t('gallery.lesson_title_hint')} />
          <P.TextInput label={t('gallery.find')} icon="search" placeholder={t('gallery.find_ph')} />
          <P.TextInput label={t('gallery.state_focus')} value={t('gallery.sample_title')} state="focus" />
          <P.TextInput label={t('gallery.out_of')} value="0" error={t('gallery.out_of_err')} />
          <P.TextInput label={t('gallery.state_disabled')} value={t('gallery.sample_title')} disabled />
          <P.Select label={t('gallery.unit')} value={sel} onChange={setSel} options={[{ value: 'a', label: t('gallery.unit_a') }, { value: 'b', label: t('gallery.unit_b') }, { value: 'c', label: t('gallery.unit_c') }]} />
        </div>
        <div class="ggrid2"><P.TextBox label={t('gallery.notes')} hint={t('gallery.notes_hint')} value={long} onInput={setLong} placeholder={t('gallery.notes_ph')} /><P.TextBox label={t('gallery.state_disabled')} value={t('gallery.sample_note')} disabled /></div>
      </Sec>
      <Sec id="surfaces" title={t('gallery.sec_surfaces')}>
        <div class="ggrid2">
          <P.Card title={t('gallery.card_title')}><p class="mute" style={{ margin: 0 }}>{t('gallery.card_text')}</p></P.Card>
          <P.Card title={t('gallery.card_raised')} raised><P.Progress value={14} max={24} text={t('gallery.papers_marked', { n: 14, total: 24 })} label={t('gallery.marking_progress')} /></P.Card>
        </div>
        <Row label={t('gallery.list')}><div style={{ flex: 1, maxWidth: 520 }}><P.List label={t('gallery.list')}>
          <P.ListRow lead={<P.Avatar name={PEOPLE[0]} />} title={<N>{PEOPLE[0]}</N>} sub={t('gallery.row_sub_marked')} end={<><span class="num">92%</span><P.Icon name="chr" /></>} onClick={() => {}} current />
          <P.ListRow lead={<P.Avatar name={PEOPLE[1]} />} title={<N>{PEOPLE[1]}</N>} sub={t('gallery.row_sub_late', { n: 2 })} end={<span class="num">78%</span>} onClick={() => {}} />
          <P.ListRow icon="file" title={t('gallery.row_file')} sub={t('gallery.row_file_sub')} end={<P.IconButton icon="dots" size="sm" label={t('gallery.more')} />} />
        </P.List></div></Row>
        <Row label={t('gallery.table')}><div style={{ flex: 1, minWidth: 0 }}><P.Table caption={t('gallery.table')} sortBy={sort.by} sortDir={sort.dir} onSort={k => setSort(s => ({ by: k, dir: s.by === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
          columns={[{ key: 'name', label: t('gallery.col_student'), render: r => <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}><P.Avatar name={r.name} /><N>{r.name}</N></span> }, { key: 'score', label: t('gallery.col_score'), num: true, render: r => r.score + '%' }, { key: 'late', label: t('gallery.col_late'), num: true }]} rows={sorted} /></div></Row>
        <Row label={t('gallery.side_nav')}><nav class="gside" aria-label={t('gallery.side_nav')}>
          {['home', 'todo', 'cal', 'library'].map(n => <P.NavItem icon={n} label={t(NAV[n])} current={nav === n} count={n === 'todo' ? 7 : undefined} onClick={() => setNav(n)} />)}
          <P.NavSection>{t('gallery.nav_classes')}</P.NavSection>
          {[0, 1, 2].map(i => <P.NavItem color={THEMES[look].cls[i]} label={<N>{['9A English', '10B English', '11C Literature'][i]}</N>} current={nav === 'c' + i} onClick={() => setNav('c' + i)} />)}
        </nav></Row>
        <Row label={t('gallery.dots')}>{PEOPLE.slice(0, 4).map(n => <P.Avatar name={n} />)}<P.Avatar name={PEOPLE[4]} size="lg" />{THEMES[look].cls.slice(0, 5).map(c => <P.ClassDot color={c} />)}</Row>
      </Sec>
      <Sec id="feedback" title={t('gallery.sec_feedback')}>
        <div class="ggrid2"><P.Card pad={false}><P.EmptyState icon="inbox" title={t('gallery.empty_title')} text={t('gallery.empty_text')} action={<P.Button variant="primary" icon="plus">{t('gallery.empty_action')}</P.Button>} /></P.Card>
          <div class="gstack">
            <P.Progress value={0} max={30} text={t('gallery.progress_none')} label={t('gallery.progress_none')} />
            <P.Progress value={12} max={30} text={t('gallery.papers_marked', { n: 12, total: 30 })} label={t('gallery.marking_progress')} />
            <P.Progress value={30} max={30} text={t('gallery.progress_done')} label={t('gallery.progress_done')} />
            <P.Progress value={null} text={t('gallery.progress_reading')} label={t('gallery.progress_reading')} />
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }} class="mute"><P.Spinner label={t('gallery.progress_reading')} />{t('gallery.progress_reading')}</span>
          </div></div>
      </Sec>
      <Sec id="floating" title={t('gallery.sec_floating')}>
        <Row label={t('gallery.menu')}>
          <P.Menu label={t('gallery.lesson_menu')} items={[{ heading: t('gallery.lesson_menu') }, { id: 'dup', label: t('gallery.menu_duplicate'), icon: 'copy', kbd: shortcuts.pieces('mod+d').join(' ') }, { id: 'move', label: t('gallery.menu_move'), sub: t('gallery.menu_move_sub'), icon: 'cal' }, { id: 'ai', label: ai.name ? t('assistant.open_named', { name: ai.name }) : t('assistant.open_generic'), icon: 'assist' }, { sep: true }, { id: 'off', label: t('gallery.menu_print'), icon: 'download', disabled: true }, { id: 'del', label: t('common.delete'), icon: 'trash', onSelect: () => P.toast(t('gallery.lesson_deleted'), { undo: () => P.toast(t('gallery.lesson_back')) }) }]}
            trigger={p => <P.Button icon="dots" iconEnd="chd" data-test="menu" {...p}>{t('gallery.menu_open')}</P.Button>} />
          <P.Menu label={t('gallery.view')} items={['class', 'week', 'month'].map(v => ({ id: v, label: t(v === 'class' ? 'gallery.by_class' : v === 'week' ? 'gallery.by_time' : 'gallery.month'), checked: seg === v, onSelect: () => setSeg(v) }))}
            trigger={p => <P.Button variant="quiet" iconEnd="chd" {...p}>{t('gallery.view')}</P.Button>} />
        </Row>
        <Row label={t('gallery.tooltip')}><P.Tooltip text={t('gallery.tip_text')} kbd={shortcuts.pieces('j')[0]}><P.Button>{t('gallery.tip_hover')}</P.Button></P.Tooltip><span class="tip gtipstatic" role="presentation">{t('gallery.tip_text')}<kbd>{shortcuts.pieces('j')[0]}</kbd></span></Row>
        <Row label={t('gallery.sheet_dialog')}>
          <P.Button data-test="sheet" icon="assist" onClick={() => setSheet(true)}>{t('gallery.open_sheet')}</P.Button>
          <P.Button data-test="dialog" onClick={() => setDlg(true)}>{t('gallery.open_dialog')}</P.Button>
          <P.Button data-test="cmd" icon="search" onClick={openCommandBar}>{t('cmd.title')}</P.Button>
        </Row>
        <Row label={t('gallery.toasts')}><P.Button data-test="toast" onClick={() => P.toast(t('gallery.toast_saved'))}>{t('gallery.toast_plain')}</P.Button><P.Button data-test="toast-undo" onClick={() => P.toast(t('gallery.toast_moved'), { undo: () => P.toast(t('gallery.toast_back')) })}>{t('gallery.toast_with_undo')}</P.Button></Row>
      </Sec>
      <Sec id="undo" title={t('gallery.sec_undo')}>
        <Row label={t('gallery.undo_demo')}><P.Button icon="minus" onClick={() => changeCount(-1)} aria-label={t('gallery.less')} /><span class="num gcount" data-test="count">{count}</span><P.Button icon="plus" onClick={() => changeCount(1)} aria-label={t('gallery.more_one')} />
          <P.Button variant="quiet" icon="undo" disabled={!u.canUndo} onClick={() => undo.undo()} data-test="undo">{u.canUndo ? t('undo.undo_what', { what: u.next }) : t('common.undo')}</P.Button>
          <P.Button variant="quiet" disabled={!u.canRedo} onClick={() => undo.redo()}>{t('common.redo')}</P.Button></Row>
      </Sec>
      <Sec id="files" title={t('gallery.sec_files')}>
        <div class="ggrid2">
          <P.AddFile label={t('gallery.file_one')} value={one} onChange={setOne} drivePick={drivePick} accept="image/*,.pdf,.docx,.pptx" />
          <P.AddFile label={t('gallery.file_no_drive')} value={null} onChange={() => {}} />
          <P.AddFile label={t('gallery.file_many')} multiple value={many} onChange={setMany} drivePick={drivePick} compact />
          <div class="gstack"><span class="lbl">{t('gallery.file_kinds')}</span>
            <P.FileTile value={driveValue({ id: 'd', name: t('gallery.sample_drive_file'), mimeType: 'application/pdf' })} onReplace={() => {}} onRemove={() => {}} />
            <P.FileTile value={linkValue('https://example.org/reading', t('gallery.sample_link'))} onRemove={() => {}} />
            <P.FileTile value={withRef} resolve={resolve} onRemove={() => setWithRef(null)} />
            <P.FileTile value={refValue({ store: 'examples', id: 'ex-9', label: '' })} />
            <P.Button size="sm" style={{ alignSelf: 'flex-start' }} data-test="add-image" onClick={async () => setOne(fileValue(await fakeImage()))}>{t('gallery.file_add_sample')}</P.Button>
          </div>
        </div>
      </Sec>
      <Sec id="comments" title={t('gallery.sec_comments')}><div style={{ maxWidth: 560 }}><P.Comments label={t('gallery.slide_comments')} comments={cmts} onChange={setCmts} me={ME} resolve={resolve} drivePick={drivePick} placeholder={t('gallery.comment_ph')} /></div></Sec>
      <Sec id="look" title={t('gallery.sec_look')}><P.ThemePicker value={look} onPick={applyLook} /><p class="mute gnote">{t('gallery.look_note')}</p></Sec>
      <Sec id="keys" title={t('gallery.sec_keys')}><div style={{ maxWidth: 520 }}><P.ShortcutList /></div></Sec>
      <Sec id="assistant" title={t('gallery.sec_assistant')}><Row label={t('gallery.assistant_now')}>
        {ai.link ? <a class="btn" href={ai.link} target="_blank" rel="noopener"><P.Icon name="assist" />{t('assistant.open_named', { name: ai.name })}</a> : <P.Button icon="assist">{ai.name ? t('assistant.open_named', { name: ai.name }) : t('assistant.open_generic')}</P.Button>}
        <span class="mute">{ai.name ? t('gallery.assistant_from_setting') : t('gallery.assistant_none')}</span></Row></Sec>
    </main>
    <P.Sheet open={sheet} onClose={() => setSheet(false)} title={ai.name ? t('assistant.plan_with_named', { name: ai.name }) : t('assistant.plan_with_generic')} icon={<P.Icon name="assist" />}
      footer={<><P.Button variant="quiet" onClick={() => setSheet(false)}>{t('common.cancel')}</P.Button><P.Button variant="primary" onClick={() => setSheet(false)} data-test="sheet-ok">{t('gallery.sheet_done')}</P.Button></>}>
      <div class="gstack"><p class="mute" style={{ margin: 0 }}>{t('gallery.sheet_text')}</p><P.TextInput label={t('gallery.lesson_title')} value={txt} onInput={setTxt} /><P.TextBox label={t('gallery.notes')} value={long} onInput={setLong} /><div><P.CopyButton text={long} /></div><P.AddFile label={t('gallery.file_one')} value={one} onChange={setOne} drivePick={drivePick} compact /></div>
    </P.Sheet>
    <P.Dialog open={dlg} onClose={() => setDlg(false)} title={t('gallery.dialog_title')} actions={<><P.Button variant="quiet" onClick={() => setDlg(false)} data-test="dlg-cancel">{t('common.cancel')}</P.Button><P.Button variant="primary" onClick={() => { setDlg(false); P.toast(t('gallery.toast_moved'), { undo: () => {} }); }}>{t('gallery.dialog_ok')}</P.Button></>}>{t('gallery.dialog_text')}</P.Dialog>
    <P.CommandBar /><P.ToastHost />
  </div>;
}
function Top({ look, width, setWidth }) {
  return <header class="gtop"><span class="glogo"><P.Icon name="check" /></span><h1>{t('gallery.title')}</h1>
    <div class="gtopr"><P.Segmented size="sm" label={t('gallery.width')} value={width} onChange={setWidth} options={[{ value: 'wide', label: t('gallery.width_wide'), icon: 'week' }, { value: 'phone', label: t('gallery.width_phone'), icon: 'phone' }]} />
      <div class="gthemes" role="radiogroup" aria-label={t('look.title')}>{P.LOOKS.map(n => <button type="button" role="radio" aria-checked={String(n === look)} aria-label={t(P.LOOK_LINES[n][0])} title={t(P.LOOK_LINES[n][0])} class="gsw" style={{ '--sa': THEMES[n].acc, '--sb2': THEMES[n].bg }} onClick={() => applyLook(n)} />)}</div></div>
  </header>;
}
render(<Gallery />, document.getElementById('app'));
window.__gallery = Object.assign(W(), { ready: true, undo, shortcuts });
