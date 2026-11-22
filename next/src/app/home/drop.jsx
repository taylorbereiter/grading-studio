// New student work dropped anywhere on Home (src/app/wiring.js, the drop on Today, and src/app/open.js intake): files, a folder or
// a ZIP are read as they come (a single folder is the download itself, its name the download's), opened the way papers brought
// in on an assignment are (mark/open.js bringIn, kept in this browser through the write layer), and the first paper shown. While
// files are dragged over, Home says where they go. A newer copy of a download already worked on asks first, as class-work.jsx does.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Dialog, Icon, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import '../mark/lines.js';
import '../mark/setup-lines.js';
import '../mark/inout-lines.js';

const files = e => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
const busyElse = () => !!document.querySelector('dialog[open], [data-welcome]');
// A dropped folder or file, walked into [{ path, file }] (src/app/wiring.js walkEntry)
async function walk(en, at, out) {
  if (en.isFile) { const f = await new Promise((ok, no) => en.file(ok, no)); out.push({ path: at + f.name, file: f }); return; }
  const r = en.createReader();
  for (;;) { const l = await new Promise((ok, no) => r.readEntries(ok, no)); if (!l.length) break; for (const x of l) await walk(x, at + en.name + '/', out); }
}
export async function fromDrop(entries, list) {
  const out = []; let label = '';
  if (!entries.length) return { list: list.map(f => ({ path: f.name, file: f })), label };
  if (entries.length === 1 && entries[0].isDirectory) {   // the dropped folder is the download itself
    label = entries[0].name; const l = []; await walk(entries[0], '', l);
    for (const x of l) out.push({ path: x.path.split('/').slice(1).join('/'), file: x.file });
  } else for (const en of entries) await walk(en, '', out);
  return { list: out, label };
}
export function HomeDrop() {
  const [over, setOver] = useState(false), [busy, setBusy] = useState(false), [ask, setAsk] = useState(null);
  useEffect(() => {
    let left = 0;
    const on = e => { if (!files(e) || busyElse()) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (e.type === 'dragenter') left++; setOver(true); };
    const off = e => { if (e.type === 'dragleave' && --left > 0) return; left = 0; setOver(false); };
    const drop = async e => {
      if (!files(e) || busyElse()) return;
      e.preventDefault(); left = 0; setOver(false);
      // what was dropped is read while the drop lasts; the folders are walked after
      const entries = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean), list = [...e.dataTransfer.files];
      setBusy(true);
      try {
        const got = await fromDrop(entries, list), O = await PARTS.bring();
        const carry = x => new Promise(done => setAsk({ e: x, done: v => { setAsk(null); done(v); } }));
        const r = await O.bringIn(got.list, { label: got.label, carry });
        if (r && r.changed) toast(t('setup.c_changed_toast', { n: r.changed }), { ms: 7000 });
        if (r) go('mark', r.batch.id);
      } catch (er) { console.error(er); toast(er && er.name === 'NothingIn' ? t('setup.w_nothing') : er && er.name === 'CannotSave' ? t('mark.cannot') : t('setup.w_failed')); }
      finally { setBusy(false); }
    };
    const evs = [['dragenter', on], ['dragover', on], ['dragleave', off], ['drop', drop]];
    for (const [n, f] of evs) document.addEventListener(n, f);
    return () => { for (const [n, f] of evs) document.removeEventListener(n, f); };
  }, []);
  return <>
    {(over || busy) && <div class="hdrop" role="status" data-hdrop={busy ? 'busy' : 'over'}><Icon name="download" />
      <div><h2>{t(busy ? 'inout.hd_busy' : 'inout.hd_h')}</h2>{!busy && <p>{t('inout.hd_say')}</p>}</div></div>}
    {ask && <Dialog open title={t('setup.c_ask_t')} onClose={() => ask.done(false)}
      actions={<><Button onClick={() => ask.done(false)} data-fresh>{t('setup.c_fresh')}</Button><Button variant="primary" onClick={() => ask.done(true)} data-carry>{t('setup.c_bring')}</Button></>}>
      <p data-raw>{t('setup.c_ask', { name: ask.e.name || t('setup.c_noname') })}</p>
      <p>{ask.e.unchecked ? t('setup.c_ask_unchecked') : t('setup.c_ask_same', { named: ask.e.named, all: ask.e.nOld, n: ask.e.same })}</p>
      <p>{t('setup.c_ask_q')}</p></Dialog>}
  </>;
}
