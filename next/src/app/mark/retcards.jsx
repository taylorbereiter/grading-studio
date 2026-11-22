// The Return tab's second-level pieces (stage 8, slice D), loaded as a part of their own (router.js PARTS.retcards) so the Return
// screen's own chunk stays small: the check before returning (src/grades.js exportCheckHtml, D-030, D-031), who got theirs early
// (src/app/export.js earlyBox, D-029), what the options have on (optsSay, D-032), the mark key's hint and its link (D-033, D-034),
// the files that weren't in an export, kept until closed (src/exportreport.js exportReport, D-035), and the side cards: Ask your
// assistant and Rescans (src/tabs.js returnSideHtml, A-020 to A-023).
import { h, Fragment } from 'preact';
import { Button, Card } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { anonOn, shownName } from '../../engines/gdraw.js';
import { state } from '../../engines/gcore.js';
import './inout-lines.js';
import './setup-lines.js';
import './paper-lines.js';

// The engines' own notes (src/grades.js partNote, disagreeNote) are English; each shape is one line here.
const NOTES = [[/^(\d+) of (\d+) rows scored$/, m => t('inout.rows_scored', { n: m[1], of: m[2] })], [/^(\d+) of (\d+) questions marked in Quick mark$/, m => t('inout.qs_marked', { n: m[1], of: m[2] })],
  [/^Your score is (.+), the Word rubric says (.+)$/, m => t('inout.score_vs_word', { a: m[1], b: m[2] })], [/^Your score is (.+), the paper says (.+)$/, m => t('inout.score_vs_paper', { a: m[1], b: m[2] })]];
const said = s => { for (const [rx, f] of NOTES) { const m = rx.exec(s); if (m) return f(m); } return s; };
// One line until she opens it; the download button stays right under it. A name opens that student; a grade to confirm opens the
// grade sheet, where it is confirmed (with names hidden it opens the student instead, as the current app does).
export function Check({ E, onOpen, onSheet }) {
  const c = E.check();
  const groups = [['inout.r_ck_unfinished', c.unfinished], ['inout.r_ck_nopaper', c.noPaper], ['inout.r_ck_disagree', c.disagree], ['inout.r_ck_unmarked', c.unmarked], ['inout.r_ck_doubts', c.doubts, true]].filter(g => g[1].length);
  if (!groups.length) return <p class="xchk ok" id="xCheck" data-xcheck="ok">✓ {t('inout.r_ck_ok')}</p>;
  const n = groups.reduce((a, g) => a + g[1].length, 0);
  const note = o => o.part != null ? (o.part ? t('inout.r_ck_partial', { what: said(o.part) }) : t('setup.i_not_scored'))
    : o.note ? said(o.note) : o.bad ? t('inout.r_ck_bad') : o.many ? t('inout.r_ck_many', { n: o.many }) : o.said ? t('inout.r_ck_is', { v: o.said }) : '';
  const item = (o, sheet) => { const say = note(o);
    return <li><button type="button" class="link" data-raw data-chk={o.i} onClick={() => (sheet && !anonOn() ? onSheet() : onOpen(o.i))}>{o.name}</button>
      {(say || o.fname) && <span class="mute"> {o.fname && <span data-raw>{o.fname}</span>}{o.fname && say ? ': ' : ''}{say}</span>}</li>; };
  return <details class="xchk" id="xCheck" data-xcheck={n}><summary><span><b>{t('inout.r_ck_h', { n })}</b> <span class="mute">{t('inout.r_ck_still')}</span></span><span class="xshow">{t('inout.r_ck_show')}</span></summary>
    <p class="mute">{t('inout.r_ck_click')}</p>
    {groups.map(([k, list, sheet]) => <div class="xgrp" data-group={k.slice(11)}><div class="xgt">{t(k, { n: list.length })}</div><ul>{list.map(o => item(o, sheet))}</ul></div>)}
  </details>;
}

