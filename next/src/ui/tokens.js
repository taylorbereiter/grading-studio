// The one token file: every colour, size, space, radius, shadow and motion the new app draws with. next/build.js turns it into
// next/dist/tokens.css; parts.css uses only var(--name). Taken from the approved design (Class First v2), with a few colours made
// darker so every text and control pair passes WCAG AA in all six themes (next/test/tokens.test.js proves it from PAIRS below).
//
// Rules held by the tests: red (pen) is for marks on papers only; check marks are green (ok); no sage or yellow-green anywhere;
// faint is never used for text; the theme is the teacher's choice and never follows the computer's light or dark setting.

import { LOOKS, DEFAULT_LOOK } from './looks.js';
export { LOOKS, DEFAULT_LOOK };

// Sizes that are the same in every theme.
export const SCALE = {
  // type: six sizes, no more
  t1: '12px', t2: '13px', t3: '14px', t4: '16px', t5: '22px', t6: '30px',
  // space (4 px steps)
  s1: '4px', s2: '8px', s3: '12px', s4: '16px', s5: '24px', s6: '32px', s7: '48px',
  // radius
  r1: '6px', r2: '8px', r3: '12px', r4: '14px', rf: '999px',
  // control heights
  h1: '24px', h2: '28px', h3: '32px', h4: '40px',
  // motion: 150 to 250 ms
  d1: '150ms', d: '170ms', d2: '200ms', d3: '250ms',
  ease: 'cubic-bezier(.2,.7,.2,1)', spring: 'cubic-bezier(.32,1.28,.52,1)',
  f: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
};

