// Settings: the frame with its groups (the feature list's "Settings > …" homes). Display (theme, language, the sample) and About
// and updates work now; the others arrive with the screens that use them and say so.
import { h, Fragment } from 'preact';
import { NavItem, ThemePicker, Select, Button, Card, Segmented, toast, EmptyState } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import { currentLook, saveLook, onLook } from '../../services/theme.js';
import { useState, useEffect } from 'preact/hooks';
import { LANGUAGES, IN_NEXT, savedLanguage, saveLanguage } from '../language.js';
import { sampleOn, enterSample, leaveSample } from '../sample.js';
import { useUpdate } from '../update.js';

export const GROUPS = [['classes', 'people', 'settings.classes'], ['timetable', 'cal', 'settings.timetable'], ['grading', 'grades', 'settings.grading'], ['marking', 'pen', 'settings.marking'],
  ['focus', 'timer', 'settings.focus'], ['ai', 'assist', 'settings.ai'], ['saving', 'cloud', 'settings.saving'], ['display', 'sun', 'settings.display'], ['about', 'info', 'settings.about']];

function Display() {
  const [look, setLook] = useState(currentLook()), [lang, setLang] = useState(savedLanguage());
  useEffect(() => onLook(setLook), []);
  const pick = n => { if (!saveLook(n)) toast(t('look.not_kept')); };
  const pickLang = v => { if (saveLanguage(v)) setLang(v); else toast(t('settings.not_kept')); };
  return <>
    <Card title={t('look.title')}><p class="mute">{t('settings.theme_about')}</p><ThemePicker value={look} onPick={pick} /></Card>
    <Card>
      <Select label={t('settings.language')} options={LANGUAGES.map(([v, label]) => ({ value: v, label }))} value={lang} onChange={pickLang} data-raw />
      {!IN_NEXT.includes(lang) && <p class="hint" role="note">{t('settings.language_later')}</p>}
    </Card>
    <Card title={t('sample.title')}><p class="mute">{sampleOn() ? t('sample.text') : t('sample.about')}</p>
      {sampleOn() ? <Button onClick={leaveSample}>{t('sample.leave')}</Button> : <Button onClick={() => { if (!enterSample()) toast(t('sample.cant')); }}>{t('sample.open')}</Button>}</Card>
  </>;
}
function About() {
  const u = useUpdate();
  return <Card title={t('settings.about')}>
    <p>{u.current ? t('update.current', { v: u.current }) : t('update.not_kept')}</p>
    {u.waiting && <p role="status">{t('update.ready_v', { v: u.waiting })}</p>}
    <div class="row gap">{u.waiting ? <Button variant="primary" onClick={u.apply}>{t('update.now')}</Button> : <Button onClick={u.check}>{t('update.check')}</Button>}</div>
    <Segmented label={t('update.mode')} value={u.mode} onChange={u.setMode} options={[{ value: 'ask', label: t('update.mode_ask') }, { value: 'auto', label: t('update.mode_auto') }]} />
    {u.checked === 'offline' && <p class="hint">{t('update.offline')}</p>}
  </Card>;
}
export default function Settings({ route }) {
  const g = GROUPS.find(x => x[0] === route.params.group) || GROUPS.find(x => x[0] === 'display');
  return <div class="page">
    <header class="ph"><h1>{t('nav.settings')}</h1><p>{t('settings.about_page')}</p></header>
    <div class="setg">
      <nav class="setnav" aria-label={t('nav.settings')}>{GROUPS.map(([id, icon, line]) => <NavItem icon={icon} label={t(line)} href={href('settings', id)} current={id === g[0]} />)}</nav>
      <section class="setbody" aria-label={t(g[2])}>
        <h2 class="h2">{t(g[2])}</h2>
        {g[0] === 'display' ? <Display /> : g[0] === 'about' ? <About /> : <EmptyState icon="spark" title={t('settings.later_title')} text={t('settings.later_text')} />}
      </section>
    </div>
  </div>;
}
