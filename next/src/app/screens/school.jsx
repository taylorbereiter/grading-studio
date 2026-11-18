// School (src/school.js): links, files and notes about the school, in groups the teacher names, each for the whole school or for
// some classes (a class's links show on its lessons), with the people she works with as spots for roles. Kept in gs.school and the
// school files database, as the current app keeps them (planning/school.js), so both apps read one list. Every change is one step
// Undo takes back. A file dropped on this page, or a web address pasted, becomes a new item here.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, Menu, Sheet, Dialog, TextInput, TextBox, Checkbox, Chip, EmptyState, toast } from '../../ui/index.js';
import { t, num, addLines } from '../../i18n/t.js';
import { go } from '../router.js';
import { usePlan } from '../plan.js';
import { copyText } from '../../services/clipboard.js';
import { askAdd, askPerson } from '../todo-add.js';
import * as S from '../../planning/school.js';
import LINES from '../../../lang/school.en.json';
addLines(LINES);

const raw = s => <span data-raw>{s}</span>;
const fmtSize = b => (b >= 1048576 ? t('file.mb', { n: num(b / 1048576, { maximumFractionDigits: 1 }) }) : t('file.kb', { n: num(Math.max(1, Math.round(b / 1024))) }));
const SHOW = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/;
const IC = { link: 'link', file: 'file', note: 'note' };
const IDEAS = ['Handbook and policies', 'Calendar and schedules', 'Portals', 'Forms', 'People and rooms'];   // not-words: group names offered as a start, stored as typed

function useSchool() {
  const [s, set] = useState(S.schoolNow), [have, setHave] = useState(new Set());
  useEffect(() => {
    const read = () => { set(S.schoolNow()); S.filesHere().then(setHave); };
    read();
    const other = e => { if (!e.key || e.key === 'gs.school') read(); };
    window.addEventListener('storage', other);
    const iv = setInterval(read, 30000);
    return () => { window.removeEventListener('storage', other); clearInterval(iv); };
  }, []);
  return [s, () => { set(S.schoolNow()); S.filesHere().then(setHave); }, have];
}
function saveBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function openFile(it, save) {
  const b = await S.fileBytes(it.file.hash);
  if (!b) return toast(t('school.not_on_computer', { name: it.name }), { ms: 7000 });
  const type = it.file.type || '', blob = new Blob([b], { type: type || 'application/octet-stream' });
  if (save || !SHOW.test(type)) return saveBlob(it.file.name || it.name, blob);
  const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 120000);
}