// Colours per theme. Every value a pair below names is an opaque hex, so the contrast test needs no guessing.
// hv and shc are "r,g,b" triples the lines and shadows are made from.
const light = {
  pen: '#C4302B', ok: '#1E7A4C', okFg: '#FFFFFF', okSoft: '#E6F4EC', warn: '#A35A00', white: '#FFFFFF',
  scrim: 'rgba(16,20,28,.22)',
};
export const THEMES = {
  graphite: { ...light, scheme: 'light',
    bg: '#F5F6F8', s: '#FFFFFF', s2: '#FAFBFC', sf: '#FFFFFF', sb: '#FFFFFF', segOn: '#FFFFFF',
    g50: '#F7F8FA', g100: '#F0F2F5', g150: '#E8EBEF', g200: '#DDE1E6', g300: '#C7CCD3', g400: '#A3AAB3', g500: '#7C838D', g600: '#5D646E', g700: '#424852', g800: '#2A2F36', g900: '#15181D',
    ink: '#15181D', ink2: '#424852', mute: '#636A74', faint: '#868D96', edge: '#7C838D',
    acc: '#3F4CC0', accH: '#3540A8', accP: '#2E3893', accSoft: '#EEF0FB', accInk: '#3440A6', accRing: 'rgba(63,76,192,.28)',
    inv: '#15181D', invFg: '#FFFFFF', hv: '17,24,39', shc: '16,24,40',
    cls: ['#6A4BC4', '#2F6FD0', '#12807A', '#2E8540', '#B5620E', '#C23B6E', '#7A5A3A', '#596273'] },
  porcelain: { ...light, scheme: 'light',
    bg: '#F8F7F5', s: '#FFFFFF', s2: '#FBFAF9', sf: '#FFFFFF', sb: '#FFFFFF', segOn: '#FFFFFF',
    g50: '#F9F8F6', g100: '#F2F1EE', g150: '#EAE8E4', g200: '#DFDCD7', g300: '#CAC6BF', g400: '#A7A29A', g500: '#807B73', g600: '#615C55', g700: '#46423C', g800: '#2E2B27', g900: '#181614',
    ink: '#191714', ink2: '#46423C', mute: '#6A655E', faint: '#8F8A82', edge: '#807B73',
    acc: '#1F5E6A', accH: '#194F59', accP: '#14424B', accSoft: '#EAF2F3', accInk: '#1B5560', accRing: 'rgba(31,94,106,.28)',
    inv: '#191714', invFg: '#FFFFFF', hv: '40,30,20', shc: '40,30,20',
    cls: ['#7A4FB0', '#2F6AB8', '#1B7D74', '#3A7F45', '#B05E14', '#B83F6A', '#7C5B3C', '#5E5A54'] },
  ocean: { ...light, scheme: 'light',
    bg: '#F4F7FA', s: '#FFFFFF', s2: '#F9FBFC', sf: '#FFFFFF', sb: '#FFFFFF', segOn: '#FFFFFF',
    g50: '#F6F8FA', g100: '#EEF2F6', g150: '#E5EAF0', g200: '#D9E0E8', g300: '#C2CBD5', g400: '#9DA8B5', g500: '#76828F', g600: '#58636F', g700: '#3E4853', g800: '#27303A', g900: '#141A21',
    ink: '#141A21', ink2: '#3E4853', mute: '#5F6A76', faint: '#86909B', edge: '#76828F',
    acc: '#1F6FB2', accH: '#1A5F99', accP: '#154F80', accSoft: '#EAF2FA', accInk: '#1A62A0', accRing: 'rgba(31,111,178,.28)',
    inv: '#141A21', invFg: '#FFFFFF', hv: '17,24,39', shc: '16,24,40',
    cls: ['#7048C0', '#1F6FB2', '#0F7F86', '#2E8540', '#B5620E', '#C23B6E', '#7A5A3A', '#56606C'] },
  ink: { ...light, scheme: 'light',
    bg: '#F7F7F7', s: '#FFFFFF', s2: '#FAFAFA', sf: '#FFFFFF', sb: '#FFFFFF', segOn: '#FFFFFF',
    g50: '#F8F8F8', g100: '#F1F1F1', g150: '#E8E8E8', g200: '#DCDCDC', g300: '#C6C6C6', g400: '#A2A2A2', g500: '#7B7B7B', g600: '#5C5C5C', g700: '#414141', g800: '#2A2A2A', g900: '#161616',
    ink: '#161616', ink2: '#414141', mute: '#666666', faint: '#8C8C8C', edge: '#7B7B7B',
    acc: '#1C1C1E', accH: '#333336', accP: '#000000', accSoft: '#F0F0F1', accInk: '#1C1C1E', accRing: 'rgba(0,0,0,.22)',
    inv: '#161616', invFg: '#FFFFFF', hv: '0,0,0', shc: '0,0,0',
    cls: ['#5B4A8A', '#3A5F8F', '#2D6E69', '#3D6B45', '#8F5A22', '#8F3D5A', '#6B5440', '#555555'] },
  plum: { ...light, scheme: 'light',
    bg: '#F6F6F7', s: '#FFFFFF', s2: '#FAFAFA', sf: '#FFFFFF', sb: '#FFFFFF', segOn: '#FFFFFF',
    g50: '#F8F7F8', g100: '#F1F0F2', g150: '#E8E7EA', g200: '#DCDADF', g300: '#C6C3CA', g400: '#A29FA7', g500: '#7C7882', g600: '#5E5A64', g700: '#433F49', g800: '#2C2931', g900: '#18161B',
    ink: '#18161B', ink2: '#433F49', mute: '#67636E', faint: '#8D8993', edge: '#7C7882',
    acc: '#6B3368', accH: '#5C2B59', accP: '#4D244A', accSoft: '#F4EEF3', accInk: '#66305F', accRing: 'rgba(107,51,104,.26)',
    inv: '#18161B', invFg: '#FFFFFF', hv: '24,22,27', shc: '24,22,27',
    cls: ['#4F5BC4', '#2A72B5', '#13807A', '#2E8540', '#B0600F', '#B8407A', '#7A5A3A', '#5E5A64'] },
  midnight: { scheme: 'dark',
    pen: '#C4302B', ok: '#4CC38A', okFg: '#0F1A14', okSoft: '#223531', warn: '#E5A04B', white: '#FFFFFF', scrim: 'rgba(0,0,0,.5)',
    bg: '#131518', s: '#1B1E22', s2: '#17191D', sf: '#24282E', sb: '#22262B', segOn: '#30343B',
    g50: '#1E2125', g100: '#25282D', g150: '#2B2F35', g200: '#33373E', g300: '#464B53', g400: '#5F656E', g500: '#7E848D', g600: '#9EA4AD', g700: '#BCC1C8', g800: '#D9DCE1', g900: '#ECEEF1',
    ink: '#ECEEF1', ink2: '#C5C9D0', mute: '#9CA2AC', faint: '#7A818B', edge: '#7E848D',
    acc: '#5865E8', accH: '#5562E0', accP: '#4A56D6', accSoft: '#272C43', accInk: '#A4AEFF', accRing: 'rgba(108,122,255,.35)',
    inv: '#E6E8EC', invFg: '#16181C', hv: '255,255,255', shc: '0,0,0',
    cls: ['#A08BF0', '#6FA3F5', '#4CC0B8', '#62C47A', '#E59A4B', '#F07AA5', '#C4A07E', '#A3ABB8'] },
};

