// Made-up scans, drawn in the browser so they go through the same pixels as a real one: typed and handwritten pages,
// worksheets, tables, charts, Chinese, turned, crooked, faint and speckled. Every word is invented. window.gsScan.* runs inside the page.
const PAGE_SRC = `(() => {
  const WORDS = ('the river in this story stands for time and the narrator returns to it whenever a choice has to be made which shows how quickly people forget what they promised before the flood came through the valley during that long and difficult summer my grandmother kept a garden behind our house where she taught me why patience matters more than being right although nobody believed her at first everything changed when the school opened again by the bridge').split(' ');
  const CJK = '河流在這個故事裡代表時間每當需要做出選擇敘述者總會回到河邊夏天的洪水帶走了村子但是祖母的花園還在那裡她教我耐心比什麼都重要學校重新開學以後大家才慢慢相信';
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const sentence = (r, n) => { const a = []; for (let i = 0; i < n; i++) a.push(WORDS[Math.floor(r() * WORDS.length)]); a[0] = a[0][0].toUpperCase() + a[0].slice(1); return a.join(' ') + '.'; };
  const blankPage = (W = 1020, H = 1320) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#111'; x.strokeStyle = '#111'; x.textBaseline = 'alphabetic'; return { c, x, W, H }; };
  function typed(r, { font = 'Georgia, serif', size = 19, pitch = 30, cols = 1, justify = false, lines = 34, title = true, indent = true, upper = false } = {}) {
    const { c, x, W } = blankPage(), mx = 110, gap = 40, cw = (W - 2 * mx - (cols - 1) * gap) / cols;
    x.font = size + 'px ' + font;
    let y = 130;
    if (title) { x.font = 'bold ' + (size + 7) + 'px ' + font; x.fillText('A Short Paper On ' + WORDS[3] + ' And Time', mx, y); x.font = size + 'px ' + font; y += 50; }
    const top = y;
    for (let col = 0; col < cols; col++) {
      y = top; let left = lines, firstLine = true;
      while (left > 0 && y < 1240) {
        const para = (upper ? sentence(r, 25 + Math.floor(r() * 45)).toUpperCase() : sentence(r, 25 + Math.floor(r() * 45))).split(' '); let line = [], lead = indent && firstLine ? 30 : 0;
        for (let i = 0; i <= para.length && left > 0 && y < 1240; i++) {
          const test = line.concat(para[i] || '').join(' ');
          if (i < para.length && x.measureText(test).width + lead < cw) { line.push(para[i]); continue; }
          const X = mx + col * (cw + gap) + lead;
          if (justify && i < para.length && line.length > 1) { const tw = line.reduce((a, w) => a + x.measureText(w).width, 0), sp = (cw - lead - tw) / (line.length - 1); let px = X; for (const w of line) { x.fillText(w, px, y); px += x.measureText(w).width + sp; } }
          else x.fillText(line.join(' '), X, y);
          y += pitch; left--; line = para[i] ? [para[i]] : []; lead = 0; firstLine = false;
        }
        firstLine = true;
        if (cols === 1 && r() < .3) y += pitch * .4;
      }
    }
    return c;
  }
  // Letters from pen strokes, with the reach of real English: tall letters go up, a few go down, and the line wanders.
  function hand(r, { lines = 22, pitch = 46, size = 13, pen = 2.2, color = '#1b2a55', ruled = false, wander = 2.5, mx = 90 } = {}) {
    const { c, x, W } = blankPage();
    let y0 = 120;
    if (ruled) { x.strokeStyle = '#9db8dd'; x.lineWidth = 1.2; for (let y = 80; y < 1300; y += pitch) { x.beginPath(); x.moveTo(0, y + 2); x.lineTo(W, y + 2); x.stroke(); } x.strokeStyle = '#d98a8a'; x.beginPath(); x.moveTo(mx - 14, 0); x.lineTo(mx - 14, 1320); x.stroke(); y0 = 80 + pitch; }
    x.strokeStyle = color; x.lineWidth = pen; x.lineCap = 'round'; x.lineJoin = 'round';
    const slant = (r() - .4) * .25, tall = 'bdfhklt', low = 'gjpqy';
    const stroke = pts => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); };
    for (let ln = 0; ln < lines; ln++) {
      const base = y0 + ln * pitch; let px = mx + (ln === 0 ? 30 : 0) + r() * 6, drift = 0;
      const end = W - mx - r() * 170;
      while (px < end) {
        const w = WORDS[Math.floor(r() * WORDS.length)];
        for (const ch of (ln % 7 === 0 && px < mx + 40 ? w[0].toUpperCase() + w.slice(1) : w)) {
          drift += (r() - .5) * .8; drift = Math.max(-wander, Math.min(wander, drift));
          const b = base + drift, cw = size * (.62 + r() * .45), xh = size * (.85 + r() * .25), upper = ch !== ch.toLowerCase();
          const j = () => (r() - .5) * 1.6, sl = v => px + (b - v) * slant;
          const v = upper ? ch.toLowerCase() : ch;
          if (upper) stroke([[sl(b) + j(), b + j()], [sl(b - xh * 2.1) + cw * .4, b - xh * 2.1 + j()], [sl(b) + cw, b + j()]]);
          else if (tall.includes(v)) { stroke([[sl(b - xh * 2) + j() , b - xh * 2 + j()], [sl(b) + j(), b + j()]]); stroke([[sl(b - xh * .9) + j(), b - xh * .9], [sl(b - xh) + cw * .6, b - xh + j()], [sl(b) + cw * .75, b + j()], [sl(b) + cw * .1, b + j()]]); }
          else if (low.includes(v)) { stroke([[sl(b) + cw * .8, b + j()], [sl(b - xh) + cw * .4, b - xh + j()], [sl(b) + j(), b - 1], [sl(b) + cw * .8, b + j()], [sl(b + xh * 1.2) + cw * .6, b + xh * 1.2 + j()], [sl(b + xh * 1.25) + j(), b + xh * .9 + j()]]); }
          else stroke([[sl(b) + j(), b + j()], [sl(b - xh) + cw * .25, b - xh + j()], [sl(b) + cw * .55, b + j()], [sl(b - xh) + cw * .8, b - xh + j()], [sl(b) + cw, b + j()]]);
          if (v === 'i' || v === 'j') stroke([[sl(b - xh * 1.5) + cw * .5, b - xh * 1.5], [sl(b - xh * 1.5) + cw * .5 + 1, b - xh * 1.5 + 1]]);
          px += cw + r() * 2;
        }
        px += size * (.8 + r() * .7);
      }
    }
    return c;
  }
  function worksheet(r) {
    const { c, x, W } = blankPage(); x.font = 'bold 26px Arial, sans-serif'; x.fillText('Reading Check: Chapter Four', 110, 110); x.font = '18px Arial, sans-serif'; x.fillText('Name: ______________________   Class: ________   Date: _________', 110, 160);
    let y = 220; for (let q = 1; y < 1200; q++) { x.font = '18px Arial, sans-serif'; const s = sentence(r, 11 + Math.floor(r() * 4)); x.fillText(q + '. ' + s.slice(0, 74), 110, y); y += 30; for (let l = 0; l < 3; l++) { x.fillRect(135, y + 6, W - 245, 1.5); y += 34; } y += 14; }
    return c;
  }
  function table(r) {
    const { c, x, W } = blankPage(), rows = 16, colsN = 5, tw = W - 200, th = 980; x.lineWidth = 2; x.font = '17px Arial, sans-serif';
    for (let i = 0; i <= rows; i++) { x.beginPath(); x.moveTo(100, 180 + i * th / rows); x.lineTo(100 + tw, 180 + i * th / rows); x.stroke(); }
    for (let j = 0; j <= colsN; j++) { x.beginPath(); x.moveTo(100 + j * tw / colsN, 180); x.lineTo(100 + j * tw / colsN, 180 + th); x.stroke(); }
    for (let i = 0; i < rows; i++) for (let j = 0; j < colsN; j++) x.fillText(WORDS[Math.floor(r() * WORDS.length)].slice(0, 9), 110 + j * tw / colsN, 180 + (i + .65) * th / rows);
    x.font = 'bold 24px Arial, sans-serif'; x.fillText('Evidence Table', 100, 130);
    return c;
  }
  function chart(r) {
    const { c, x } = blankPage(); x.lineWidth = 3; x.beginPath(); x.moveTo(170, 180); x.lineTo(170, 900); x.lineTo(900, 900); x.stroke();
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#555' : '#222'; const h = 100 + r() * 600; x.fillRect(200 + i * 85, 900 - h, 55, h); }
    x.fillStyle = '#111'; x.font = '19px Arial, sans-serif'; x.fillText('Figure 1. Water level during the summer flood, by week.', 170, 960);
    return c;
  }
  function cjk(r, { vertical = false } = {}) {
    const { c, x } = blankPage(); x.font = '24px "Microsoft JhengHei", "PingFang TC", sans-serif';
    const t = i => CJK[Math.floor(r() * CJK.length) + 0 * i];
    if (vertical) { for (let cx = 880; cx > 120; cx -= 50) for (let y = 130, i = 0; y < 1180; y += 30, i++) x.fillText(t(i), cx, y); }
    else for (let y = 130; y < 1180; y += 46) for (let px = 110; px < 880; px += 27) x.fillText(t(px), px, y);
    return c;
  }
  function caps(r) { const { c, x } = blankPage(); x.font = '20px Arial, sans-serif'; for (let y = 130; y < 1150; y += 34) x.fillText(sentence(r, 9).toUpperCase().slice(0, 62), 110, y); return c; }
  function capsCentered(r) { const { c, x } = blankPage(); x.font = '21px Arial, sans-serif'; x.textAlign = 'center'; for (let y = 130; y < 1180; y += 36) x.fillText(sentence(r, 7).toUpperCase().slice(0, 60), 510, y); return c; }
  function poem(r) { const { c, x } = blankPage(); x.font = '21px Georgia, serif'; x.textAlign = 'center'; for (let y = 140, i = 0; y < 1180; y += 36, i++) if (i % 5 !== 4) x.fillText(sentence(r, 3 + Math.floor(r() * 5)), 510, y); return c; }
  function numbers(r) { const { c, x } = blankPage(); x.font = '20px "Courier New", monospace'; for (let y = 130; y < 1180; y += 40) { let s = ''; for (let k = 0; k < 6; k++) s += String(Math.floor(r() * 90000) + 10000) + '  '; x.fillText(s, 110, y); } return c; }
  function cover(r) { const { c, x } = blankPage(); x.textAlign = 'center'; x.font = 'bold 44px Georgia, serif'; x.fillText('The River And The Flood', 510, 480); x.font = '24px Georgia, serif'; x.fillText('Bram Sample', 510, 560); x.fillText('English Twelve', 510, 600); x.fillText('Ms. Example', 510, 640); return c; }
  function filled(r) { const c = worksheet(r), h = hand(r, { lines: 8, pitch: 150, size: 11, color: '#20306a', mx: 150 }), x = c.getContext('2d'); x.globalCompositeOperation = 'darken'; x.drawImage(h, 0, 60); x.globalCompositeOperation = 'source-over'; return c; }
  function note(r) { const { c, x } = blankPage(); x.font = '20px Georgia, serif'; x.fillText('Aria Testwell', 110, 120); x.fillText('Late pass for the essay, handed in on Friday.', 110, 160); return c; }
  function slide(r) { const { c, x } = blankPage(1320, 1020); x.font = 'bold 54px Arial, sans-serif'; x.fillText('Why the river matters', 100, 170); x.font = '34px Arial, sans-serif'; for (let i = 0; i < 6; i++) x.fillText('• ' + sentence(r, 6).slice(0, 48), 120, 280 + i * 90); return c; }
  const KINDS = {
    'typed serif': r => typed(r), 'typed sans': r => typed(r, { font: 'Arial, sans-serif', size: 18, pitch: 28 }), 'typed double': r => typed(r, { size: 19, pitch: 56, lines: 20 }),
    'typed justified': r => typed(r, { justify: true }), 'typed two columns': r => typed(r, { cols: 2, size: 15, pitch: 22, lines: 46, title: false }), 'typed half page': r => typed(r, { lines: 12 }),
    'handwriting': r => hand(r), 'handwriting ruled': r => hand(r, { ruled: true, pitch: 44 }), 'handwriting pencil': r => hand(r, { color: '#55585e', pen: 1.8 }), 'handwriting big short': r => hand(r, { lines: 7, size: 18, pitch: 66 }), 'handwriting few lines': r => hand(r, { lines: 3 }),
    'handwriting messy': r => hand(r, { lines: 26, pitch: 36, size: 15, pen: 2.6, wander: 7 }), 'handwriting small': r => hand(r, { lines: 30, pitch: 36, size: 9, pen: 1.4 }), 'all capitals': caps, 'all capitals centered': capsCentered, 'all capitals justified': r => { const c = typed(r, { font: 'Arial, sans-serif', justify: true, title: false, upper: true }); return c; }, 'poem centered': poem, 'columns of numbers': numbers, 'cover page': cover, 'filled-in worksheet': filled,
    worksheet, table, chart, 'chinese': r => cjk(r), 'chinese vertical': r => cjk(r, { vertical: true }), 'short note': note, 'slide': slide,
  };
  // Math and code: short lines that start level with each other, with numbers and characters that stack up. These look like lines running the other way.
  const num = (r, n) => Math.floor(r() * n);
  const MATHS = {
    'math problems': r => { const { c, x } = blankPage(); x.font = '24px Cambria, serif'; let y = 130; for (let i = 1; y < 1230; i++) { x.fillText(i + '.  ' + num(r, 90) + 'x + ' + num(r, 9) + ' = ' + num(r, 90), 110, y); y += 38; x.fillText('    y = ' + num(r, 9) + 'x\u00b2 - ' + num(r, 9) + 'x + ' + num(r, 9), 110, y); y += 70; } return c; },
    'math two columns': r => { const { c, x } = blankPage(); x.font = '22px Cambria, serif'; for (let y = 130, i = 1; y < 1230; y += 64, i++) { x.fillText(i + '. ' + num(r, 90) + ' + ' + num(r, 90) + ' =', 110, y); x.fillText((i + 20) + '. ' + num(r, 9) + 'x = ' + num(r, 90), 560, y); } return c; },
    'code': r => { const { c, x } = blankPage(); x.font = '18px Consolas, monospace'; for (let y = 120, i = 0; y < 1230; y += 26, i++) x.fillText(' '.repeat(i % 5 * 2) + sentence(r, 5).toLowerCase().slice(0, 60) + ';', 110, y); return c; },
    'code short lines': r => { const { c, x } = blankPage(); x.font = '16px "Courier New", monospace'; for (let y = 120, i = 0; y < 1230; y += 22, i++) x.fillText(' '.repeat(i % 3 * 4) + ['if (x > 0) {', 'return n * 2;', '}', 'for i in range(10):', 'print(total)', 'int a = 5;', 'let y = f(x);', 'end'][num(r, 8)], 110, y); return c; },
  };
  // Grids of numbers, with bars beside them unless bars is false: R rows and C columns, per to a line of the page, a new line of them every pitch.
  const grids = (R, C, per, pitch, font, dx, dy, bars = true) => r => { const { c, x } = blankPage(); x.font = font; for (let y = 140; y < 1200; y += pitch) for (let k = 0; k < per; k++) { const X = 120 + k * (800 / per); for (let a = 0; a < R; a++) for (let b = 0; b < C; b++) x.fillText(String(num(r, 20) - 9), X + b * dx, y + a * dy); if (bars) { x.fillRect(X - 12, y - 24, 2, R * dy + (dy > 30 ? -8 : 4)); x.fillRect(X + C * dx - 20, y - 24, 2, R * dy + (dy > 30 ? -8 : 4)); } } return c; };
  // Pages that have caught the rules out: a grid of numbers with bars beside it, and tiny code. Kept out of the sets above, which are counted.
  const HARD = {
    'matrices': r => { const { c, x } = blankPage(); x.font = '24px "Times New Roman", serif'; for (let y = 140; y < 1200; y += 170) for (let k = 0; k < 2; k++) { const X = 120 + k * 400; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) x.fillText(String(num(r, 20) - 9), X + b * 60, y + a * 40); x.fillRect(X - 12, y - 24, 2, 110); x.fillRect(X + 170, y - 24, 2, 110); } return c; },
    'matrices 4x4': grids(4, 4, 2, 210, '22px "Times New Roman", serif', 52, 38), 'matrices tight': grids(3, 3, 2, 132, '22px "Times New Roman", serif', 56, 36), 'matrices no bars': grids(3, 3, 2, 170, '24px "Times New Roman", serif', 60, 40, false), 'matrices wide': grids(3, 3, 2, 150, '22px "Times New Roman", serif', 80, 30), 'matrices 5x5': grids(5, 5, 2, 240, '20px "Times New Roman", serif', 46, 36),
    'stacked sums': r => { const { c, x } = blankPage(); x.font = '28px Arial, sans-serif'; x.textAlign = 'right'; for (let y = 130; y < 1180; y += 170) for (let k = 0; k < 4; k++) { const X = 240 + k * 210; x.fillText(String(num(r, 9000) + 1000), X, y); x.fillText('+ ' + (num(r, 900) + 100), X, y + 38); x.fillRect(X - 110, y + 50, 112, 3); x.fillText(String(num(r, 9000) + 1000), X, y + 88); } return c; },
    'tiny code': r => { const { c, x } = blankPage(), T = ['def mean(values):', '    total = sum(values)', '    if not values:', '        return 0', '    return total / len(values)', 'for name, grade in grades.items():', '    print(name, mean(grade))']; x.font = '14px "Lucida Console", monospace'; let i = num(r, T.length); for (let y = 110; y < 1240; y += 18, i++) x.fillText(T[i % T.length], 110, y); return c; },
  };
  const pageOf = kind => KINDS[kind] || MATHS[kind] || HARD[kind];
  // Writing that has faded: keep is how much of its darkness is left.
  const fade = (c, keep) => { const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data; for (let i = 0; i < d.length; i++) if (i % 4 !== 3) d[i] = 255 - (255 - d[i]) * keep; x.putImageData(im, 0, 0); return c; };
  const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2832 * r());
  // The page put on the scanner: o quarter-turn degrees and s small degrees, clockwise, as the scanner saw it.
  function place(src, o, s, bg = '#fff') {
    const sw = o % 180 === 0, W = sw ? src.width : src.height, H = sw ? src.height : src.width, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = bg; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = 'high';
    x.translate(W / 2, H / 2); x.rotate((o + s) * Math.PI / 180); x.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }
  function wear(c, how, r) {
    const x = c.getContext('2d'), W = c.width, H = c.height, im = x.getImageData(0, 0, W, H), d = im.data;
    const fa = how === 'faint' ? { lift: 75, keep: .28 } : how === 'washed' ? { lift: 45, keep: .4 } : how === 'dim' ? { lift: -105, keep: .55 } : { lift: 0, keep: 1 };
    const noise = how === 'noisy' ? 7 : how === 'faint' || how === 'washed' ? 2 : 1.2, shade = how === 'shaded';
    for (let i = 0, y = 0; y < H; y++) for (let k = 0; k < W; k++, i += 4) {
      let f = 1; if (shade) f = 1 - .32 * Math.pow(k / W, 2) - .12 * (y / H);
      const n = noise ? gauss(r) * noise : 0;
      for (let q = 0; q < 3; q++) { let v = d[i + q]; if (how === 'faint' || how === 'washed') v = 255 - (255 - v) * fa.keep; else if (how === 'dim') v = v * fa.keep + 10; d[i + q] = Math.max(0, Math.min(255, v * f + n)); }
    }
    if (how === 'noisy') for (let k = 0; k < 500; k++) { const i = (Math.floor(r() * H) * W + Math.floor(r() * W)) * 4; d[i] = d[i + 1] = d[i + 2] = 60; }
    x.putImageData(im, 0, 0);
    return c;
  }
  // Blank paper: clean, speckled, ruled, a shadow down one side, and the page behind showing through.
  function blank(how, r) {
    const { c, x, W, H } = blankPage();
    if (how === 'ruled') { x.strokeStyle = '#9db8dd'; x.lineWidth = 1.2; for (let y = 80; y < H; y += 44) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } x.strokeStyle = '#d98a8a'; x.beginPath(); x.moveTo(76, 0); x.lineTo(76, H); x.stroke(); }
    if (how === 'shadow') { const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#fff'); g.addColorStop(.75, '#f4f4f4'); g.addColorStop(1, '#a8a8a8'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    if (how === 'pale ruled') { x.strokeStyle = '#e6edf6'; x.lineWidth = 1.2; for (let y = 80; y < H; y += 44) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } }
    if (how === 'show-through' || how === 'show-through strong') { const t = typed(r); x.save(); x.globalAlpha = how === 'show-through' ? .03 : .07; x.translate(W, 0); x.scale(-1, 1); x.filter = 'blur(1px)'; x.drawImage(t, 0, 0); x.restore(); }   // soft, from coming through the paper
    if (how === 'speckled') { x.fillStyle = '#333'; for (let k = 0; k < 350; k++) x.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5); }
    return wear(c, how === 'speckled' ? 'noisy' : 'clean', r);
  }
  // Down to the size the app looks at, in lightness.
  function toGray(c, px) {
    const k = Math.min(1, px / Math.max(c.width, c.height)), w = Math.round(c.width * k), h = Math.round(c.height * k), o = document.createElement('canvas'); o.width = w; o.height = h;
    const x = o.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    return { g, w, h };
  }
  // One whole test set. seed picks the words, wobbles and angles, so a run can be repeated, and a second seed is a set the rules weren't tuned on.
  const ORIENT = [0, 90, 180, 270], WEAR = ['clean', 'clean', 'noisy', 'shaded', 'faint', 'washed'];
  function sample(kind, o, seed, read, px) {
    const r = mulberry(seed), wearHow = WEAR[Math.floor(r() * WEAR.length)], sk = [0, 0, 1, -1, 1.8, -2.5, 3.5, -4.5][Math.floor(r() * 8)];
    const bed = r() < .15 ? '#555' : '#fff';   // now and then the scanner's dark lid shows at the corners
    const jig = sk ? sk + (r() - .5) * .6 : 0, src = pageOf(kind)(r), c = wear(place(src, o, jig, bed), wearHow, r), { g, w, h } = toGray(c, px), v = read(g, w, h);
    return { kind, o, skew: jig, wear: wearHow, want: (360 - o) % 360, wantSkew: -jig, turn: v.turn, turnSure: v.turnSure, sideways: v.sideways, gotSkew: v.skew, skewSure: v.skewSure, blank: v.blank, faint: v.faint, why: v.why };
  }
  function run({ seed = 1, perKind = 2, px = 1000, kinds } = {}) {
    const read = window.__gs.scanRead, out = []; let s = seed * 1000;
    for (const kind of kinds || Object.keys(KINDS)) for (let k = 0; k < perKind; k++) for (const o of ORIENT) out.push(sample(kind, o, ++s, read, px));
    return out;
  }
  function runBlank({ seed = 1, perKind = 6, px = 1000 } = {}) {
    const read = window.__gs.scanRead, out = []; let s = seed * 7000;
    for (const how of ['clean', 'speckled', 'ruled', 'pale ruled', 'shadow', 'show-through', 'show-through strong']) for (let k = 0; k < perKind; k++) { const r = mulberry(++s), { g, w, h } = toGray(place(blank(how, r), 0, (r() - .5) * 3), px), v = read(g, w, h); out.push({ how, blank: v.blank, faint: v.faint, why: v.why }); }
    return out;
  }
  // A real PDF of scanned pages, one JPEG each, the way a copier makes them. box: a black square at 420, 600 points on the level page, to check where things end up.
  async function pdf(specs) {
    const doc = await PDFLib.PDFDocument.create();
    for (const sp of specs) {
      const r = mulberry(sp.seed || 1), src = sp.blank ? blank(sp.blank, r) : pageOf(sp.kind || 'typed serif')(r);
      if (sp.fade) fade(src, sp.fade);
      if (sp.box) { const x = src.getContext('2d'); x.fillStyle = '#000'; x.fillRect(700, 1000, 40, 40); }
      const c = wear(place(src, sp.o || 0, sp.skew || 0), sp.wear || 'clean', r), jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(u => res(new Uint8Array(u))), 'image/jpeg', sp.q || .85));
      const W = (sp.o || 0) % 180 ? 792 : 612, H = (sp.o || 0) % 180 ? 612 : 792;
      const pg = doc.addPage([W, H]); pg.drawImage(await doc.embedJpg(jpg), { x: 0, y: 0, width: W, height: H });
      if (sp.ocr) pg.drawText(sp.ocr, { x: 40, y: 400, size: 9, opacity: 0, font: await doc.embedFont(PDFLib.StandardFonts.Helvetica) });   // the words a copier or OCR app read off the page, unseen
    }
    const u = await doc.save(); let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return btoa(bin);
  }
  window.gsScan = { KINDS, MATHS, HARD, pageOf, fade, mulberry, place, wear, blank, toGray, run, runBlank, typed, hand, pdf };
})();`;
// Sums up a run: for turning, how often the app turned a page wrongly, turned it rightly, asked, or kept quiet.
function tally(rows) {
  const t = { pages: rows.length, needTurn: 0, autoRight: 0, autoWrong: 0, askRight: 0, askWrong: 0, sidewaysAsk: 0, missed: 0, quietOk: 0, wrong: [], byKind: {},
    needSkew: 0, skewAuto: 0, skewAutoWrong: 0, skewAsk: 0, skewAskWrong: 0, skewMissed: 0, skewFalse: 0, skewErr: [], skewWrong: [] };
  for (const r of rows) {
    const k = t.byKind[r.kind] ||= { pages: 0, need: 0, autoRight: 0, autoWrong: 0, askRight: 0, askWrong: 0, sideAsk: 0, missed: 0, skewAuto: 0, skewWrong: 0, skewNeed: 0, skewAsk: 0 };
    k.pages++;
    const need = r.want !== 0;
    if (need) { t.needTurn++; k.need++; }
    if (r.turnSure === 2) {
      if (r.turn === r.want) { t.autoRight++; k.autoRight++; } else { t.autoWrong++; k.autoWrong++; t.wrong.push(r); }
    } else if (r.turnSure === 1 && r.sideways && !r.turn && r.want % 180) { t.sidewaysAsk++; k.sideAsk++;
    } else if (r.turnSure === 1) {
      if (r.turn === r.want) { t.askRight++; k.askRight++; } else { t.askWrong++; k.askWrong++; }
    } else if (need) { t.missed++; k.missed++; } else t.quietOk++;
    const needS = Math.abs(r.wantSkew) >= .6, off = Math.abs(r.gotSkew - r.wantSkew);
    if (needS) { t.needSkew++; k.skewNeed++; }
    if (r.skewSure === 2) {
      t.skewAuto++; k.skewAuto++; t.skewErr.push(off);
      if (off > .6) { t.skewAutoWrong++; k.skewWrong++; t.skewWrong.push(r); }
    } else if (r.skewSure === 1) { t.skewAsk++; k.skewAsk++; if (off > 1) t.skewAskWrong++; }
    else if (needS) t.skewMissed++;
    if (!needS && r.skewSure && Math.abs(r.gotSkew) >= .5 && off > .6) t.skewFalse++;
  }
  t.skewErr.sort((a, b) => a - b);
  t.skewMedianErr = t.skewErr.length ? t.skewErr[t.skewErr.length >> 1] : 0;
  t.skewErr = undefined;
  return t;
}
module.exports = { PAGE_SRC, tally };
