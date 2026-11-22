// Settings > Grading: Terms and weights and the rubric bank (src/settings.js #setTerms, #setGrading). The terms with their dates,
// what each type counts for, what an empty type does, where extra credit goes and whether a grade can pass 100%, for all classes,
// with Term setup (the gradebook's own sheet, bookedit.jsx SetupSheet, one undo step) once a class has a roster. Then how many
// rubrics and grading scales the bank holds, with Open the rubric bank (Library > Rubrics). Nothing here saves on its own.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Button } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import { useBook } from './data.js';
import { engine as B, conf as confOf } from '../../students/book.js';
import { readBank } from '../../students/bank.js';
import { SetupSheet } from './bookedit.jsx';
import { typeName } from './grades.jsx';
import './lines.js';

export function TermsCard() {
  const b = useBook(), [open, setOpen] = useState(false);
  if (!b || b.error) return null;
  const conf = confOf(b.lib), has = (b.lib.classes || []).some(c => (c.names || []).length);
  const types = B.bkCats().map(([id, , own]) => typeName(id, own) + ' ' + (+conf.w[id] || 0) + '%').join(' · ');
  const xc = conf.xcTo === 'ic' ? t('class.xc_ic', { type: typeName('ic', (B.bkCats().find(y => y[0] === 'ic') || [])[2]) }) : t('class.xc_term');
  return <Card title={t('class.st_terms_h')} data-stterms>
    <p class="mute">{t('class.st_terms_about')}</p>
    {conf.terms.length ? <ul class="sv-list">{conf.terms.map(x => <li data-stterm><b data-raw>{x.name || t('class.terms')}</b>
      <span class="mute">{x.start && x.end ? t('class.st_dates', { a: B.bkDay(x.start), b: B.bkDay(x.end) }) : t('class.st_nodates')}</span></li>)}</ul>
      : <p class="hint" data-stterms-none>{t('class.st_none')}</p>}
    <dl class="st-dl">
      <dt>{t('class.types_w')}</dt><dd data-raw data-stweights>{types}</dd>
      <dt>{t('class.empty_t')}</dt><dd>{t(conf.empty === 'zero' ? 'class.empty_zero' : 'class.empty_other')}</dd>
      <dt>{t('class.xc_new')}</dt><dd>{xc}</dd>
      <dt>{t('class.above_100')}</dt><dd>{t(conf.xcCap ? 'class.cap' : 'class.over')}</dd>
    </dl>
    <Button variant="primary" disabled={!has} title={has ? undefined : t('class.st_needs')} onClick={() => setOpen(true)} data-stterms-open>{t('class.setup_title')}</Button>
    {!has && <p class="mute small">{t('class.st_needs')}</p>}
    {open && <SetupSheet conf={conf} book={b.lib.book} onClose={() => setOpen(false)} />}
  </Card>;
}
export function BankCard() {
  const [n, setN] = useState(null);
  useEffect(() => { readBank().then(k => setN({ r: k.rubrics.length, s: k.scales.length }), e => { console.error(e); setN({ fail: true }); }); }, []);
  return <Card title={t('class.st_bank_h')} data-stbank>
    <p class="mute">{t('class.st_bank_about')}</p>
    {n && !n.fail && <p data-stbank-n>{t('class.st_bank_have', { r: t('class.st_bank_r', { n: n.r }), s: t('class.st_bank_s', { n: n.s }) })}</p>}
    <a class="btn" href={href('library', 'rubrics')} data-stbank-open>{t('class.st_bank_open')}</a>
  </Card>;
}
