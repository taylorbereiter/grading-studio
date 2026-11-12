/* ================= Planner: slide looks and teaching layouts =================
   A look is a lesson's colors and background. A teaching layout (warm-up, steps, discussion question...)
   is a set of boxes in slide units (1280 x 720). The same boxes draw the slide in the editor and in the
   .pptx, so what the teacher sees is what PowerPoint shows. Text stays between 28 and 36 pt; the only
   smaller text is a picture's source line. */

// bg, text, accent, title color, serif titles, rule under the title, and drawn extras.
const LOOKS = {
  wood: { name: 'Gray + wood', bg: '#DFDBD5', text: '#000000', accent: '#B71E42', rule: 1, caps: 1 },
  white: { name: 'Plain White', bg: '#FFFFFF', text: '#000000', accent: '#1F3A5F', rule: 1 },
  cream: { name: 'Soft Cream', bg: '#FBF6EC', text: '#3A2E22', accent: '#A0522D', rule: 1, serif: 1 },
  sage: { name: 'Sage', bg: '#EEF3EC', text: '#1F2D24', accent: '#3E7A55', rule: 1 },
  sky: { name: 'Sky', bg: '#EAF3FB', text: '#14283D', accent: '#2B6CB0', rule: 1 },
  blush: { name: 'Blush', bg: '#FBEFF1', text: '#3A1F2A', accent: '#8E3B5E', rule: 1 },
  charcoal: { name: 'Charcoal', bg: '#2B2D30', text: '#F2F2F2', accent: '#F2C14E', rule: 1, dark: 1 },
  navy: { name: 'Navy Night', bg: '#152238', text: '#F4F1EA', accent: '#F08A6C', rule: 1, dark: 1 },
  stripe: { name: 'Side Stripe', bg: '#FFFFFF', text: '#000000', accent: '#2F7D6D', deco: 'stripe' },
  band: { name: 'Top Band', bg: '#FFFFFF', text: '#000000', accent: '#3B5BA9', title: '#FFFFFF', deco: 'band' },
  bigtype: { name: 'Big Type', bg: '#FFFFFF', text: '#111111', accent: '#111111', heavy: 1 },
  framed: { name: 'Framed Paper', bg: '#F3F3F1', text: '#000000', accent: '#5A5A5A', rule: 1, deco: 'frame' },
  notebook: { name: 'Notebook', bg: '#FDFCF7', text: '#1B2430', accent: '#2D5F8B', serif: 1, deco: 'notebook' },
  chalk: { name: 'Chalkboard', bg: '#2F3B33', text: '#F3F1E8', accent: '#E9D78A', rule: 1, dark: 1, deco: 'chalk' }
};
// 'wood' is the teacher's own slide template, colors and all. With no template of their own, a lesson is Plain White instead.
const lookOf = l => { const k = LOOKS[l && l.look] ? l.look : (LOOKS[L.defLook] ? L.defLook : 'wood'); return k === 'wood' && !ownTpl() ? 'white' : k; };
const lookVars = k => { const o = LOOKS[k]; return '--lbg:' + o.bg + ';--lt:' + o.text + ';--la:' + o.accent + ';--ltt:' + (o.title || o.text); };

// Shapes drawn behind the text, in slide units: [x, y, w, h, fill, line] (line = [color, px] for an outline).
function lookShapes(k, titleSlide) {
  const o = LOOKS[k], out = [];
  if (o.deco === 'stripe') out.push([0, 0, 60, 720, o.accent]);
  if (o.deco === 'band' && !titleSlide) out.push([0, 0, 1280, 205, o.accent]);
  if (o.deco === 'band' && titleSlide) out.push([0, 0, 1280, 360, o.accent]);
  if (o.deco === 'frame') out.push([26, 26, 1228, 668, null, ['#9A9A96', 3]]);
  if (o.deco === 'notebook') { for (let y = 96; y < 720; y += 48) out.push([0, y, 1280, 2, '#B9D3EA']); out.push([120, 0, 3, 720, '#E8A0A0']); }
  if (o.deco === 'chalk') out.push([0, 0, 1280, 22, '#6B4A2E'], [0, 698, 1280, 22, '#6B4A2E'], [0, 0, 22, 720, '#6B4A2E'], [1258, 0, 22, 720, '#6B4A2E']);
  if (o.rule && k !== 'wood') out.push(titleSlide ? [254, 369, 907, 4, o.accent] : [153, 192, 1009, 4, o.accent]);
  return out;
}

