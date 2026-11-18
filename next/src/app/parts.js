// A screen's lazy part (router.js PARTS) as a hook: null until it has come in, then the module, kept for the next time.
import { useState, useEffect } from 'preact/hooks';
import { toast } from '../ui/index.js';
import { t } from '../i18n/t.js';
import { PARTS } from './router.js';

const got = {};
export function usePart(name, want = true) {
  const [, bump] = useState(0);
  useEffect(() => { if (want && !got[name]) PARTS[name]().then(m => { got[name] = m; bump(n => n + 1); }, e => { console.error(e); toast(t('app.chunk_failed')); }); }, [name, want]);
  return got[name] || null;
}