export default function School() {
  const [s, reread, have] = useSchool(), plan = usePlan();
  const [q, setQ] = useState(''), [forK, setFor] = useState(''), [form, setForm] = useState(null), [pform, setPform] = useState(null), [spots, setSpots] = useState(false), [rename, setRename] = useState(null);
  const fileIn = useRef(), again = useRef(''), page = useRef();
  const change = (label, fn) => { try { S.schoolChange(label, fn); } catch (e) { console.error(e); toast(t('school.full')); } reread(); };
  const choices = S.classChoices(plan), all = S.live(s), used = S.classesUsed(all, choices);
  const f = forK && used.some(n => S.norm(n) === forK) ? forK : '';
  const forNames = () => (f ? used.filter(n => S.norm(n) === f) : []);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = i => { const x = [i.name, i.group, i.note, i.url, i.file && i.file.name, ...S.clsOf(i)].filter(Boolean).join(' ').toLowerCase(); return words.every(w => x.includes(w)); };
  const mine = f ? all.filter(i => S.clsOf(i).some(n => S.norm(n) === f)) : all;
  const items = words.length ? mine.filter(hit) : mine, groups = S.groupsOf(s, items), named = groups.filter(Boolean);

  const pick = list => {
    list = [...list].filter(x => x && x.name); if (!list.length) return;
    if (again.current) { const id = again.current; again.current = ''; return take(list.slice(0, 1)).then(got => { if (!got.length) return; change(t('school.u_edit'), s => { const x = s.items.find(i => i.id === id && !i.gone); if (x) { x.file = got[0].file; x.at = Date.now(); } }); toast(t('school.replaced')); }); }
    setForm({ files: list, cls: forNames() });
  };
  // drop and paste on this page: files are school files, a web address a new link
  useEffect(() => {
    const on = () => !document.querySelector('dialog[open]');
    const has = e => !!e.dataTransfer && [...(e.dataTransfer.types || [])].some(x => x === 'Files' || x === 'text/uri-list');
    const over = e => { if (!on() || !has(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; page.current && page.current.classList.add('over'); };
    const leave = e => { if (!e.relatedTarget && page.current) page.current.classList.remove('over'); };
    const drop = e => {
      page.current && page.current.classList.remove('over'); if (!on() || !has(e)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.dataTransfer.files.length) { again.current = ''; return pick(e.dataTransfer.files); }
      const u = S.webAddress((e.dataTransfer.getData('text/uri-list') || '').split(/\r?\n/).find(l => l && !l.startsWith('#')));
      if (u) setForm({ kind: 'link', url: u, cls: forNames() });
    };
    const paste = e => {
      if (!on() || (e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
      const fs = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (fs.length) { e.preventDefault(); again.current = ''; return pick(fs); }
      const u = S.webAddress((e.clipboardData && e.clipboardData.getData('text/plain')) || '');
      if (u) { e.preventDefault(); setForm({ kind: 'link', url: u, cls: forNames() }); }
    };
    for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, over, true);
    document.addEventListener('dragleave', leave, true); document.addEventListener('drop', drop, true); document.addEventListener('paste', paste);
    return () => { for (const ev of ['dragenter', 'dragover']) document.removeEventListener(ev, over, true); document.removeEventListener('dragleave', leave, true); document.removeEventListener('drop', drop, true); document.removeEventListener('paste', paste); };
  });

  const open = it => { const k = S.kindOf(it); if (k === 'link') window.open(it.url, '_blank', 'noopener,noreferrer'); else if (k === 'file') openFile(it); else setForm({ item: it }); };
  const del = it => {
    change(t('school.u_delete'), s => { const i = s.items.findIndex(x => x.id === it.id); if (i >= 0) s.items[i] = { id: it.id, at: Date.now(), gone: 1, ...(it.file ? { file: { hash: it.file.hash, size: it.file.size } } : {}) }; });
    toast(t('school.deleted', { name: it.name }), { undo: () => change(t('school.u_delete'), s => { const i = s.items.findIndex(x => x.id === it.id); if (i >= 0) s.items[i] = { ...it, at: Date.now() }; }) });
  };
  const pin = it => change(t('school.u_pin'), s => { const x = s.items.find(i => i.id === it.id); if (x) { if (x.pin) delete x.pin; else x.pin = 1; x.at = Date.now(); } });
  const moveGroup = (g, d) => change(t('school.u_group'), s => { const names = S.groupsOf(s, S.live(s)).filter(Boolean), i = names.indexOf(g), j = i + d; if (i < 0 || j < 0 || j >= names.length) return; [names[i], names[j]] = [names[j], names[i]]; s.order = names; s.ot = Date.now(); });
  const copy = (text, ok) => copyText(text).then(() => toast(ok), () => toast(t('school.cant_copy')));

  const row = it => {
    const k = S.kindOf(it), here = k !== 'file' || have.has(it.file.hash), cls = S.clsOf(it);
    const sub = [k === 'link' ? S.host(it.url) : k === 'file' ? [S.ext(it.file.name), fmtSize(it.file.size || 0), here ? '' : t('school.not_here')].filter(Boolean).join(' · ') : '', cls.length ? t('school.for', { names: cls.join(', ') }) : ''].filter(Boolean).join(' · ');
    const body = <><span class={'schic ' + k}><Icon name={IC[k]} /></span><span class="schtx"><b data-raw>{it.name}</b>{sub && <small data-raw>{sub}</small>}{it.note && <span class="schnote" data-raw>{it.note}</span>}</span></>;
    const items2 = [{ label: t('school.edit'), onSelect: () => setForm({ item: it }) }, k === 'link' && { label: t('school.copy_link'), onSelect: () => copy(it.url, t('school.link_copied')) },
      k === 'file' && { label: t('school.download'), onSelect: () => openFile(it, true) }, k === 'file' && { label: t('school.replace'), onSelect: () => { again.current = it.id; fileIn.current.click(); } },
      { label: t('school.delete'), icon: 'trash', onSelect: () => del(it) }].filter(Boolean);
    return <div class="schrow" data-sch={it.id} key={it.id}>
      {k === 'link' ? <a class="schopen" href={it.url} target="_blank" rel="noopener noreferrer">{body}</a> : <button type="button" class="schopen" onClick={() => open(it)} data-schopen>{body}</button>}
      <IconButton icon="flag" size="sm" label={t(it.pin ? 'school.unpin' : 'school.pin', { name: it.name })} aria-pressed={String(!!it.pin)} onClick={() => pin(it)} data-schpin />
      <Menu label={t('school.more_for', { name: it.name })} items={items2} trigger={p => <IconButton icon="dots" size="sm" label={t('school.more_for', { name: it.name })} tip={false} {...p} data-schmore />} />
    </div>;
  };
  const pins = words.length ? [] : S.sorted(mine.filter(i => i.pin));
  const files = (() => { const seen = new Set(), out = []; for (const i of all) if (i.file && i.file.hash && !seen.has(i.file.hash)) { seen.add(i.file.hash); out.push(i.file); } return out; })();

  return <div class="page school" ref={page} data-school-page>
    <header class="ph"><div><h1>{t('nav.school')}</h1><p>{t('school.about')}</p></div>
      <div class="end">
        {(all.length >= 6 || q) && <div class="schq"><TextInput icon="search" label={t('school.find')} value={q} onInput={setQ} onKeyDown={e => { if (e.key === 'Escape' && q) { e.preventDefault(); e.stopPropagation(); setQ(''); } }} data-schq /></div>}
        <Menu label={t('school.add')} items={[{ label: t('school.add_link'), icon: 'link', onSelect: () => setForm({ kind: 'link', cls: forNames() }) }, { label: t('school.add_file'), icon: 'file', onSelect: () => { again.current = ''; fileIn.current.click(); } }, { label: t('school.add_note'), icon: 'note', onSelect: () => setForm({ kind: 'note', cls: forNames() }) }]}
          trigger={p => <Button variant="primary" icon="plus" {...p} data-schadd>{t('school.add')}</Button>} />
      </div></header>
    <input type="file" multiple hidden ref={fileIn} onChange={e => { const fs = [...e.currentTarget.files]; e.currentTarget.value = ''; pick(fs); }} data-schin />
    {!words.length && <People s={s} setPform={setPform} setSpots={setSpots} change={change} copy={copy} />}
    {!all.length ? <EmptyState icon="school" title={t('school.none_title')} text={t('school.none_text') + ' ' + t('school.none_more')} />
      : <>
        {used.length > 0 && <div class="chips" role="group" aria-label={t('school.show')}>{[['', t('school.everything')], ...used.map(n => [S.norm(n), n])].map(([k, n]) => <Chip on={k === f} onClick={() => setFor(k)}>{k ? raw(n) : n}</Chip>)}</div>}
        {!items.length && <p class="mute" role="status">{t('school.no_hit', { q: q.trim() })}</p>}
        {pins.length > 0 && <div class="schpins" aria-label={t('school.pinned')}>{pins.map(i => <button type="button" class="chip" onClick={() => open(i)} data-schchip={i.id}><Icon name={IC[S.kindOf(i)]} />{raw(i.name)}</button>)}</div>}
        <div class="schgrid">{groups.map(g => {
          const list = S.sorted(items.filter(i => (i.group || '') === g)), gi = named.indexOf(g);
          const gm = [{ label: t('school.rename_group'), onSelect: () => setRename(g) }, gi > 0 && { label: t('school.move_up'), onSelect: () => moveGroup(g, -1) }, gi >= 0 && gi < named.length - 1 && { label: t('school.move_down'), onSelect: () => moveGroup(g, 1) }].filter(Boolean);
          return <section class="card schsec" data-schgroup={g} key={g || '-'}>
            {(g || named.length > 0) && <div class="schhead"><h2>{g ? raw(g) : t('school.other')}</h2><span class="ct">{num(list.length)}</span>{g && <Menu label={t('school.group_more', { name: g })} items={gm} trigger={p => <IconButton icon="dots" size="sm" label={t('school.group_more', { name: g })} tip={false} {...p} />} />}</div>}
            {list.map(row)}
          </section>;
        })}</div>
        <p class="mute schfoot">{t('school.foot', { n: all.length })}{files.length > 0 && <> {t('school.foot_files', { n: files.length, size: fmtSize(files.reduce((a, x) => a + (x.size || 0), 0)) })}</>}</p>
      </>}
    {form && <ItemForm o={form} s={s} choices={choices} onClose={() => setForm(null)} change={change} />}
    {pform && <PersonForm o={pform} s={s} onClose={() => setPform(null)} change={change} />}
    {spots && <Spots s={s} onClose={() => setSpots(false)} change={change} />}
    {rename != null && <Rename g={rename} onClose={() => setRename(null)} change={change} />}
  </div>;
}

// Files just chosen: too big ones are said and left out, the rest kept by their bytes. Gives [{ f, file }] for the list.
async function take(files) {
  const big = files.filter(f => f.size > S.SCH_MAX), ok = files.filter(f => S.SCH_MAX >= f.size && f.size > 0), got = [];
  try { for (const f of ok) got.push({ f, file: await S.keepFile(f) }); }
  catch (e) { console.error(e); toast(e && e.name === 'QuotaExceededError' ? t('school.full') : t('school.cant_read'), { ms: 6000 }); }
  if (big.length) toast(t('school.too_big', { n: big.length, size: fmtSize(S.SCH_MAX) }), { ms: 8000 });
  return got;
}

function ItemForm({ o, s, choices, onClose, change }) {
  const it = o.item || null, kind = it ? S.kindOf(it) : o.files ? 'file' : o.kind, files = o.files || [], one = it || files.length <= 1;
  const [url, setUrl] = useState(it ? it.url || '' : o.url || ''), [name, setName] = useState(it ? it.name : files[0] ? files[0].name.replace(/\.[^.]+$/, '') : '');
  const [group, setGroup] = useState(it ? it.group || '' : ''), [note, setNote] = useState(it ? it.note || '' : ''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [on, setOn] = useState(() => new Set((it ? S.clsOf(it) : o.cls || []).map(S.norm)));
  const clsAll = [...choices, ...(it ? S.clsOf(it) : []).filter(n => !choices.some(c => S.norm(c) === S.norm(n)))];
  const groups = [...new Set([...S.groupsOf(s, S.live(s)).filter(Boolean), ...IDEAS])];
  const title = it ? t('school.title_edit', { name: it.name }) : kind === 'link' ? t('school.title_link') : kind === 'note' ? t('school.title_note') : t('school.title_files', { n: files.length });
  const save = async () => {
    const g = group.trim().slice(0, 60), n = note.trim(), cls = clsAll.filter(c => on.has(S.norm(c))), forIt = cls.length ? { cls } : {}, now = Date.now();
    let u = '';
    if (kind === 'link') { u = S.webAddress(url); if (!u) return setErr(t('school.bad_url')); }
    if (kind === 'note' && !n) return setErr(t('school.need_note'));
    const nm = name.trim() || (kind === 'link' ? S.host(u) : kind === 'note' ? n.split('\n')[0].slice(0, 60) : '');
    if (it) { onClose(); return change(t('school.u_edit'), s => { const x = s.items.find(i => i.id === it.id); if (x) { Object.assign(x, { name: nm || x.name, group: g, note: n, at: now }, kind === 'link' ? { url: u } : {}, forIt); if (!cls.length) delete x.cls; } }); }
    if (kind !== 'file') { onClose(); return change(t('school.u_add'), s => { s.items.push({ id: S.uid(), at: now, kind, name: nm, group: g, note: n, ...(kind === 'link' ? { url: u } : {}), ...forIt }); }); }
    setBusy(true);
    const got = await take(files); onClose();
    if (!got.length) return;
    change(t('school.u_add'), s => { for (const { f, file } of got) s.items.push({ id: S.uid(), at: Date.now(), kind: 'file', name: files.length === 1 && nm ? nm : f.name.replace(/\.[^.]+$/, '') || f.name, group: g, note: n, file, ...forIt }); });
    toast(t('school.added', { n: got.length }));
  };
  const enter = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } };
  return <Sheet open title={title} onClose={onClose} footer={<><Button onClick={onClose}>{t('school.cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-schok>{it ? t('school.save') : t('school.add')}</Button></>}>
    <div class="schform" onKeyDown={enter} data-schform={kind}>
      {kind === 'link' && <TextInput label={t('school.url')} value={url} onInput={setUrl} placeholder={t('school.url_ph')} inputMode="url" spellcheck={false} autoFocus={!url} data-schurl />}
      {one ? <TextInput label={t('school.name')} value={name} onInput={setName} autoFocus={kind !== 'link' || !!url} data-schname />
        : <ul class="schfiles">{files.map(x => <li>{raw(x.name)} <span class="mute">{fmtSize(x.size)}</span></li>)}</ul>}
      <TextInput label={t('school.group')} value={group} onInput={setGroup} placeholder={t('school.group_ph')} list="sch-groups" data-schgroupin />
      <datalist id="sch-groups">{groups.map(x => <option value={x} />)}</datalist>
      <TextBox label={kind === 'note' ? t('school.note') : t('school.note_opt')} value={note} onInput={setNote} rows={kind === 'note' ? 6 : 2} placeholder={kind === 'note' ? t('school.note_ph') : t('school.note_ph2')} data-schnote />
      {clsAll.length > 0 && <fieldset class="schcls"><legend class="lbl">{t('school.for_class')}</legend>
        <div class="schclsrow">{clsAll.map(c => <Checkbox label={raw(c)} checked={on.has(S.norm(c))} onChange={v => setOn(x => { const y = new Set(x); if (v) y.add(S.norm(c)); else y.delete(S.norm(c)); return y; })} />)}</div>
        <p class="hint">{kind === 'link' ? t('school.for_link') : t('school.for_rest')}</p></fieldset>}
      {kind === 'file' && !it && <p class="hint">{t('school.copy_kept')}</p>}
      {err && <p class="err" role="alert" data-scherr>{err}</p>}
    </div>
  </Sheet>;
}

function People({ s, setPform, setSpots, change, copy }) {
  const ppl = S.people(s), roles = S.roles(s), seen = new Set();
  const one = p => <div class="schprow" data-schp={p.id} key={p.id}>
    <span class="schrole">{p.role ? raw(p.role) : t('school.no_role')}</span>
    <button type="button" class="schpname" onClick={() => setPform({ person: p })}><b data-raw>{p.name}</b>{p.note && <small data-raw>{p.note}</small>}</button>
    {p.email && <a class="btn icon sm ghost" href={'mailto:' + encodeURIComponent(p.email).replace(/%40/g, '@')} aria-label={t('school.email', { name: p.name })} data-schmail><Icon name="mail" /></a>}
    <Menu label={t('school.more_for', { name: p.name })} items={[{ label: t('school.edit'), onSelect: () => setPform({ person: p }) }, p.email && { label: t('school.copy_mail'), onSelect: () => copy(p.email, t('school.mail_copied')) },
      { label: t('school.todo_for'), onSelect: () => { askPerson(p.id); askAdd(); go('todo'); } }, { label: t('school.delete'), icon: 'trash', onSelect: () => {
        change(t('school.u_person'), s => { const i = (s.people || []).findIndex(x => x.id === p.id); if (i >= 0) s.people[i] = { id: p.id, at: Date.now(), gone: 1 }; });
        toast(t('school.person_deleted', { name: p.name }), { undo: () => change(t('school.u_person'), s => { const i = (s.people || []).findIndex(x => x.id === p.id); if (i >= 0) s.people[i] = { ...p, at: Date.now() }; }) });
      } }].filter(Boolean)} trigger={x => <IconButton icon="dots" size="sm" label={t('school.more_for', { name: p.name })} tip={false} {...x} />} />
  </div>;
  const rows = [];
  for (const r of roles) {
    const k = S.roleKey(r), here = ppl.filter(p => S.roleKey(p.role) === k); seen.add(k);
    if (here.length) rows.push(...here.map(one));
    else rows.push(<div class="schprow empty" key={'r' + k}><span class="schrole">{raw(r)}</span><Button size="sm" variant="quiet" onClick={() => setPform({ role: r })} data-schpadd={r}>{t('school.add_name')}</Button></div>);
  }
  rows.push(...ppl.filter(p => !seen.has(S.roleKey(p.role))).map(one));
  return <section class="card schppl" data-schpeople>
    <div class="schhead"><h2>{t('school.people')}</h2><span class="ct">{num(ppl.length)}</span><span class="sp" />
      <Button size="sm" variant="quiet" onClick={() => setSpots(true)} data-schroles>{t('school.spots')}</Button><Button size="sm" onClick={() => setPform({})} data-schpadd="">{t('school.add_person')}</Button></div>
    {rows.length ? rows : <p class="mute">{t('school.people_none')}</p>}
    <p class="hint">{t('school.people_say')}</p>
  </section>;
}

function PersonForm({ o, s, onClose, change }) {
  const p = o.person || null, roles = [...new Set([...S.roles(s), ...S.people(s).map(x => x.role).filter(Boolean)])];
  const [role, setRole] = useState(p ? p.role || '' : o.role || ''), [name, setName] = useState(p ? p.name : ''), [mail, setMail] = useState(p ? p.email || '' : ''), [note, setNote] = useState(p ? p.note || '' : ''), [err, setErr] = useState('');
  const save = () => {
    const r = role.replace(/\s+/g, ' ').trim().slice(0, 80), n = name.replace(/\s+/g, ' ').trim().slice(0, 80), m = mail.trim(), nt = note.trim().slice(0, 200);
    if (!n) return setErr(t('school.need_name'));
    const email = m ? S.mailOk(m) : ''; if (m && !email) return setErr(t('school.bad_mail'));
    const got = { role: r, name: n, email, note: nt, at: Date.now() }; for (const k of ['email', 'note', 'role']) if (!got[k]) delete got[k];
    onClose();
    change(t('school.u_person'), s => { s.people = s.people || []; const x = p && s.people.find(q => q.id === p.id); if (x) { for (const k of ['role', 'email', 'note']) delete x[k]; Object.assign(x, got); } else s.people.push({ id: 'sp' + S.uid(), ...got }); });
  };
  const enter = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } };
  return <Sheet open title={p ? t('school.title_edit', { name: p.name }) : o.role || t('school.add_person')} onClose={onClose} footer={<><Button onClick={onClose}>{t('school.cancel')}</Button><Button variant="primary" onClick={save} data-schpok>{p ? t('school.save') : t('school.add')}</Button></>}>
    <div class="schform" onKeyDown={enter} data-schpform>
      <TextInput label={t('school.role')} value={role} onInput={setRole} placeholder={t('school.role_ph')} list="sch-roles" autoFocus={!o.role && !p} data-schprole />
      <datalist id="sch-roles">{roles.map(x => <option value={x} />)}</datalist>
      <TextInput label={t('school.person_name')} value={name} onInput={setName} placeholder={t('school.person_name_ph')} autoFocus={!!(o.role || p)} data-schpname />
      <TextInput label={t('school.mail')} type="email" value={mail} onInput={setMail} spellcheck={false} data-schpmail />
      <TextInput label={t('school.note_opt')} value={note} onInput={setNote} placeholder={t('school.person_note_ph')} data-schpnote />
      {err && <p class="err" role="alert">{err}</p>}
    </div>
  </Sheet>;
}

function Spots({ s, onClose, change }) {
  const [v, setV] = useState(S.roles(s).join('\n'));
  const save = () => { const list = [...new Set(v.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean))].slice(0, 30); onClose(); change(t('school.u_roles'), s => { s.roles = { list: list.length ? list : S.SCH_ROLES.slice(), at: Date.now() }; }); };
  return <Sheet open title={t('school.spots_title')} onClose={onClose} footer={<><Button onClick={onClose}>{t('school.cancel')}</Button><Button variant="primary" onClick={save} data-schrolesok>{t('school.save')}</Button></>}>
    <TextBox label={t('school.spots_label')} value={v} onInput={setV} rows={8} dictate={false} spellcheck={false} data-schrolesin />
    <p class="hint">{t('school.spots_say')}</p>
  </Sheet>;
}

function Rename({ g, onClose, change }) {
  const [v, setV] = useState(g);
  const save = () => { const to = v.trim().slice(0, 60); onClose(); if (!to || to === g) return; change(t('school.u_group'), s => { const now = Date.now(); for (const i of s.items) if (!i.gone && i.group === g) { i.group = to; i.at = now; } const at = s.order.indexOf(g); if (at >= 0) { s.order[at] = to; s.ot = now; } }); };
  return <Dialog open title={t('school.new_group', { name: g })} onClose={onClose} actions={<><Button onClick={onClose}>{t('school.cancel')}</Button><Button variant="primary" onClick={save}>{t('school.rename')}</Button></>}>
    <div onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}><TextInput label={t('school.name')} value={v} onInput={setV} autoFocus /></div>
  </Dialog>;
}
