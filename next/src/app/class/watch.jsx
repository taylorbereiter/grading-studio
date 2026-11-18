// The watch list and whose work (src/watch.js): a student's strong work and concerns over time on their page, Copy notes, and
// sending pictures to the teacher's own assistant as one PDF made on this computer, each student a random code (S-XXXX) and
// every roster name in the notes as [name]. The key, which code is which student, stays in this browser (gs.wlCodes).
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Dialog, Button, Checkbox, Icon, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { library, watchCodes } from '../../students/index.js';
import { saveWatchCodes } from '../../students/write.js';
import { copyText } from '../../services/clipboard.js';
import { assistant } from '../../services/assistant.js';
import { useExamples, exLabel, exTags, picUrl, Show } from './examples.jsx';
import './lines.js';

const wlKey = (c, n) => c + '\n' + n;
const ABC = 'ACDEFGHJKMNPQRTUVWXY34679';
const classOf = id => ((library.json(null) || {}).classes || []).find(c => String(c.id) === String(id));
const day = v => date(new Date(v), { day: 'numeric', month: 'short', year: 'numeric' });
// A student's pictures, oldest first, under their roster name or another spelling of it (wlOf).
export function wlOf(all, cid, name) {
  const c = classOf(cid), other = new Set((((c && c.info) || {})[name] || {}).other || []).add(name);
  return all.filter(r => !r.gone && r.who && String(r.who.c) === String(cid) && other.has(r.who.n)).sort((a, b) => a.t - b.t);
}
// Codes for the students in these pictures, made once and kept (wlCodes).
function codesFor(list) {
  const key = { ...(watchCodes.json({}) || {}) }, used = new Set(Object.values(key)), out = new Map(); let added = false;
  for (const r of list) { if (!r.who) continue; const k = wlKey(r.who.c, r.who.n);
    if (!key[k]) { let c; do { c = 'S-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => ABC[b % ABC.length]).join(''); } while (used.has(c)); used.add(c); key[k] = c; added = true; }
    out.set(k, key[k]); }
  if (added) saveWatchCodes(key);
  return out;
}
const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Every name on the rosters these come from, with their other spellings, becomes [name] (wlScrub).
function scrubFor(list) {
  const words = new Set();
  for (const id of new Set(list.map(r => (r.who ? r.who.c : r.cls)).filter(Boolean))) { const c = classOf(id); if (!c) continue; for (const n of c.names || []) for (const s of [n, ...((((c.info || {})[n]) || {}).other || [])]) for (const w of String(s).split(/[\s,'’-]+/)) if (w.length > 1) words.add(w); }
  const rx = words.size ? new RegExp('(?<![\\p{L}])(' + [...words].sort((a, b) => b.length - a.length).map(rxEsc).join('|') + ')(?![\\p{L}])', 'giu') : null;
  return s => (rx ? String(s || '').replace(rx, '[name]') : String(s || ''));
}
const notesText = (c, name, all) => name + (c ? ', ' + c.name : '') + '\n' + all.map(r => '- ' + day(r.t) + ' · ' + (r.title || t('class.ex_asg')) + ' · ' + t(r.watch ? 'class.wl_concern' : 'class.wl_strength') + (r.why ? ': ' + r.why : '') + (exTags(r).length ? ' (' + exTags(r).join(', ') + ')' : '')).join('\n') + '\n';

// On a student's page: their strong work and concerns, newest first, with Copy notes and Send.
export function WatchStudent({ c, n }) {
  const all = useExamples(), [show, setShow] = useState(null), [send, setSend] = useState(false);
  if (!all) return null;
  const mine = wlOf(all, c.id, n); if (!mine.length) return null;
  const rev = mine.slice().reverse(), w = mine.filter(r => r.watch).length;
  return <section class="sp-sec" aria-labelledby="h-wl" data-wl-stu><div class="sp-h"><h3 id="h-wl">{t('class.wl_title')}</h3>
    <span class="acts"><Button size="sm" variant="quiet" icon="copy" onClick={() => copyText(notesText(c, n, mine)).then(ok => toast(ok ? t('class.wl_copied', { n: mine.length }) : t('class.copy_failed')))} data-wl-copy>{t('class.wl_copy')}</Button>
      <Button size="sm" variant="quiet" icon="assist" onClick={() => setSend(true)} data-wl-send1>{t('class.wl_send')}</Button></span></div>
    <p class="mute small">{t('class.wl_stu_say', { g: mine.length - w, w })}</p>
    <ul class="wltime">{rev.map((r, i) => <li class={r.watch ? 'w' : 'g'}><button type="button" class="exthumb sm" onClick={() => setShow(i)} aria-label={t('class.ex_show_one', { name: exLabel(r) })}><WPic id={r.id} /></button>
      <div><b><Icon name={r.watch ? 'flag' : 'spark'} size="xs" />{t(r.watch ? 'class.wl_concern' : 'class.wl_strength')}</b> <span class="mute">· {day(r.t)} · <span data-raw>{r.title || t('class.ex_asg')}</span></span>
        {r.why && <p data-raw>{r.why}</p>}</div></li>)}</ul>
    {show != null && <Show list={rev} at={show} onClose={() => setShow(null)} />}
    {send && <WatchSend list={mine} one={{ c: c.id, n }} onClose={() => setSend(false)} />}
  </section>;
}
function WPic({ id }) { const [src, setSrc] = useState(null); useEffect(() => { let live = true; picUrl(id, 0).then(u => live && setSrc(u)); return () => { live = false; }; }, [id]); return src ? <img src={src} alt="" /> : <span class="exph" />; }

// The send box (wlSend): which to send, what to ask, the codes, then one PDF to download. Nothing leaves this computer here.
export function WatchSend({ list, one, onClose }) {
  const codes = codesFor(one ? [{ who: one }, ...list] : list), scrub = scrubFor(list), ai = assistant(), name = ai.name || t('assistant.generic');
  const code = r => (one ? codes.get(wlKey(one.c, one.n)) : r.who ? codes.get(wlKey(r.who.c, r.who.n)) : t('class.wl_no_student'));
  const titles = [...new Set(list.map(r => r.title))], title = !one && titles.length === 1 ? scrub(titles[0] || '') : '';
  const n1 = list.filter(r => r.watch).length, n2 = list.length - n1;
  const [bad, setBad] = useState(true), [good, setGood] = useState(!!one || list.every(r => !r.watch)), [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(() => (one ? t('class.wl_ask_one', { code: code(list[0]) }) : t(title ? 'class.wl_ask_all_on' : 'class.wl_ask_all', { title })));
  const picked = list.filter(r => (r.watch ? bad : good));
  const pdf = async () => {
    setBusy(true);
    try {
      const P = await PARTS.pdflib(), doc = await P.PDFDocument.create(), F = await doc.embedFont(P.StandardFonts.Helvetica), Bd = await doc.embedFont(P.StandardFonts.HelveticaBold);
      const PW = 612, PH = 792, M = 48, CW = PW - 2 * M, ink = P.rgb(0.12, 0.13, 0.15), soft = P.rgb(0.36, 0.38, 0.42);
      doc.setTitle(t('class.wl_pdf_title')); doc.setAuthor(''); doc.setCreator('Grading Studio'); doc.setProducer('');
      let pg = null, y = 0; const page = () => { pg = doc.addPage([PW, PH]); y = PH - M; }, room = hh => { if (!pg || y - hh < M) page(); };
      const pict = async (s, size, bold) => { const k = 3, c = document.createElement('canvas'), x = c.getContext('2d'), f = (bold ? '600 ' : '') + size * k + 'px Inter, sans-serif', lines = []; x.font = f;
        let line = ''; for (const ch of [...s]) { const tt = line + ch; if (line && x.measureText(tt).width > CW * k) { lines.push(line); line = ch; } else line = tt; } lines.push(line);
        c.width = CW * k; c.height = Math.ceil(lines.length * (size + 5) * k); x.font = f; x.fillStyle = '#1f2125'; x.textBaseline = 'top'; lines.forEach((l, i) => x.fillText(l, 0, i * (size + 5) * k));
        const png = await new Promise(res => c.toBlob(res, 'image/png')), img = await doc.embedPng(await png.arrayBuffer()), hh = lines.length * (size + 5); room(hh); pg.drawImage(img, { x: M, y: y - hh, width: CW, height: hh }); y -= hh; };
      const plain = s => String(s || '').replace(/[‘’]/g, '\'').replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
      const text = async (s, font, size, color) => { for (const p0 of String(s).split('\n')) { const para = plain(p0); if (/[^\x00-\xFF]/.test(para)) { await pict(p0, size, font === Bd); continue; } let line = ''; const put = () => { room(size + 5); pg.drawText(line, { x: M, y: y - size, size, font, color }); y -= size + 5; };
        for (const w of para.split(/\s+/).filter(Boolean)) { const tt = line ? line + ' ' + w : w; if (line && font.widthOfTextAtSize(tt, size) > CW) { put(); line = w; } else line = tt; } put(); } };
      const { examplePictures } = await import('../../students/index.js');
      await text(t('class.wl_pdf_need'), Bd, 15, ink); await text(ask, F, 11, ink); y -= 10;
      for (const r of picked) {
        room(120);
        await text(code(r) + ' - ' + t(r.watch ? 'class.wl_concern' : 'class.wl_strength') + ' - ' + scrub(r.title || t('class.ex_asg')) + ' - ' + new Date(r.t).toISOString().slice(0, 10), Bd, 12, ink);
        if (r.why) await text(t('class.wl_pdf_note', { note: scrub(r.why) }), F, 11, ink);
        if (exTags(r).length) await text(t('class.wl_pdf_tags', { tags: scrub(exTags(r).join(', ')) }), F, 9.5, soft);
        for (let n = 0; n < r.pages.length; n++) { const b = await examplePictures.get(r.id + '|' + n); if (!b) continue; const img = await doc.embedJpg(new Uint8Array(await b.arrayBuffer())), k = Math.min(CW / img.width, (r.kind === 'paper' ? PH - 2 * M : 380) / img.height), w = img.width * k, hh = img.height * k; room(hh + 4); pg.drawImage(img, { x: M, y: y - hh, width: w, height: hh }); y -= hh + 8; }
        y -= 14;
      }
      const nm = one ? code(picked[0]) : new Set(picked.map(r => r.title)).size === 1 ? scrub(picked[0].title || t('class.ex_watchlist')) : t('class.ex_watchlist');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([await doc.save()], { type: 'application/pdf' })); a.download = t('class.wl_pdf_file', { name: nm }).replace(/[\\/:*?"<>|]+/g, '-') + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(t('class.wl_pdf_done', { ai: name }), { ms: 6000 });
    } catch (e) { console.error(e); toast(t('class.ex_failed')); }
    setBusy(false);
  };
  return <Dialog open wide title={t('class.wl_send_t', { ai: name })} onClose={onClose}
    actions={<><span class="grow" /><Button icon="copy" onClick={() => copyText(ask).then(ok => toast(ok ? t('class.wl_ask_copied', { ai: name }) : t('class.copy_failed')))} data-wl-copyask>{t('class.wl_copy_ask')}</Button>
      {ai.link && <a class="btn" href={ai.link} target="_blank" rel="noopener">{t('class.wl_open_ai', { ai: name })}</a>}
      <Button variant="primary" icon="download" disabled={!picked.length || busy} onClick={pdf} data-wl-pdf>{t('class.wl_pdf')}</Button></>}>
    <p class="mute small">{t('class.wl_send_say')}</p>
    {n1 > 0 && n2 > 0 && <p class="wlpick"><Checkbox label={t('class.wl_concerns_n', { n: n1 })} checked={bad} onChange={setBad} /><Checkbox label={t('class.wl_strengths_n', { n: n2 })} checked={good} onChange={setGood} /></p>}
    <div class="wlstrip">{picked.length ? picked.map(r => <figure><WPic id={r.id} /><figcaption><b>{code(r)}</b> · {t(r.watch ? 'class.wl_concern' : 'class.wl_strength')}</figcaption></figure>) : <p class="mute">{t('class.wl_nothing')}</p>}</div>
    <label class="cp-fld"><span class="lab">{t('class.wl_what_ask')}</span><textarea class="input" rows="7" value={ask} onInput={e => setAsk(e.currentTarget.value)} data-wl-ask /></label>
    {codes.size > 0 && <details class="wlkey"><summary>{t('class.wl_key')}</summary><ul>{[...codes.entries()].map(([k, c]) => <li><b>{c}</b> · <span data-raw>{k.split('\n')[1]}</span></li>)}</ul></details>}
  </Dialog>;
}