/* ---------- teaching layouts ---------- */
// Extra text a teaching layout keeps on a slide, besides title and body.
const EXTRA = ['tag', 'foot', 'h1', 'h2', 'body2', 'cite', 'word', 'pos'];
// Each teaching layout's text size. A new slide starts empty: the gray hints show what goes where, and nothing
// is typed in for her (no titles, no bullets, no numbers) until she does it.
const TEACH = {
  warmup: { size: 36 }, objectives: { size: 32 }, steps: { size: 32 }, discuss: { size: 36 }, twocol: { size: 28 },
  passage: { size: 30 }, picprompt: { size: 28 }, textpic: { size: 28 }, vocab: { size: 32 }, exit: { size: 36 }
};
const TITLE_PH = { agenda: 'Agenda', objectives: 'Today we will', warmup: 'Warm-up', steps: 'Directions', discuss: 'Let’s talk', passage: 'Close read', picprompt: 'See · Think · Wonder', vocab: 'Word of the day', exit: 'Exit ticket' };
const BODY_PH = { agenda: 'What you’ll do today, one line each', objectives: 'Your objectives, one line each', content: 'Click to add text', text: 'Click to add text' };
// Example text for the Add slide picker only; the picture is a plain gray stand-in.
const SAMPLE_PIC = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#C9C4BC"/><path d="M20 85 L60 40 L90 70 L110 55 L140 85 Z" fill="#A39C91"/><circle cx="115" cy="28" r="10" fill="#A39C91"/></svg>');
const TEACH_SAMPLE = {
  warmup: { title: 'Warm-up', tag: 'Journal', body: 'Think of an ad that made you want something you didn’t need. What did it do?' },
  title: { title: 'Lesson name', body: 'Course\nTuesday, November 3' },
  agenda: { title: '11/3 Agenda', body: 'Warm-up\nRead together\nGroup work\nReview' },
  objectives: { title: 'Today we will', body: 'Name the three appeals in a short ad\nExplain how one appeal works on its audience' },
  steps: { title: 'Directions', body: 'Visit each poster with your group\nLeave one sticky note: the appeal you see\nBack at your seat, pick the strongest one', foot: 'When you’re done: be ready to say why.' },
  discuss: { title: 'Let’s talk', foot: 'Think on your own · Talk with a partner · Share with the class', body: 'Is the main character a hero, or a warning?' },
  content: { title: 'Slide title', body: 'A point\n\tA smaller point\nAnother point' },
  twocol: { title: 'Logos vs. pathos', h1: 'Logos', h2: 'Pathos', body: 'Facts and numbers\n“Studies show…”', body2: 'Feelings and stories\n“Imagine if…”' },
  text: { title: 'Plain text', body: 'A paragraph of plain text, with no bullets.' },
  passage: { title: 'Close read', body: '“A short passage from the text goes here, in quotation marks.”', cite: 'Author, Title, page', foot: 'What does this show about the speaker?' },
  picture: { title: 'Picture', img: { src: SAMPLE_PIC, w: 16, h: 10 } },
  fullpic: { title: 'Full picture', img: { src: SAMPLE_PIC, w: 16, h: 10 } },
  textpic: { title: 'Text + picture', body: 'What the picture shows\nWhy it matters here', img: { src: SAMPLE_PIC, w: 16, h: 10 } },
  picprompt: { title: 'See · Think · Wonder', body: 'What do you see?\nWhat do you think is happening?\nWhat do you wonder?', img: { src: SAMPLE_PIC, w: 16, h: 10 } },
  vocab: { title: 'Word of the day', word: 'ethos', pos: 'noun', body: 'Trust in the speaker: why we should believe them.', foot: '“As a doctor for 20 years, I can tell you…”' },
  video: { title: 'Video' },
  exit: { title: 'Exit ticket', tag: 'On a sticky note', body: 'Which appeal was strongest today, and what’s one detail that shows it?' }
};
const isTeach = s => !!TEACH[s.layout] && s.layout !== 'objectives';

