// Settings > Classes: Classes and rosters (src/settings.js, #setClasses): each class with how many students and whether its link to
// the school's system is saved, opened from its name; its menu has Name and roster (people.jsx RosterDialog) and its link (the
// class page's own box, classlink.jsx LinkDialog). Above them From Google Classroom… (classroom.jsx) and Add a class (the sidebar's
// own page), and No classes yet while there are none. Each box saves through the write layer as it does on the class page.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Card, Button, IconButton, Menu } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href, PARTS } from '../router.js';
import { useBook } from './data.js';
import { classLink } from '../../students/book.js';
import { LinkDialog } from './classlink.jsx';
import './lines.js';

export function ClassList() {
  const b = useBook(), [box, setBox] = useState(null);
  if (!b || b.error) return null;
  const lib = b.lib, sys = String((lib.me || {}).sys || '').trim(), what = sys || t('class.cl_page'), list = lib.classes || [];
  const roster = c => PARTS.people().then(m => setBox({ C: m.RosterDialog, c }), e => console.error(e));
  const gc = () => PARTS.gc().then(m => setBox({ G: m.ClassroomSheet }), e => console.error(e));
  return <Card title={t('class.sc_h')} data-stclasses>
    <p class="mute">{t('class.sc_about')}</p>
    {list.length ? <ul class="sv-list">{list.map(c => {
      const url = classLink(c);
      return <li data-stcls={c.id}><span><a href={href('class', c.id)} data-raw data-stcls-open><b>{c.name}</b></a>
        <span class="mute"> · {c.names.length ? t('class.n_students', { n: c.names.length }) : t('class.sc_noroster')} · {t(url ? 'class.sc_link_on' : 'class.sc_link_off', { what })}</span></span>
        <Menu label={t('class.student_menu', { name: c.name })} items={[{ label: t('class.sc_roster'), icon: 'people', onSelect: () => roster(c) },
          { label: t(url ? 'class.cl_change' : 'class.cl_add', { what }), icon: 'link', onSelect: () => setBox({ link: c, url }) }]}
          trigger={m => <IconButton {...m} icon="dots" size="sm" label={t('class.student_menu', { name: c.name })} data-stcls-menu />} /></li>;
    })}</ul> : <p class="hint" data-stcls-none>{t('class.sc_none')}</p>}
    <div class="row gap"><a class="btn pri" href={href('class', 'new')} data-stcls-add>{t('nav.add_class')}</a><Button variant="quiet" onClick={gc} data-stcls-gc>{t('class.gc_open')}</Button></div>
    {box && box.C && <box.C c={box.c} onClose={() => setBox(null)} />}
    {box && box.G && <box.G onClose={() => setBox(null)} />}
    {box && box.link && <LinkDialog c={box.link} sys={sys} url={box.url} onClose={() => setBox(null)} />}
  </Card>;
}