// Every pair of colours the parts draw, with the least contrast it needs: 4.5 for text, 3 for icons, control edges and the focus ring.
// [foreground, background, minimum, what]. "white" is the text on a primary button.
export const PAIRS = [
  ...['bg', 's', 's2', 'sf', 'sb', 'g50', 'g100', 'g150'].flatMap(b => [['ink', b, 4.5, 'text'], ['ink2', b, 4.5, 'second text'], ['mute', b, 4.5, 'quiet text']]),
  ['ink', 'segOn', 4.5, 'segment on'], ['mute', 'g100', 4.5, 'segment off'],
  ['white', 'acc', 4.5, 'primary button'], ['white', 'accH', 4.5, 'primary hover'], ['white', 'accP', 4.5, 'primary pressed'],
  ['accInk', 'accSoft', 4.5, 'accent text on its tint'], ['accInk', 's', 4.5, 'accent text'], ['accInk', 'bg', 4.5, 'accent text on page'],
  ['invFg', 'inv', 4.5, 'toast and tooltip'],
  ['ok', 's', 4.5, 'done text'], ['ok', 'okSoft', 4.5, 'done text on its tint'], ['warn', 's', 4.5, 'warning text'], ['warn', 'bg', 4.5, 'warning on page'],
  ['pen', 'white', 4.5, 'a mark on a paper'],
  ['okFg', 'ok', 3, 'tick in a done check'],
  ...['bg', 's', 'sf'].flatMap(b => [['acc', b, 3, 'focus ring'], ['edge', b, 3, 'control edge'], ['faint', b, 3, 'icon'], ['g600', b, 3, 'icon in a button']]),
  ['acc', 's', 3, 'switch on'], ['edge', 'g100', 3, 'control edge on grey'],
];
// Tokens never used as text (the test checks parts.css): faint, edge, the g-scale but g600-g900, class colours.
export const NOT_TEXT = ['faint', 'edge', 'g50', 'g100', 'g150', 'g200', 'g300', 'g400', 'g500'];

const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
function vars(t) {
  const out = ['color-scheme:' + t.scheme];
  for (const [k, v] of Object.entries(t)) {
    if (k === 'scheme') continue;
    if (k === 'cls') { v.forEach((c, i) => out.push('--c' + (i + 1) + ':' + c)); continue; }
    out.push('--' + kebab(k) + ':' + v);
  }
  const dark = t.scheme === 'dark';
  out.push('--line:rgba(var(--hv),' + (dark ? '.07' : '.075') + ')', '--line-2:rgba(var(--hv),' + (dark ? '.11' : '.12') + ')', '--line-3:rgba(var(--hv),' + (dark ? '.17' : '.18') + ')');
  out.push(dark
    ? '--sh-r:0 0 0 1px var(--line),0 1px 2px rgba(0,0,0,.25);--sh-r2:0 0 0 1px var(--line-2),0 6px 16px -6px rgba(0,0,0,.5);--sh-f:0 0 0 1px rgba(255,255,255,.09),0 24px 60px -12px rgba(0,0,0,.65);--sh-btn:0 0 0 1px var(--line-2),inset 0 1px 0 rgba(255,255,255,.05)'
    : '--sh-r:0 0 0 1px var(--line),0 1px 2px rgba(var(--shc),.04),0 2px 6px -2px rgba(var(--shc),.04);--sh-r2:0 0 0 1px var(--line-2),0 2px 4px rgba(var(--shc),.05),0 8px 20px -6px rgba(var(--shc),.09);--sh-f:0 0 0 1px rgba(var(--shc),.08),0 4px 10px -2px rgba(var(--shc),.07),0 22px 48px -12px rgba(var(--shc),.22);--sh-btn:0 0 0 1px var(--line-2),0 1px 1.5px rgba(var(--shc),.06),inset 0 1px 0 rgba(255,255,255,.7)');
  return out.join(';');
}
// The stylesheet: the scale and Graphite on :root, then each theme on html[data-look=...]. Nothing reads the computer's own light or dark setting.
export function css() {
  const scale = Object.entries(SCALE).map(([k, v]) => '--' + k + ':' + v).join(';');
  return ':root{' + scale + ';' + vars(THEMES[DEFAULT_LOOK]) + '}\n' +
    LOOKS.map(n => 'html[data-look="' + n + '"]{' + vars(THEMES[n]) + '}').join('\n') +
    '\n@media (prefers-reduced-motion:reduce){:root{--d1:0ms;--d:0ms;--d2:0ms;--d3:0ms}}\nhtml.still{--d1:0ms;--d:0ms;--d2:0ms;--d3:0ms}\n';
}