// The boxes of a teaching layout. sz in pt; col is 'text', 'accent' or 'muted'.
function teachBoxes(s) {
  const z = s.size, B = (k, x, y, w, h, o) => ({ k, x, y, w, h, sz: z, col: 'text', ...o });
  switch (s.layout) {
    case 'warmup': case 'exit': return [
      B('tag', 152, 214, 1008, 48, { sz: 28, b: 1, caps: 1, col: 'accent', ph: s.layout === 'exit' ? 'Where they answer' : 'Kind of warm-up' }),
      B('body', 152, 276, 1008, 350, { ph: s.layout === 'exit' ? 'The exit question' : 'The warm-up prompt' })];
    case 'steps': return [
      B('body', 152, 214, 1008, 330, { list: 'num', gap: 10, ph: 'One step per line' }),
      B('foot', 152, 560, 1008, 76, { sz: 28, col: 'muted', ph: 'What to do when they’re done' })];
    case 'discuss': return [
      B('body', 192, 236, 928, 270, { algn: 'ctr', anchor: 'ctr', b: 1, ph: 'The question' }),
      B('foot', 152, 530, 1008, 96, { sz: 28, algn: 'ctr', col: 'muted', ph: 'How they talk about it' })];
    case 'twocol': return [
      B('h1', 152, 214, 484, 48, { sz: 28, b: 1, ph: 'Left heading' }), B('h2', 676, 214, 484, 48, { sz: 28, b: 1, ph: 'Right heading' }),
      B('body', 152, 280, 484, 350, { list: 'bullet', gap: 8, ph: 'Left side, one point per line' }),
      B('body2', 676, 280, 484, 350, { list: 'bullet', gap: 8, ph: 'Right side, one point per line' })];
    case 'passage': return [
      B('body', 186, 214, 974, 262, { serif: 1, gap: 8, ph: 'Paste the passage' }),
      B('cite', 186, 482, 974, 46, { sz: 28, col: 'muted', ph: 'Author, title, page' }),
      B('foot', 152, 540, 1008, 90, { sz: 28, ph: 'The question to read for' })];
    case 'picprompt': return [
      B('body', 712, 214, 448, 410, { list: 'bullet', gap: 10, ph: 'Questions, one per line' })];
    case 'textpic': return [
      B('body', 152, 214, 448, 410, { gap: 10, ph: 'Click to add text' })];
    case 'vocab': return [
      B('word', 152, 214, 1008, 62, { sz: 36, b: 1, ph: 'The word' }),
      B('pos', 152, 282, 1008, 46, { sz: 28, i: 1, col: 'accent', ph: 'Part of speech' }),
      B('body', 152, 344, 1008, 150, { ph: 'What it means' }),
      B('foot', 152, 506, 1008, 120, { sz: 28, i: 1, col: 'muted', ph: 'An example sentence' })];
  }
  return [];
}
// Shapes a teaching layout draws: rules under the two headings, the bar beside a passage.
function teachShapes(s, look) {
  const a = LOOKS[look].accent;
  if (s.layout === 'twocol') return [[152, 266, 484, 3, a], [676, 266, 484, 3, a]];
  if (s.layout === 'passage') return [[152, 214, 8, 262, a]];
  return [];
}
// Where a layout that has text and a picture puts the picture; its source line goes under it.
const PICBOX = { x: 152, y: 214, w: 520, h: 384 }, PICBOX_R = { x: 640, y: 214, w: 520, h: 384 };
const picBox = s => s.layout === 'picprompt' ? PICBOX : s.layout === 'textpic' ? PICBOX_R : null;
// The layouts that show a slide's picture. Full picture has no title on the slide: the picture is the slide.
const hasPic = s => s.layout === 'picture' || s.layout === 'fullpic' || !!picBox(s);
const FULLPIC = { x: 0, y: 0, w: 1280, h: 692 };
const lineList = t => String(t || '').split('\n').map(x => x.replace(/^\s+/, '')).filter(Boolean);
const fieldOf = (s, k) => k === 'title' ? s.title : String(s[k] || '');

