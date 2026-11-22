// This address is moving (src/moving.js moveCard, moveSteps, moveAsk): saved work belongs to the address it was made at, so a new
// address opens empty. site.json names where this copy lives (address) and, while a move is on, where it is going (movingTo);
// build.js puts both in as __GS_MOVE__. Only the copy at the address being left says anything: a card at the top of Settings >
// Saving, and once a day, to someone with work here, a box with Later, Open the new address and Take my work with me.
import { h, render, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Card, Button, Dialog } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { useSaving } from '../../services/saving.js';
import { Take } from './carry.jsx';
import './lines.js';

const origin = s => { try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.origin : ''; } catch { return ''; } };
// The address it is moving to, or '' (window.__gsMove stands in for site.json in tests).
export function movingTo() {
  const M = (typeof window !== 'undefined' && window.__gsMove) || (typeof __GS_MOVE__ !== 'undefined' ? __GS_MOVE__ : null);
  const from = origin(M && M.address), to = origin(M && M.movingTo);
  return to && from && from !== to && location.origin === from ? M.movingTo : '';
}
function Steps({ to }) {
  const [a, b] = t('saving.mv_to', { to: '\u0001' }).split('\u0001');
  return <>
    <p>{a}<a href={to} target="_blank" rel="noopener" data-raw data-mvto><b>{to}</b></a>{b} {t('saving.mv_stays')}</p>
    <ol><li>{t('saving.mv_s1')}</li><li>{t('saving.mv_s2')}</li><li>{t('saving.mv_s3')}</li></ol>
    <p class="mute">{t('saving.mv_soon')}</p>
  </>;
}
export function MoveCard() {
  const S = useSaving(), [take, setTake] = useState(false), to = movingTo();
  if (!to || !S) return null;
  return <Card title={t('saving.mv_h')} data-svmove>
    <Steps to={to} />
    <Button variant="primary" onClick={() => setTake(true)} data-mvtake>{t('saving.take')}</Button>
    {take && <Take S={S} onClose={() => setTake(false)} />}
  </Card>;
}
function Ask({ to, close }) {
  const S = useSaving(), [take, setTake] = useState(false);
  if (take && S) return <Take S={S} onClose={close} />;
  return <Dialog open title={t('saving.mv_h')} onClose={close} actions={<>
    <Button onClick={close} data-mvlater>{t('saving.mv_later')}</Button>
    <a class="btn" href={to} target="_blank" rel="noopener" onClick={close} data-mvopen>{t('saving.mv_open')}</a>
    <Button variant="primary" onClick={() => setTake(true)} data-mvtake>{t('saving.take')}</Button></>}>
    <div data-mvask><Steps to={to} /></div>
  </Dialog>;
}
const today = () => new Date().toDateString();
// Once a day, while nothing else is open (the welcome, another box). whole/later.js calls it for someone with work here.
export function moveAsk() {
  const to = movingTo(); if (!to || document.querySelector('[data-welcome], dialog[open]')) return false;
  try { if (localStorage.getItem('gsc.moveSeen') === today()) return false; localStorage.setItem('gsc.moveSeen', today()); } catch { }
  const box = document.createElement('div'); document.body.appendChild(box);
  render(h(Ask, { to, close: () => { render(null, box); box.remove(); } }), box);
  return true;
}
