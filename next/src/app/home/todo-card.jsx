// Home's To do card (src/todo.js tdCardRender, the #tdCardAdd box): her own lines for today and the ones left over, ticked here; a
// line typed here with no day in it is for today, where it was written; and how many more are on her list. Loaded as a part, so
// Home itself never reaches the grading side; its words are Home's (L, from screens/home.jsx); every change is the To do screen's own (students/todo.js todoChange), one undo step.
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon } from '../../ui/index.js';
import { href } from '../router.js';
import { onSaved } from '../../shared/saved.js';
import { readTodo, todoChange, ownRows, engine as TD } from '../../students/todo.js';

const SHOWN = 8;
export function TodoCard({ L }) {
  const [v, set] = useState(null), [text, setText] = useState('');
  useEffect(() => {
    let live = true;
    const read = () => readTodo([]).then(x => live && set(x), e => console.error(e));
    read();
    const off = onSaved(e => { if (e.side === 'students') read(); });
    const other = e => { if (!e.key || e.key === 'gs.lib') read(); };
    window.addEventListener('storage', other);
    return () => { live = false; off(); window.removeEventListener('storage', other); };
  }, []);
  if (!v || v.error) return null;
  const today = TD.tdToday(), own = ownRows();
  const now = own.filter(r => (!r.done && r.d && r.d <= today) || TD.tdDoneToday(r, today)).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || TD.tdSort(a, b));
  const shown = now.slice(0, SHOWN), rest = own.filter(r => !r.done).length - shown.filter(r => !r.done).length;
  const tick = r => todoChange(L.tick_step, E => E.todoTick(r.id), v.plan).then(x => set({ ...v, lib: x.lib }));
  const add = async e => {
    e.preventDefault(); const s = text.trim(); if (!s) return;
    const r = await todoChange(L.add_step, E => E.todoAdd(s, null, { d: today }), v.plan);
    if (r.out) setText('');
    set({ ...v, lib: r.lib });
  };
  return <section aria-labelledby="h-todo" data-home="todo"><div class="hrow"><h2 id="h-todo">{L.title}</h2><a class="link" href={href('todo')}>{L.all}</a></div>
    <div class="card hlist htodo">
      {shown.length ? <ul>{shown.map(r => <li class={'hl' + (r.done ? ' done' : '')} data-td={r.id}>
        <button type="button" class="tick" role="checkbox" aria-checked={r.done ? 'true' : 'false'} aria-label={r.x} onClick={() => tick(r)} data-tdtick={r.id}>{r.done ? <Icon name="check" size="xs" /> : null}</button>
        <span class="tx"><b data-raw>{r.x}</b></span></li>)}</ul> : <p class="mute none">{L.none}</p>}
      <form class="tdadd" onSubmit={add}><Icon name="plus" size="sm" /><input value={text} onInput={e => setText(e.currentTarget.value)} placeholder={L.add} aria-label={L.add} data-tdcard-in /></form>
      {rest > 0 && <div class="tdfoot"><span>{L.more(rest)}</span><a class="link" href={href('todo')} data-tdcard-all>{L.see}</a></div>}
    </div></section>;
}