// The names of who got theirs early (first four), and what the box does for them.
export function Early({ early, on }) {
  const b = state().batch, names = early.slice(0, 4).map(st => shownName(st, b.students.indexOf(st))).join(', ');
  return <p class="hint mute" data-xearly>{early.length > 4 ? t('inout.r_early_more', { names, n: early.length - 4 }) : t('inout.r_early_who', { names })} {t(on ? 'inout.r_early_untick' : 'inout.r_early_again')}</p>;
}

// What the options have on, so she needn't open them to know.
export function optsSay({ o, keep, sheet, dpi }) {
  const on = [[o.one, 'inout.r_on_one'], [keep, 'inout.r_on_folders'], [o.names, 'inout.r_on_names'], [sheet, 'inout.r_on_sheet'], [o.edit, 'inout.r_on_edit'], [o.key, 'inout.r_on_key'], [o.fb, 'inout.r_on_fb'], [o.all, 'inout.r_on_all'], [dpi > 150, 'inout.r_on_sharp']].filter(x => x[0]).map(x => t(x[1]));
  return t('inout.r_opts_say', { list: on.length ? on.join(', ') : t('inout.r_on_none') });
}

// How many files get a mark key, and the way to change what each mark means (Settings, Marking).
export function KeyHint({ p, onChange }) {
  const k = p.nKey, say = !k ? t('inout.r_key_none') : k === p.files ? (k === 1 ? t('inout.r_key_one') : t('inout.r_key_all', { n: k })) : t('inout.r_key_some', { n: k, of: p.files });
  return <p class="hint mute" data-xkeysay>{say} <button type="button" class="link" onClick={onChange} data-mkey>{t('inout.r_key_change')}</button></p>;
}

// The files an export left out and why. Stays until she closes it; with names hidden, the paper's number and not the file's name.
export function Fails({ failed, onClose }) {
  const b = state().batch, anon = anonOn();
  return <div class="xfails" id="xFails" role="alert"><b>{t('inout.r_fails', { n: failed.length })}</b>
    <ul>{failed.map(x => <li data-raw>{t('inout.r_fail_row', { who: anon && x.st ? shownName(x.st, b.students.indexOf(x.st)) : x.path, why: anon ? x.why.replace(/ \(.*$/s, '') : x.why })}</li>)}</ul>
    <Button size="sm" variant="quiet" onClick={onClose} data-xfailsclose>{t('common.close')}</Button></div>;
}

// Ask your assistant (optional): papers with names covered, marks only, and bringing its feedback back. Each opens Share at that step.
export function AskCard({ onShare, ai }) {   // ai: the assistant's name, from mark.jsx (services/assistant.js)
  ai = ai || t('assistant.generic');
  const row = (title, sub, k, label) => <div class="rtrow"><span><b>{title}</b><small class="mute">{sub}</small></span><Button size="sm" onClick={() => onShare(k)} data-rtask={k}>{label}</Button></div>;
  return <Card title={<>{t('inout.r_ai_h', { ai })} <span class="mute">{t('inout.r_ai_opt')}</span></>} id="rtClaude">
    {row(t('inout.r_ai_papers'), t('inout.r_ai_papers_s'), 'papers', t('paper.cc_title'))}
    {row(t('paper.sh_marks'), t('inout.r_ai_marks_s'), 'marks', t('inout.r_ai_marks_b'))}
    {row(t('inout.r_ai_back', { ai }), t('inout.r_ai_back_s'), 'back', t('inout.r_ai_back_b'))}
  </Card>;
}

// Pages flagged for a rescan, and Show, which lists them (the marking screen's Rescans list).
export function RescanCard({ list, onShow }) {
  if (!list.length) return null;
  const from = new Set(list.map(x => x.i)).size;
  return <Card title={t('inout.r_rs_h')} id="rtRescan"><div class="rtrow"><span><b>{t('inout.r_rs_n', { n: list.length })}</b><small class="mute">{t('inout.r_rs_from', { n: from })}</small></span>
    <Button size="sm" onClick={onShow} data-rtask="rescan">{t('inout.r_ck_show')}</Button></div></Card>;
}
