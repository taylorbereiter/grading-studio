// Settings > Classes > My setup (src/setupin.js): how she works, as one block of text, without a student in it. A prompt to give her
// assistant (or a colleague's setup) comes back pasted here; Check it shows what would change, part by part, each with a tick; Bring
// it in changes only the ticked parts, and Put it back undoes them, except what has been used since. Her own setup copies out the
// same way, or saves as a file. The reading, bringing in and putting back are the current app's (students/setup.js, engines/gstp.js).
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Card, Button, Checkbox, TextBox, CopyButton, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { assistant } from '../../services/assistant.js';
import { readSetup, applySetup, undoSetup, lastSetup, exportSetup, setupPrompt } from '../../students/setup.js';
import { setupParts } from './diff.js';
import '../screens/prefs-lines.js';

const ERR = { empty: 'prefs.su_err_empty', long: 'prefs.su_err_long', notours: 'prefs.su_err_notours', none: 'prefs.su_err_none' };
export function MySetup() {
  const [text, setText] = useState(''), [got, setGot] = useState(null), [pick, setPick] = useState({}), [busy, setBusy] = useState(false), [last, setLast] = useState(lastSetup);
  const ai = assistant().name;
  const check = async () => {
    setBusy(true);
    try {
      const r = await readSetup(text);
      if (r.err) { setGot({ err: r.err }); return; }
      const parts = setupParts(r.M, r.S, r.plan);
      setGot({ S: r.S, parts }); setPick(Object.fromEntries(parts.map(p => [p.key, true])));
    } catch (e) { console.error(e); setGot({ err: 'none' }); } finally { setBusy(false); }
  };
  const back = async () => {
    setBusy(true);
    try { const kept = await undoSetup(); toast(t(kept ? 'prefs.su_undone_kept' : 'prefs.su_undone')); setLast(lastSetup()); }
    catch (e) { console.error(e); toast(t('prefs.su_failed')); } finally { setBusy(false); }
  };
  const bring = async () => {
    const on = Object.fromEntries(Object.entries(pick).filter(([, v]) => v)); if (!Object.keys(on).length) return;
    setBusy(true);
    try {
      await applySetup(got.S, on);
      setGot(null); setText(''); setLast(lastSetup());
      toast(t('prefs.su_done', { n: Object.keys(on).length }), { undo: back });
    } catch (e) { console.error(e); toast(t('prefs.su_failed')); } finally { setBusy(false); }
  };
  const save = async () => {
    const s = await exportSetup(), b = new Blob([s], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'grading-studio-setup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const n = got && got.parts ? Object.values(pick).filter(Boolean).length : 0;
  return <Card title={t('prefs.su_h')} data-mysetup>
    <p class="mute">{t('prefs.su_about')}</p>
    <ol class="st-steps">
      <li><span>{ai ? t('prefs.su_step1_named', { name: ai }) : t('prefs.su_step1')}</span> <CopyButton text={() => setupPrompt(ai)} label={t('prefs.su_copy_prompt')} data-supromptcopy /></li>
      <li><span>{t('prefs.su_step2')}</span></li>
    </ol>
    <TextBox label={t('prefs.su_paste')} value={text} onInput={v => { setText(v); if (got) setGot(null); }} rows={5} spellcheck="false" data-raw data-supaste />
    <div class="row gap"><Button variant="primary" disabled={busy || !text.trim()} onClick={check} data-sucheck>{t('prefs.su_check')}</Button>
      {last && <Button disabled={busy} onClick={back} data-suundo>{t('prefs.su_undo')}</Button>}</div>
    {got && got.err && <p class="err" role="alert" data-suerr>{t(ERR[got.err])}</p>}
    {got && got.parts && <div class="st-preview" data-supreview role="region" aria-label={t('prefs.su_preview')}>
      {got.S.left.length > 0 && <p class="hint" data-suleft>{t('prefs.su_left', { n: got.S.left.length })}</p>}
      {got.S.unknown.length > 0 && <p class="hint">{t('prefs.su_unknown', { list: got.S.unknown.join(', ') })}</p>}
      {got.S.notes.length > 0 && <p class="hint">{t('prefs.su_notes')}</p>}
      {got.parts.length ? got.parts.map(p => <section class="st-part" data-supart={p.key}>
        <Checkbox label={p.title} checked={!!pick[p.key]} onChange={v => setPick(o => ({ ...o, [p.key]: v }))} />
        <ul data-raw>{p.lines.map(l => <li>{l}</li>)}</ul>
        {p.sub && <p class="hint">{p.sub}</p>}
      </section>) : <p data-susame>{t('prefs.su_same')}</p>}
      {got.parts.length > 0 && <Button variant="primary" disabled={busy || !n} onClick={bring} data-subring>{t('prefs.su_bring', { n })}</Button>}
    </div>}
    <h4 class="sg-mkh">{t('prefs.su_out_h')}</h4>
    <p class="mute">{t('prefs.su_out_about')}</p>
    <div class="row gap"><CopyButton text={exportSetup} label={t('prefs.su_copy_mine')} data-sucopy /><Button size="sm" variant="quiet" icon="download" onClick={save} data-susave>{t('prefs.su_save')}</Button></div>
  </Card>;
}
