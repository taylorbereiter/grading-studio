// A sample class from before 11/13, kept beside her own classes (src/welcome.js sampleNoteRender, sampleRemove): what it is, and
// Set up my own classes (only while the three questions were never answered here), Open the sample papers, Remove the sample class.
// Removing forgets each of its downloads the way Forget does (class/assignment.jsx forgetDownload), then takes the class out of the
// library through the write layer, as the current app does, with no question first: nothing in it is real. Its words are Home's (L).
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Icon, toast } from '../../ui/index.js';
import { go, PARTS } from '../router.js';

export function OldSample({ s, L, onGone }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      const [A, W] = await Promise.all([PARTS.asg(), PARTS.write()]);
      const cls = (await import('../../students/counts.js')).readLibrary().classes.find(x => String(x.id) === s.id);
      if (!cls) { onGone(); return; }
      for (const u of cls.units || []) for (const it of u.items || []) if (it.batchId) { try { await A.forgetDownload(it.batchId, it.name); } catch (e) { console.error(e); } }
      await W.saveLibrary(l => { l.classes = (l.classes || []).filter(x => String(x.id) !== s.id); });
      toast(L.os_gone); onGone();
    } catch (e) { console.error(e); toast(L.os_cant); setBusy(false); }
  };
  return <section class="card pad fask" data-home="oldsample"><Icon name="inbox" /><div>
    <h2>{L.os_h}</h2><p>{L.os_text}</p>
    <div class="row gap">{!s.asked && <Button variant="primary" onClick={() => PARTS.welcome().then(m => m.welcome(), e => console.error(e))} data-os-setup>{L.os_setup}</Button>}
      <Button variant={s.asked ? 'plain' : 'quiet'} onClick={() => go('class', s.id)} data-os-open>{L.os_open}</Button>
      <Button variant="quiet" disabled={busy} onClick={remove} data-os-rm>{L.os_rm}</Button></div></div></section>;
}
