// Settings > Focus and goals (src/focus.js fcSetRender, src/tracker.js tkSetRender, src/gradeplan.js gpSetRender): the timer's
// lengths, chime, the tab's name, a goal for each session, the music; the grading goal; the time tracker; the grading plan. Kept in
// lib.me.focus with only what differs from the usual (fcConfSet), so it goes wherever the classes go and My setup carries it.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Card, Select, Segmented, Checkbox } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { engine as E, focusConf } from '../../students/focus.js';
import { useFocusData } from './aside.jsx';
import './lines.js';

const MOODS = [['mix', 'focus.mood_mix'], ['rain', 'focus.mood_rain'], ['library', 'focus.mood_library'], ['coffee', 'focus.mood_coffee'], ['night', 'focus.mood_night'], ['tape', 'focus.mood_tape'], ['garden', 'focus.mood_garden'], ['blue', 'focus.mood_blue'], ['quiet', 'focus.mood_quiet']];
const DOWS = [1, 2, 3, 4, 5, 6, 0];
const dayName = d => date(new Date(2026, 10, 15 + d, 12), { weekday: 'long' });   // 15 Nov 2026 is a Sunday

export function FocusSettings() {
  const v = useFocusData(), [, bump] = useState(0);
  if (!v) return <div class="loading" aria-busy="true" />;
  const c = E.fcConf(), set = part => focusConf(t('focus.u_settings'), part).then(() => bump(n => n + 1));
  const mins = list => list.map(n => ({ value: String(n), label: t('focus.minutes', { n }) }));
  const g = c.goal, k = g ? g.k : '';
  const kind = v2 => set({ goal: v2 ? { k: v2, n: g && g.k === v2 ? g.n : v2 === 'min' ? 60 : 10, per: g ? g.per : 'day', days: g ? g.days : null } : null });
  const per = p => { const week = p === 'week'; set({ goal: { ...g, per: p, n: week ? g.n * (g.days ? g.days.length : 5) : Math.max(1, Math.round(g.n / 5)), days: null } }); };
  const day = (d, on) => { const now = g.days || DOWS, next = on ? [...now, d] : now.filter(x => x !== d); if (!next.length) return; set({ goal: { ...g, days: next.length === 7 ? null : DOWS.filter(x => next.includes(x)) } }); };
  return <div data-fc-settings>
    <Card title={t('focus.s_timer')}><p class="mute">{t('focus.s_timer_say')}</p>
      <div class="setrow">
        <Select label={t('focus.s_len')} value={String(c.len)} options={mins(E.FC_LENS)} onChange={x => set({ len: +x })} data-fc-len />
        <Select label={t('focus.s_brk')} value={String(c.brk)} options={mins(E.FC_BRKS)} onChange={x => set({ brk: +x })} data-fc-brk />
        <Select label={t('focus.s_llen')} value={String(c.llen)} options={mins(E.FC_LENS)} onChange={x => set({ llen: +x })} data-fc-llen />
      </div>
      <Checkbox label={t('focus.s_sound')} checked={c.sound} onChange={x => set({ sound: x })} />
      <Checkbox label={t('focus.s_title')} checked={c.title} onChange={x => set({ title: x })} />
      <Checkbox label={t('focus.s_sg')} checked={c.sg} onChange={x => set({ sg: x })} />
      <Checkbox label={t('focus.s_music')} checked={c.music} onChange={x => set({ music: x })} />
      {c.music && <><div class="setrow"><Select label={t('focus.mood')} value={c.mood} options={MOODS.map(([v2, l]) => ({ value: v2, label: t(l) }))} onChange={x => set({ mood: x })} />
        <label class="field"><span class="lab">{t('focus.volume')}</span><input type="range" min="0.05" max="1" step="0.05" value={c.mvol} onChange={e => set({ mvol: +e.currentTarget.value })} /></label></div>
        <Checkbox label={t('focus.s_amb')} checked={c.mamb} onChange={x => set({ mamb: x })} /></>}
      <p class="hint">{t('focus.s_music_say')}</p>
    </Card>
    <Card title={t('focus.s_goal')}><p class="mute">{t('focus.s_goal_say')}</p>
      <Segmented label={t('focus.s_goal')} value={k} onChange={kind} options={[{ value: '', label: t('focus.g_none') }, { value: 'papers', label: t('focus.g_papers') }, { value: 'min', label: t('focus.g_min') }]} />
      {g && <div class="setrow">
        <label class="field"><span class="lab">{t('focus.g_n')}</span><input class="input" type="number" min="1" max={E.fcGoalMax(k, g.per)} step="1" value={g.n} data-fc-goaln onChange={e => { const n = Math.round(+e.currentTarget.value); if (n > 0) set({ goal: { ...g, n } }); }} /></label>
        <Select label={t('focus.g_per')} value={g.per} options={[{ value: 'day', label: t('focus.g_day') }, { value: 'week', label: t('focus.g_week') }]} onChange={per} />
      </div>}
      {g && g.per === 'day' && <fieldset class="setdays"><legend>{t('focus.g_days')}</legend>{DOWS.map(d => <Checkbox label={<span data-raw>{dayName(d)}</span>} checked={!g.days || g.days.includes(d)} onChange={x => day(d, x)} />)}</fieldset>}
      <p class="hint">{t('focus.g_count_say')}</p>
    </Card>
    <Card title={t('focus.s_track')}>
      <Checkbox label={t('focus.s_track_on')} checked={c.track} onChange={x => set({ track: x })} />
      <div class="setrow">
        <Select label={t('focus.s_idle')} value={String(c.idle)} options={mins(E.TK_IDLES)} onChange={x => set({ idle: +x })} />
        <Select label={t('focus.s_pe')} value={String(c.pe)} options={E.TK_PES.map(n => ({ value: String(n), label: n ? t('focus.minutes', { n }) : t('focus.s_pe_never') }))} onChange={x => set({ pe: +x })} />
      </div>
    </Card>
    <Card title={t('focus.s_plan')}>
      <Checkbox label={t('focus.s_free')} checked={c.free} onChange={x => set({ free: x })} />
      <Select label={t('focus.s_wk')} value={c.wk === false ? 'no' : String(c.wk)} options={[...DOWS.map(d => ({ value: String(d), label: dayName(d) })), { value: 'no', label: t('focus.s_wk_never') }]} onChange={x => set({ wk: x === 'no' ? false : +x })} data-raw />
      <Checkbox label={t('focus.s_quiet')} checked={c.quiet} onChange={x => set({ quiet: x })} />
      <Checkbox label={t('focus.s_short')} checked={c.short} onChange={x => set({ short: x })} />
    </Card>
  </div>;
}