function teachHtml(s, edit, look) {
  let h = '';
  for (const [x, y, w, hh, fill] of teachShapes(s, look)) h += '<div class="ls-shape" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + hh + 'px;background:' + fill + '"></div>';
  const P = picBox(s);
  if (P) {
    h += '<div class="ls-pic' + (edit ? ' ls-ed' : '') + '" data-k="img" style="left:' + P.x + 'px;top:' + P.y + 'px;width:' + P.w + 'px;height:' + P.h + 'px">' + (s.img ? '<img src="' + esc(imgSrc(s.img.src)) + '" alt="">' : edit ? '<span class="ls-ph">Click to add a picture</span>' : '') + '</div>';
    h += '<div class="ls-src' + (edit ? ' ls-ed' : '') + '" data-k="source" style="left:' + P.x + 'px;top:' + (P.y + P.h + 6) + 'px;width:' + P.w + 'px"' + (edit ? ' tabindex="0"' : '') + '>' + (s.img && s.img.source ? esc(s.img.source) : edit && s.img ? '<span class="ls-ph">Add the source line</span>' : '') + '</div>';
  }
  for (const b of teachBoxes(s)) {
    const v = fieldOf(s, b.k), lines = v.split('\n');
    const st = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;font-size:' + (b.sz * PT).toFixed(1) + 'px;text-align:' + (b.algn === 'ctr' ? 'center' : 'left') + ';justify-content:' + (b.anchor === 'ctr' ? 'center' : 'flex-start') +
      (b.b ? ';font-weight:700' : '') + (b.i ? ';font-style:italic' : '') + (b.caps ? ';text-transform:uppercase' : '') + (b.serif ? ';font-family:Georgia,serif' : '') + ';color:var(--' + (b.col === 'accent' ? 'la' : 'lt') + ')' + (b.col === 'muted' ? ';opacity:.78' : '') + ';--gap:' + ((b.gap || 0) * PT).toFixed(1) + 'px';
    let inner = '';
    if (!v.trim()) inner = edit ? '<span class="ls-ph">' + esc(b.ph || 'Click to add text') + '</span>' : '';
    else if (RT_KEYS.includes(b.k)) inner = rtHtml(v);
    else inner = lines.map(x => '<p>' + (esc(x) || '&nbsp;') + '</p>').join('');
    h += '<div class="ls-bx' + (edit ? ' ls-ed' : '') + '" data-k="' + b.k + '" style="' + st + '"' + (edit ? ' tabindex="0"' : '') + '>' + inner + '</div>';
  }
  return h;
}

