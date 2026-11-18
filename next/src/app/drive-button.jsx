// "From Google Drive" beside a place that takes files (src/gpick.js gpBtn): Google's own chooser, and the files picked go into the
// file input beside it as if they came from the computer, so what happens next is the same. Shown only where Google can be used
// here (the web address, not a copy opened from a file; on an iPhone or iPad only while signed in, since signing in leaves the page).
// input: a ref to the file input; without one, the input just before this button (or inside the label just before it). onClick runs
// first, as the button beside it does before it opens the computer's chooser.
import { h } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { Button, IconButton, toast } from '../ui/index.js';
import { t } from '../i18n/t.js';
import { useSaving } from '../services/saving.js';

const FAIL = { closed: 'drive.closed', offline: 'drive.offline', setup: 'drive.offline' };
export function DriveButton({ input, small, office, size = 'sm', variant = 'quiet', onClick: before, ...rest }) {
  const S = useSaving(), me = useRef(null), [busy, setBusy] = useState(false);
  if (!S || !S.google().pickNow) return null;
  const find = () => {
    if (input && input.current) return input.current;
    const prev = me.current && me.current.previousElementSibling;
    return prev && (prev.matches('input[type=file]') ? prev : prev.querySelector('input[type=file]'));
  };
  const go = async () => {
    const inp = find(); if (!inp) return;
    if (before) before();
    setBusy(true);
    try { await S.driveFill(inp, { office, title: t(inp.multiple ? 'drive.pick_many' : 'drive.pick_one'), say: (n, of) => n === 1 && toast(t('drive.getting', { n: of })) }); }
    catch (e) { console.error(e); toast(t(FAIL[e && e.why] || 'drive.failed')); }
    finally { setBusy(false); }
  };
  return <span ref={me} class="drv">{small ? <IconButton icon="drive" label={t('file.from_drive_pick')} size={size} disabled={busy} onClick={go} data-drive {...rest} />
    : <Button icon="drive" size={size} variant={variant} disabled={busy} onClick={go} data-drive {...rest}>{t('file.from_drive_pick')}</Button>}</span>;
}
