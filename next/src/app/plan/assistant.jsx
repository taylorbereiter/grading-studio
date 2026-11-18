// The assistant sheet (design screenshot 3c): the lesson goes to the teacher's AI assistant as one self-contained message, and
// what comes back (one .zip) is looked at slide by slide before it is kept. The message is the current Planner's own
// (src/planner/review.js sendToClaude, lessonZipAsk, lessonContext; src/planner/lessons.js lessonText): it never names a folder,
// a path or a file on this computer, and asks for a .zip with lesson.json, a preview PowerPoint and the handouts, and each piece
// again as its own file. The PowerPoint is made here from lesson.json with the teacher's template (Download slides).
//
// What comes back is read as the current Planner reads it (src/planner/finished.js lessonZip, lessonBack): lesson.json's slides
// take the places of the lesson's, keeping each place's id, picture, screenshots and the teacher's own comments; the other files go
// to the lesson's Materials. Before anything is kept, the lesson as it was is saved under its Versions.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Sheet, Button, Checkbox, Icon, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { assistant } from '../../services/assistant.js';
import { engine } from '../../planning/engine.js';
import { saveVersion, saveLessonFile } from '../../planning/write.js';
import { Slide } from './slide.jsx';
import { briefFor, readZip, copy, same } from './brief.js';

export function AssistantSheet({ p, l, open, onClose, save }) {
  const ai = assistant(), name = ai.name || t('assistant.generic');
  const [got, setGot] = useState(null), [keep, setKeep] = useState({}), [busy, setBusy] = useState(false), [over, setOver] = useState(false);
  const E = engine(p);
  // Strong examples stay on the student side: only the teacher's own pictures are offered for attaching.
  const pics = l.slides.filter(s => s.img && !String(s.img.src || '').startsWith('gsex:')).length;
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(await briefFor(p, l)); toast(pics ? t('plan.brief_copied_pics', { n: pics, name }) : t('plan.brief_copied', { name })); }
    catch (e) { console.error(e); toast(t('plan.copy_failed')); }
  };
  const take = async f => {
    if (!f) return; if (!/\.zip$/i.test(f.name)) return toast(t('plan.zip_only'));
    setBusy(true);
    try { const r = await readZip(p, l, f); if (r.none) toast(t('plan.zip_empty')); else { setGot(r); setKeep(Object.fromEntries((r.lesson ? r.lesson.slides : []).map((s, i) => [i, true]))); } }
    catch (e) { console.error(e); toast(t('plan.zip_bad')); } finally { setBusy(false); }
  };
  const keepIt = async () => {
    setBusy(true);
    try {
      await saveVersion(l, t('plan.before_changes', { name }), E.snap, E.MAX_VERSIONS);
      const n = copy(l);
      if (got.lesson) {
        const before = l.slides, theirs = got.lesson.slides;
        n.slides = theirs.map((s, i) => keep[i] ? s : before[i]).filter(Boolean);
        n.title = got.lesson.title; if (got.lesson.claudeNote) n.claudeNote = got.lesson.claudeNote;
        delete n.pending; n.status = '';
      }
      if (got.files.length) {
        n.files = n.files || [];
        for (const f of got.files) {
          const old = n.files.find(x => x.kind !== 'doc' && x.name === f.name); if (old) n.files = n.files.filter(x => x !== old);
          const id = E.lid(), b = new Blob([f.bytes], { type: E.mimeOf(f.name) });
          await saveLessonFile(b, id);
          n.files.push({ id, name: f.name, kind: 'other', type: b.type, size: b.size, added: Date.now() });
        }
      }
      await save(n);
      toast(t('plan.kept_changes', { n: n.slides.length, files: got.files.length }));
      setGot(null); onClose();
    } catch (e) { console.error(e); toast(t('plan.keep_failed')); } finally { setBusy(false); }
  };
  const rows = got && got.lesson ? got.lesson.slides.map((s, i) => ({ s, i, was: l.slides[i], changed: !same(s, l.slides[i]) })) : [];
  const changed = rows.filter(r => r.changed);
  return <Sheet open={open} wide title={t('plan.work_with', { name })} icon={<Icon name="assist" />} onClose={() => { setGot(null); onClose(); }}
    footer={got ? <><Button variant="quiet" onClick={() => setGot(null)}>{t('common.cancel')}</Button><Button variant="primary" disabled={busy} onClick={keepIt} data-focus="keep-changes">{t('plan.keep_these')}</Button></> : null}>
    {!got ? <div class="asst">
      <ol class="asteps">
        <li><b>{t('plan.step_copy')}</b><p class="mute">{t('plan.step_copy_text', { name })}</p>
          <div class="row"><Button variant="primary" icon="copy" onClick={doCopy} data-focus="copy-brief">{t('plan.copy_brief')}</Button>
            {ai.link && <a class="btn" href={ai.link} target="_blank" rel="noopener">{t('plan.open_name', { name })}<Icon name="arrow" size="xs" /></a>}</div>
          {pics > 0 && <p class="mute">{t('plan.attach_pics', { n: pics })}</p>}</li>
        <li><b>{t('plan.step_zip')}</b><p class="mute">{t('plan.step_zip_text', { name })}</p>
          <label class={'drop' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
            <Icon name="upload" /><span>{busy ? t('plan.reading') : t('plan.drop_zip')}</span>
            <input type="file" accept=".zip,application/zip" class="vh" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; take(f); }} data-zip />
          </label></li>
        <li><b>{t('plan.step_review')}</b><p class="mute">{t('plan.step_review_text')}</p></li>
      </ol></div>
      : <div class="asst">
        {got.lesson && <p>{t('plan.n_changed', { n: changed.length, of: rows.length })}</p>}
        {got.files.length > 0 && <p class="mute">{t('plan.n_files_in', { n: got.files.length })} <span data-raw>{got.files.map(f => f.name).join(', ')}</span></p>}
        {got.big.length > 0 && <p class="mute">{t('plan.too_big')} <span data-raw>{got.big.join(', ')}</span></p>}
        <ol class="review">{rows.map(r => <li class={r.changed ? 'ch' : ''}>
          <Checkbox checked={!!keep[r.i]} disabled={!r.changed && !!r.was} onChange={v => setKeep({ ...keep, [r.i]: v })}
            label={r.was ? (r.changed ? t('plan.keep_new_n', { n: r.i + 1 }) : t('plan.same_n', { n: r.i + 1 })) : t('plan.add_new_n', { n: r.i + 1 })} />
          <div class="pair">{r.was && r.changed && <Slide slide={r.was} lesson={l} plan={p} width={220} />}<Slide slide={r.s} lesson={got.lesson} plan={p} width={220} /></div>
        </li>)}</ol>
      </div>}
  </Sheet>;
}