/* ---------- .pptx pieces ---------- */
// One slide unit in EMU, set from the template's slide size (9525 for a 13.33 x 7.5 in slide).
let EX = 9525, EY = 9525;
const hex = c => String(c).replace('#', '').toUpperCase();
const fillX = c => '<a:solidFill><a:srgbClr val="' + hex(c) + '"/></a:solidFill>';
function shapeXml(id, [x, y, w, h, fill, line]) {
  return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Shape ' + id + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + Math.round(x * EX) + '" y="' + Math.round(y * EY) + '"/><a:ext cx="' + Math.round(w * EX) + '" cy="' + Math.round(h * EY) + '"/></a:xfrm><a:prstGeom prst="' + (line ? 'roundRect' : 'rect') + '"><a:avLst>' + (line ? '<a:gd name="adj" fmla="val 1200"/>' : '') + '</a:avLst></a:prstGeom>' +
    (fill ? fillX(fill) : '<a:noFill/>') + (line ? '<a:ln w="' + Math.round(line[1] * EX) + '">' + fillX(line[0]) + '</a:ln>' : '<a:ln><a:noFill/></a:ln>') + '</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>';
}
// A run with the look's colors. o: { col, b, i, caps, serif, title }
function lookRun(t, sz, o, look) {
  const L0 = LOOKS[look], c = RT_COLORS[o.c] ? RT_COLORS[o.c] : o.title ? (L0.title || L0.text) : o.col === 'accent' ? L0.accent : o.col === 'muted' ? mix(L0.text, L0.bg, .78) : L0.text;
  const font = o.serif || (o.title && L0.serif) ? '<a:latin typeface="Georgia"/>' : '';
  return '<a:r><a:rPr lang="en-US"' + (sz ? ' sz="' + Math.round(sz * 100) + '"' : '') + (o.b || (o.title && !L0.serif && !L0.caps) ? ' b="1"' : '') + (o.i ? ' i="1"' : '') + (o.u ? ' u="sng"' : '') + (o.caps ? ' cap="all"' : (o.title || o.sub) && !L0.caps ? ' cap="none"' : '') + ' dirty="0">' + fillX(c) + font + '</a:rPr><a:t>' + xe(t) + '</a:t></a:r>';
}
// The muted color: the text color moved toward the background, as the editor shows it with opacity.
function mix(a, b, k) { const p = c => [1, 3, 5].map(i => parseInt(hex(c).slice(i - 1, i + 1), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v * k + y[i] * (1 - k)).toString(16).padStart(2, '0')).join(''); }
function teachBoxXml(id, b, s, look) {
  const v = fieldOf(s, b.k), lines = v.split('\n'), acc = hex(LOOKS[look].accent);
  const mar = Math.round((b.list === 'num' ? 1.45 : .86) * b.sz * 12700);
  const ps = RT_KEYS.includes(b.k) && v.trim() ? rtParasXml(v, { sz: b.sz, algn: b.algn === 'ctr' ? 'ctr' : '', lvlMar: Math.round(1.6 * b.sz * 12700), bulMar: Math.round(.86 * b.sz * 12700), numMar: Math.round(1.45 * b.sz * 12700), gap: b.gap || 0, buClr: '<a:buClr><a:srgbClr val="' + acc + '"/></a:buClr>', runFn: (t, f) => lookRun(t, b.sz, { ...b, b: b.b || f.b, i: b.i || f.i, u: f.u, c: f.c }, look) }) : (v.trim() ? lines : ['']).map((x, i) => {
    let pPr = '<a:pPr' + (b.algn === 'ctr' ? ' algn="ctr"' : '') + (b.list ? ' marL="' + mar + '" indent="-' + mar + '"' : ' marL="0" indent="0"') + '>' + (i && b.gap ? '<a:spcBef><a:spcPts val="' + Math.round(b.gap * 100) + '"/></a:spcBef>' : '<a:spcBef><a:spcPts val="0"/></a:spcBef>');
    pPr += b.list ? '<a:buClr><a:srgbClr val="' + acc + '"/></a:buClr>' + (b.list === 'num' ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : '<a:buFont typeface="Arial"/><a:buChar char="•"/>') : '<a:buNone/>';
    return '<a:p>' + pPr + '</a:pPr>' + (x ? lookRun(x, b.sz, b, look) : '<a:endParaRPr lang="en-US" sz="' + b.sz * 100 + '"/>') + '</a:p>';
  }).join('');
  return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Text ' + id + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + Math.round(b.x * EX) + '" y="' + Math.round(b.y * EY) + '"/><a:ext cx="' + Math.round(b.w * EX) + '" cy="' + Math.round(b.h * EY) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
    '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="' + (b.anchor === 'ctr' ? 'ctr' : 't') + '"><a:noAutofit/></a:bodyPr><a:lstStyle/>' + ps + '</p:txBody></p:sp>';
}
// A picture fitted in a box without changing its shape, whatever the shape of the template's slide. Slide units in and out.
function picFit(img, B, valign) {
  const r = Math.min(B.w * EX / img.w, B.h * EY / img.h), w = img.w * r / EX, h = img.h * r / EY;
  return { x: B.x + (B.w - w) / 2, y: valign === 'top' ? B.y : B.y + (B.h - h) / 2, w, h };
}
function picXml(id, f) {
  return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="Picture"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + Math.round(f.x * EX) + '" y="' + Math.round(f.y * EY) + '"/><a:ext cx="' + Math.round(f.w * EX) + '" cy="' + Math.round(f.h * EY) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
}
// Everything a teaching layout adds under the title, from shape id 10 up.
function teachXml(s, look, media) {
  let t = '', id = 10;
  for (const sh of teachShapes(s, look)) t += shapeXml(id++, sh);
  const P = picBox(s);
  if (P && s.img && media) {
    const f = picFit(s.img, P, 'top');
    t += picXml(id++, f);
    if (s.img.source) t += teachBoxXml(id++, { k: '_src', x: P.x, y: f.y + f.h + 6, w: P.w, h: 22, sz: 10, col: 'text', algn: 'ctr' }, { _src: s.img.source }, look);
  }
  for (const b of teachBoxes(s)) t += teachBoxXml(id++, b, s, look);
  return t;
}
// A slide's background and drawn extras for a look other than the template's own.
function lookBgXml(look) { return '<p:bg><p:bgPr>' + fillX(LOOKS[look].bg) + '<a:effectLst/></p:bgPr></p:bg>'; }
function lookShapesXml(look, titleSlide) { return lookShapes(look, titleSlide).map((sh, i) => shapeXml(40 + i, sh)).join(''); }

