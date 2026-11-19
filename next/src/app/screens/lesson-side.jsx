// The lesson page's classes (router.js PARTS side2), loaded with the page: every class and day the lesson is on, a way to put it on
// another and to take it off one (src/planner/lessons.js ls-slots chips with ×, addSlotDlg). To keep the page's presses at rest
// under the brief's 25, adding and taking off sit in the lesson's ⋯ menu (slotItems); a lesson on no class shows + Class itself.
// Kept as the current Planner keeps them: slots [{ classId, date }] in date order, never the same one twice.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Icon, Select, TextInput, Sheet } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { toneOf } from '../colors.js';
import { classOf, at, today, periods } from '../plan/lessons.js';
import '../plan/les-lines.js';
import '../plan/lines.js';

const clock = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? date(new Date(2000, 0, 1, +m[1], +m[2]), { hour: 'numeric', minute: '2-digit' }) : ''; };
const copy = x => JSON.parse(JSON.stringify(x));
const day = s => date(at(s.date), { weekday: 'short', day: 'numeric', month: 'short' });
let opener = null;

// The lesson menu's items: put it on another class or day, take it off each one it is on, and the name kept with the title slide.
export function slotItems(p, l, save) {
  return [{ id: 'slot-add', label: t('les.add_slot'), icon: 'plus', onSelect: () => opener && opener(true) },
    ...(l.slots || []).map((s, i) => { const k = classOf(p, s.classId); return { id: 'unslot' + i, label: t('les.take_off', { name: (k ? k.name : '') + ', ' + day(s) }), icon: 'x',
      onSelect: () => { const n = copy(l); n.slots.splice(i, 1); save(n); } }; }),
    // The lesson's name and its title slide's title kept the same (src/planner/lessons.js titlesLinked, in its More menu).
    ...(l.slides.some(s => s.layout === 'title') ? [{ id: 'tlink', label: t('les.title_linked'), checked: !l.titleApart, onSelect: () => { const n = copy(l);
      if (n.titleApart) { delete n.titleApart; n.slides.find(s => s.layout === 'title').title = n.title; } else n.titleApart = true; save(n); } }] : []), { sep: true }];
}

export function Classes({ p, l }) {
  const slots = l.slots || [];
  return <section class="lclasses"><h2 class="sub">{slots.length ? t('les.classes') : t('plan.not_on_calendar')}</h2>
    {slots.length > 0 ? <ul class="slotlist">{slots.map(s => { const k = classOf(p, s.classId), m = k && (k.meets || []).find(x => +x.dow === at(s.date).getDay());
      return <li class="slotchip" data-slot={s.classId + '|' + s.date}><span class="dot" style={{ '--cc': k ? toneOf(k.color) : 'var(--g500)' }} />
        <span><b data-raw>{k ? k.name : s.classId}</b> <span class="mute" data-raw>{day(s)}{m ? ', ' + (m.label ? m.label + ', ' : '') + clock(m.start) : ''}</span></span></li>; })}</ul>
      : ((p.setup && p.setup.classes) || []).length > 0 && <Button size="sm" icon="plus" onClick={() => opener && opener(true)} data-focus="add-slot">{t('les.add_class')}</Button>}
  </section>;
}

export function SlotSheet({ p, l, save }) {
  const cls = (p.setup && p.setup.classes) || [], slots = l.slots || [];
  const [on, setOn] = useState(false), [c, setC] = useState(''), [d, setD] = useState('');
  opener = v => { setC(cls[0] ? cls[0].id : ''); setD(slots[0] ? slots[0].date : today()); setOn(v); };
  if (!on) return null;
  const add = () => {
    if (!c || !/^\d{4}-\d\d-\d\d$/.test(d)) return;
    const n = copy(l); n.slots = n.slots || [];
    if (!n.slots.some(s => s.classId === c && s.date === d)) n.slots.push({ classId: c, date: d });
    n.slots.sort((a, b) => a.date.localeCompare(b.date)); save(n); setOn(false);
  };
  const meets = c && /^\d{4}-\d\d-\d\d$/.test(d) && periods(p, d).some(m => m.c.id === c);
  return <Sheet open title={t('les.add_slot')} icon={<Icon name="cal" />} onClose={() => setOn(false)}
    footer={<><span class="grow" /><Button onClick={() => setOn(false)}>{t('common.cancel')}</Button><Button variant="primary" onClick={add} data-focus="slot-add">{t('les.add')}</Button></>}>
    <div class="addslot"><Select label={t('plan.class')} value={c} options={cls.map(x => ({ value: x.id, label: x.name }))} onChange={setC} data-focus="slot-class" data-raw />
      <TextInput label={t('plan.date')} type="date" value={d} onInput={setD} data-focus="slot-date" />
      {c && d && !meets && <p class="mute" role="status" data-focus="slot-warn">{t('les.not_meet')}</p>}</div>
  </Sheet>;
}