/* ---------- the Look picker and the Add slide picker ---------- */
function miniSlide(s, l, look, w) {
  const k = w / 1280;
  return '<div class="pl-lmini" style="width:' + w + 'px;height:' + (720 * k) + 'px"><div class="ls-slide" style="transform:scale(' + k + ')">' + slideHtml(s, { ...l, look }, false) + '</div></div>';
}
function lookDlg() {
  const l = L.open; if (!l) return;
  const s = l.slides[L.cur], cur = lookOf(l);
  openDlg('<div class="bh"><h2>Look</h2></div><div class="bb"><p class="muted" style="margin-top:0">Colors and background for every slide in this lesson. The layouts and your text stay the same.</p><div class="pl-looks">' +
    Object.entries(LOOKS).filter(([k]) => k !== 'wood' || ownTpl()).map(([k, o]) => '<button class="pl-look' + (k === cur ? ' on' : '') + '" data-look="' + k + '">' + miniSlide(s, l, k, 164) + '<span>' + esc(o.name) + (k === 'wood' ? ' (your template)' : '') + '</span></button>').join('') +
    '</div><label class="pl-lmine"><input type="checkbox" id="lkDef"' + (L.defLook === cur ? ' checked' : '') + '> Use this look for new lessons too</label></div><div class="bf"><button class="btn" data-x>Close</button></div>');
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    const b = e.target.closest('[data-look]'); if (!b) return;
    l.look = b.dataset.look;
    if ($('#lkDef').checked) { L.defLook = l.look; await kvSet('deflook', l.look); }
    for (const x of document.querySelectorAll('.pl-look')) x.classList.toggle('on', x === b);
    lessonChanged(false); renderEditor(); toast('Look: ' + LOOKS[l.look].name);
  };
  $('#dlgBox').onchange = async e => { if (e.target.id === 'lkDef') { L.defLook = e.target.checked ? lookOf(l) : ''; await kvSet('deflook', L.defLook); } };
}
const LAYOUT_GROUPS = [['Start and end', ['title', 'agenda', 'objectives', 'warmup', 'exit']], ['Teach and practice', ['steps', 'discuss', 'content', 'twocol', 'text', 'passage', 'vocab']], ['Pictures and video', ['picture', 'fullpic', 'textpic', 'picprompt', 'video']]];
// The layout picker: a picture of every layout in the lesson's look. 'add' puts a new slide after this one; 'change' changes this one.
function addSlideDlg(mode) {
  const l = L.open; if (!l) return;
  const change = mode === 'change', cur = l.slides[L.cur];
  openDlg('<div class="bh"><h2>' + (change ? 'Layout for this slide' : 'Add a slide') + '</h2></div><div class="bb">' + (change ? '<p class="muted" style="margin-top:0">Your text stays. Any new boxes start empty, with a gray hint of what goes there.</p>' : '') + LAYOUT_GROUPS.map(([g, ks]) => '<h3 class="pl-h3">' + g + '</h3><div class="pl-looks">' +
    ks.map(k => '<button class="pl-look' + (change && k === cur.layout ? ' on' : '') + '" data-addslide="' + k + '">' + miniSlide(normSlide({ layout: k, size: (TEACH[k] || {}).size, ...(TEACH_SAMPLE[k] || {}) }), l, lookOf(l), 164) + '<span>' + esc(LAYOUTS[k]) + '</span></button>').join('') + '</div>').join('') +
    '</div><div class="bf"><button class="btn" data-x>Cancel</button></div>');
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    const b = e.target.closest('[data-addslide]'); if (!b) return;
    closeDlg();
    if (!change) return newSlide(b.dataset.addslide);
    const k = b.dataset.addslide, s = l.slides[L.cur];
    s.layout = k;
    lessonChanged(); renderEditor();
  };
}
