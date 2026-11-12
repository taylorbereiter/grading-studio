/* ---------------- names: finding a student's name in text, in any alphabet, for the Claude ZIP and anonymous grading ---------------- */
// Everyday English words that are also names. Alone, one of these only counts when it's written like a name: My, Don or An, and not my, don't or an.
const NAME_PLAIN = new Set(('al am an art as at august autumn ban bay be best bill bin black brown by can case chase chin dawn day de dean do don dung da ed faith far frank gay go grace gray green grey ha hang he hope ho hung if in is it ivy jade joy june king la lane le little long love major man mark may me min my new no nice on or page pan park pat pearl pen penny price rich rose ruby sandy sang short sing small so son song star stone su sue summer sun sung tan tang ten tin to tu up us van violet von we white will win wing won wood wu ye young april').split(' '));
// Of those, the ones that are far more often a name than the first word of a sentence: Ruby and Grace, where My and Will aren't.
const NAME_MOSTLY = new Set('al april august autumn chin dawn dean don dung ed faith frank grace hung ivy jade joy june min pat pearl penny rose ruby sandy sang sue summer sung tang violet wu'.split(' '));
const isPlainWord = w => NAME_PLAIN.has(w) || SORT_STOP.has(w);   // and words a file's name brings along, when a loose file is taken for a student
// The same in other alphabets, as they're written in a sentence: words so common that a name's letters mustn't turn them into a name for the whole class, like على for علي, ли for Ли or 하나 for 이하나.
const PLAIN_OTHER = ('على عليه عليها عليهم عليك عليكم علينا عليكما إلى الى إليه اليه إليها اليها إليهم اليهم أن ان إن أنا انا أنت انت أنه انه إنه أنها انها إنها أو او هو هي هم هذا هذه ذلك تلك لي له لها لك لنا لهم بي به بها في فى فيه فيها من مني منه منها منك ما لا لم لن قد كل مع عن عنه عند ثم هل كان كانت أية اية ' +
  'این را از با در که تو ' +   // Persian
  'של על אל את לא גם כל עם מי זה זו הוא היא אני עלי אלי הם ' +   // Hebrew
  'вера надежда любовь роза слава мир лев он она они мы вы ты да нет на по за из от до но не ни то так как это ли ' +   // Cyrillic
  'και το τα να θα με σε δε για από νίκη ελπίδα ειρήνη ' +   // Greek
  '美丽 快乐 幸福 学习 老师 学生 朋友 明天 今天 昨天 世界 中国 文化 大家 大海 海洋 天气 春天 夏天 秋天 冬天 平安 希望 未来 太阳 阳光 月亮 大地 太陽 学校 先生 友達 今日 明日 ' +   // Chinese and Japanese
  '하나 나라 사랑 우리 하늘 바다 구름 가을 여름 겨울 마음 나무 노래 사람 오늘 내일 학교 친구 수정 이름 선생 ' +   // Korean
  'ใหม่ น้ำ ฟ้า นก ดี ใจ').normalize('NFKC').split(' ');   // Thai
const CJK_NAME = /[\p{Script=Han}\p{Script=Hangul}]/u, NO_SPACES = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const AT_START = '(?<![\\p{L}\\p{M}\\p{N}])', AT_END = '(?![\\p{L}\\p{N}])', NOT_PART = "(?!['’](?:t|re|ve|ll|d|m)(?!\\p{L})|-\\p{L})", MID_SENTENCE = '(?<=[\\p{L}\\p{N},;:)"”\'’\\]-][ \\t]+)', ALONE = ['(?<=(?:^|[\\r\\n])[ \\t]*)', '(?=[ \\t]*(?:$|[\\r\\n]))'], LABEL = '(?<=(?:[Nn][Aa][Mm][Ee]|[Ss][Tt][Uu][Dd][Ee][Nn][Tt]|[Aa][Uu][Tt][Hh][Oo][Rr]|[Bb][Yy]|[Ff][Rr][Oo][Mm])[ \\t]*:[ \\t]*)', NAME_SEP = "[\\s,.'’_-]*", FILE_SEP = '[._-]?';
// Email addresses, long numbers and labelled IDs say who someone is too.
const ID_RX = '[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)+|' + AT_START + '(?:[Ss]tudent\\s+(?:[Ii][Dd]|[Nn]o\\.?|[Nn]umber|#)|ID)[\\s:#.]*\\d{3,}|(?<![\\p{L}\\p{N}.,])\\p{L}{0,2}\\d{6,}(?![\\p{L}\\p{N}]|[.,]\\d)';
// Each plain letter (or pair, like ae) with every letter written for it, by case.
let nameLetters = null;
function letterTable() {
  if (nameLetters) return nameLetters;
  const T = nameLetters = {}, add = (k, c) => { (T[k] ||= { lo: '', up: '' })[c === c.toLowerCase() ? 'lo' : 'up'] += c; };
  for (const [a, b] of [[0x41, 0x5a], [0x61, 0x7a], [0xc0, 0x24f], [0x1e00, 0x1eff]]) for (let i = a; i <= b; i++) { const c = String.fromCodePoint(i), k = nameFold(c); if (/^[a-z]{1,2}$/.test(k)) add(k, c); }
  for (const [k, cs] of [['ae', 'äÄ'], ['oe', 'öÖøØ'], ['ue', 'üÜ'], ['aa', 'åÅ']]) for (const c of cs) add(k, c);
  return T;
}
// The pattern for a plain word, however it's accented. title: only as Word, with its first letter a capital and the rest small; 'caps': only as WORD.
function latinRx(word, title) {
  const T = letterTable(), set = (e, first) => '[' + (title ? (first || title === 'caps' ? e.up : e.lo) : e.lo + e.up) + ']\\p{M}*';
  let out = '';
  for (let i = 0; i < word.length;) {
    const c = word[i], one = T[c] ? set(T[c], i === 0) : c, pair = T[word.slice(i, i + 2)];
    if (pair && word.length > i + 1 && T[word[i + 1]]) { out += '(?:' + one + set(T[word[i + 1]], false) + '|' + set(pair, i === 0) + ')'; i += 2; }
    else { out += one; i++; }
  }
  return out;
}
// Letters that stand for one another. Arabic: the same name typed with or without a hamza, in Arabic or Persian letters, and a PDF's text can swap them too (ﯾ reads as ی, ه as ھ). Chinese and Japanese: a PDF's text can give the radical that looks the same, ⻩ for 黄, which Unicode doesn't count as the same letter.
const SAME_LETTERS = new Map('اأإآ يیى هھہة كک 厂⺁ 乙⺄ 刀⺈ 卜⺊ 小⺌⺍ 兀⺎ 尢⺐ 巳⺒ 幺⺓ 心⺗ 旡⺛ 日⺜ 月⺝ 母⺟ 民⺠ 牛⺧ 王⺩ 疋⺪ 目⺫ 示⺬ 竹⺮ 网⺳⺴ 羊⺶ 聿⺻ 肉⺼ 臼⺽ 虎⻁ 西⻄ 见⻅ 角⻆ 贝⻉ 车⻋ 長⻑ 镸⻒ 长⻓ 门⻔ 雨⻗ 青⻘ 韦⻙ 页⻚ 风⻛ 飞⻜ 食⻝ 飠⻟ 马⻢ 骨⻣ 鬼⻤ 鱼⻥ 鸟⻦ 卤⻧ 麦⻨ 黄⻩ 黾⻪ 斉⻫ 齐⻬ 歯⻭ 齿⻮ 竜⻯ 龙⻰ 龜⻱ 亀⻲ 龟⻳ 戶户戸 黑黒'.split(' ').flatMap(g => [...g].map(c => [c, g])));
// Letters people type as one, which rawWords and a PDF's text turn into two: ำ and ຳ, the Lao ໜ and ໝ, the Armenian և. In a comment or a form box they're still as typed, so a pattern takes either.
const ONE_LETTER = new Map('ำ ຳ ໜ ໝ և'.split(' ').map(c => [c.normalize('NFKC'), c]));
const ONE_LETTER_RX = new RegExp([...ONE_LETTER.keys(), '.'].join('|'), 'gsu');
const eitherWay = (s, each) => (s.match(ONE_LETTER_RX) || []).map(p => ONE_LETTER.has(p) ? '(?:' + each(p) + '|' + ONE_LETTER.get(p) + ')' : each(p)).join('');
// A word in another alphabet, as it's spelled, in either way Unicode can store it, and with its accents gone unless marked says they have to stay.
function spelledRx(raw, marked) {
  const lit = s => eitherWay(s, p => [...p].map(c => { const v = new Set([c, c.toLowerCase(), c.toUpperCase(), ...(SAME_LETTERS.get(c) || '')].filter(x => [...x].length === 1)); return v.size > 1 ? '[' + [...v].join('') + ']' : rxEsc(c); }).join(''));
  const nfd = raw.normalize('NFD');
  return '(?:' + [...new Set([raw.normalize('NFC'), nfd, marked ? nfd : nfd.replace(/[̀-ͯ]/g, '')])].map(lit).concat(THAI.test(raw) ? thaiRx(raw) : []).join('|') + ')';
}
// Thai: where two marks stack on a letter, a PDF's text can keep only one of them and put an empty character in place of the other. ดิ์ comes out as ดิ and a gap, น้ำ as นํ, a gap and า.
// With some fonts a single mark is followed by a gap too: คำ comes out as คํ, a gap and า.
const THAI = /\p{Script=Thai}/u;
const thaiRx = raw => (raw.normalize('NFC').match(/\P{M}\p{M}*/gu) || []).map(c => { const n = [...c].length; return n > 2 ? rxEsc([...c][0]) + '\\p{M}+[\\s\\x00]?' : n === 2 ? rxEsc(c) + '[\\s\\x00]?' : rxEsc(c); }).join('');
// Many Thai fonts keep a second drawing of a mark for where it has to sit lower or further left, and a PDF's text gives that drawing
// its own private character (U+F700 to U+F71A) in place of the mark. Read back as the mark it is, or a name with one goes uncovered.
const THAI_PUA = '\u0E10\u0E34\u0E35\u0E36\u0E37\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E0D\u0E31\u0E4D\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E38\u0E39\u0E3A';
const thaiPlain = s => /[\uF700-\uF71A]/.test(s) ? s.replace(/[\uF700-\uF71A]/g, c => THAI_PUA[c.charCodeAt(0) - 0xF700]) : s;
const isLatin = raw => /^[a-z0-9]+$/.test(nameFold(raw));
// A short name with its accents gone is too easily a word of its own: cat for Cát. Its small letters only count on the student's own paper.
const shortBare = raw => { const w = nameFold(raw); return isLatin(raw) && w.length <= 3 && w !== raw.toLowerCase(); };
// The everyday words this name's letters can also spell, in any alphabet but A to Z. Starting with them is enough, since in these alphabets a name can have an ending: عليه starts like علي.
const plainForms = raw => { const rx = new RegExp('^' + spelledRx(raw), 'u'); return PLAIN_OTHER.filter(w => rx.test(w)); };
const notPlain = raw => { const f = plainForms(raw); return f.length ? '(?!(?:' + f.map(w => eitherWay(w, rxEsc)).join('|') + ')' + (NO_SPACES.test(raw) ? '' : AT_END) + ')' : ''; };
const isEveryday = raw => isLatin(raw) ? isPlainWord(nameFold(raw)) || shortBare(raw) : plainForms(raw).length > 0;
const anyRx = raw => isLatin(raw) ? latinRx(nameFold(raw)) : spelledRx(raw);
const rawWords = name => String(name).normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+/gu) || [];
const wordOk = raw => { const w = nameFold(raw); return /^\d+$/.test(w) ? w.length >= 4 : [...raw].length >= 2 && !/^(the|and|of)$/.test(w); };
// Names in Korean and Chinese are often one run: 김민수, and just 민수 for the given name, with an ending right after it.
function spellings(raw) {
  const c = [...raw.normalize('NFC')], out = [raw];
  if (c.every(x => CJK_NAME.test(x))) { if (c.length === 3 || c.length === 4) out.push(c.slice(-2).join('')); if (c.length === 4) out.push(c.slice(0, 2).join('')); }
  return out;
}
// German and Nordic spellings without the special letter: Müller as Mueller, Søren as Soeren.
const respelled = raw => /[äöüøåÄÖÜØÅ]/.test(raw) ? raw.replace(/[äÄ]/g, 'ae').replace(/[öÖøØ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[åÅ]/g, 'aa') : null;
const bounded = (raw, src) => (NO_SPACES.test(raw) ? src : AT_START + src + (isLatin(raw) ? AT_END : ''));
// One alternative of a pattern: the longest are tried first, so a whole name wins over a word in it.
const alt = (len, src) => ({ len, src });
// whose: 'own' for the student's own paper, 'class' for a classmate's, 'sure' for what proves the name is on the page, which an everyday word alone can't.
function wordAlts(raw, whose) {
  const out = [], own = whose === 'own';
  for (const r of [raw, respelled(raw)].filter(Boolean)) for (const s of spellings(r)) {
    if (!wordOk(s)) continue;
    const w = nameFold(s);
    if (!isLatin(s)) {
      // Not on the student's own paper, it can't be an everyday word, and two letters have to be a word of their own: ли and литература stay for a classmate named Ли.
      const no = own ? '' : notPlain(s), end = !own && [...s].length <= 2 && !NO_SPACES.test(s) ? AT_END : '';
      out.push(alt(w.length, bounded(s, no + anyRx(s)) + end));
      if (no) out.push(alt(w.length, LABEL + AT_START + anyRx(s)));
      continue;
    }
    const plain = isPlainWord(w), bare = !own && shortBare(s);
    if (!plain && !bare) out.push(alt(w.length, bounded(s, anyRx(s))));
    else {
      const mostly = NAME_MOSTLY.has(w) || !plain, caps = AT_START + latinRx(w, 'caps') + AT_END, label = alt(w.length, LABEL + AT_START + latinRx(w) + AT_END);
      const marked = w !== s.toLowerCase() ? [alt(w.length, AT_START + spelledRx(s, true) + AT_END)] : [];   // Mỹ can't be anything but the name, but my can
      if (whose === 'sure' && !mostly) { out.push(label, ...marked); continue; }
      out.push(alt(w.length, (own || mostly ? '' : MID_SENTENCE) + AT_START + latinRx(w, true) + AT_END + NOT_PART));
      // In capitals, RUBY is the name anywhere, and WILL only on a line of its own, since a heading can say IN MY VIEW. After Name: it's the name however it's written.
      out.push(alt(w.length, mostly ? caps : ALONE[0] + caps + ALONE[1]), label, ...marked);
    }
  }
  return out;
}
// A name as one run: TheoBanks, BanksTheo. When a part wouldn't count alone (My Nguyen, O'Brien, 김 민수), also with anything between them.
function runAlts(parts) {
  const out = [], use = p => wordOk(p) && !isEveryday(p);
  if (parts.length < 2) return out;
  const sep = parts.every(use) ? '' : NAME_SEP, orders = [parts, [...parts].reverse()];
  // Everyday words or single letters, all of them (Tô Mỹ, or the Tô and Mỹ of Tô Thị Mỹ): only written like a name, or "to my" would be one.
  const everyday = p => isLatin(p) ? nameFold(p).length < 2 || isPlainWord(nameFold(p)) : isEveryday(p), named = p => isLatin(p) ? '(?:' + latinRx(nameFold(p), true) + '|' + latinRx(nameFold(p), 'caps') + ')' : notPlain(p) + anyRx(p);
  if (parts.length > 2) orders.push([parts[0], parts[parts.length - 1]], [parts[parts.length - 1], parts[0]]);
  for (const o of orders) out.push(alt(o.join('').length + 1, bounded(o[0] + o[o.length - 1], o.map(o.every(everyday) ? named : anyRx).join(sep))));
  return out;
}
const latinParts = parts => parts.filter(p => isLatin(p) && !/^\d+$/.test(nameFold(p)));
// tbanks, t.banks: a first letter and a whole name, as in email addresses and school logins.
function initialAlts(parts) {
  const out = [], L = latinParts(parts);
  for (const a of L) for (const b of L) { const fb = nameFold(b); if (a !== b && fb.length >= 3 && !NAME_PLAIN.has(nameFold(a)[0] + fb)) out.push(alt(fb.length + 1, AT_START + latinRx(nameFold(a)[0]) + FILE_SEP + latinRx(fb) + AT_END)); }
  return out;
}
// Only in a file's name, where there's no sentence to spoil and a stray [name] costs nothing: any part of a run of letters, whatever its case, and the short forms people use for files.
function fileAlts(parts) {
  const out = [], L = latinParts(parts);
  for (const p of parts) if (wordOk(p)) {
    const w = nameFold(p), latin = isLatin(p);
    out.push(alt(w.length, latin && w.length >= 3 && !SORT_STOP.has(w) ? anyRx(p) : bounded(p, anyRx(p))));
    if (latin && w.length < 3) out.push(alt(w.length, '(?<!\\p{Lu})' + latinRx(w, true) + '(?!\\p{Ll})'));   // MyEssay, EssayMy
  }
  for (const a of L) for (const b of L) if (a !== b && nameFold(b).length >= 2) out.push(alt(nameFold(b).length + 2, AT_START + latinRx(nameFold(b)) + FILE_SEP + latinRx(nameFold(a)[0]) + AT_END));
  if (L.length >= 2) out.push(alt(2, AT_START + L.map(p => latinRx(nameFold(p)[0])).join('') + AT_END));
  return out;
}
const altsRx = (lists, more) => {
  const src = lists.flat().sort((a, b) => b.len - a.len).map(a => a.src).filter((s, i, all) => all.indexOf(s) === i).concat(more || []);
  return src.length ? src.join('|') : '';
};
// Everything worked out for a class is kept until the students or the roster change, since a page draw asks for it every time.
let nameMemo = { sig: null };
function namesNow() {
  const c = batchClass(), sig = batch.students.map(s => s.key).join('\n') + '\n\n' + (c ? c.names.join('\n') + '\n\n' + infoSig(c) : '');
  if (nameMemo.sig === sig) return nameMemo;
  const roster = new Map();
  if (c) for (const [n, s] of rosterMatch(c.names)) roster.set(s.key, [...(roster.get(s.key) || []), n]);
  const all = [...new Set(batch.students.map(s => s.key).concat(c ? c.names : []))];
  const classAlts = all.map(n => { const parts = rawWords(n); return [...parts.flatMap(p => wordAlts(p, 'class')), ...runAlts(parts)]; });
  return nameMemo = { sig, roster, all, classSrc: altsRx(classAlts), own: new Map(), file: new Map(), cls: null, sure: new Map(), found: new Map() };
}
const ownNames = st => [st.key, ...(namesNow().roster.get(st.key) || [])].map(rawWords);
// What counts as a name on this student's paper and in comments about them: their own in any form, and any classmate's.
function coverRx(st) {
  const N = namesNow(); let rx = N.own.get(st.key);
  if (!rx) N.own.set(st.key, rx = new RegExp([ID_RX, altsRx(ownNames(st).map(p => [...p.flatMap(w => wordAlts(w, 'own')), ...runAlts(p), ...initialAlts(p)])), N.classSrc].filter(Boolean).join('|'), 'gu'));
  return rx;
}
// In a file's name, more goes: anything that looks like the student's name, however it's run together or shortened.
function fileRx(st) {
  const N = namesNow(); let rx = N.file.get(st.key);
  if (!rx) N.file.set(st.key, rx = new RegExp([ID_RX, altsRx(ownNames(st).map(p => [...runAlts(p), ...initialAlts(p), ...fileAlts(p)])), N.classSrc].filter(Boolean).join('|'), 'gu'));
  return rx;
}
// Text about no one student, like her message to Claude: anyone in the class.
function classRx() { const N = namesNow(); return N.cls === null ? (N.cls = N.classSrc ? new RegExp(N.classSrc, 'gu') : false) || null : N.cls || null; }
// Any alphabet but A to Z and its accented letters: a PDF's text can scramble or lose these letters in ways no list will ever catch, so the cover can't promise them.
const NOT_LATIN = /(?![\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}])\p{L}/u;
const namesLost = () => namesNow().all.some(n => NOT_LATIN.test(n));
// What the automatic cover can't promise for this class, said plainly in the boxes that rely on it.
function nameWarnings() {
  if (!nameFindOn()) return '';
  const out = [], says = w => isLatin(w) ? nameFold(w) : w, words = [...new Set(namesNow().all.flatMap(rawWords).filter(w => isLatin(w) ? (NAME_PLAIN.has(nameFold(w)) && !NAME_MOSTLY.has(nameFold(w))) || shortBare(w) : plainForms(w).length).map(says))];
  if (namesLost()) out.push('A name typed in another alphabet, like Hindi, Thai, Arabic, Chinese, Burmese, Khmer or a similar one, can’t always be read off the page, so it may not be covered, on that student’s paper or on a classmate’s. In the check, look for them and drag a box over each one.');
  if (words.length) out.push('Some names here are everyday words too' + (anonOn() ? '' : ' (' + words.slice(0, 4).map(w => esc(w[0].toUpperCase() + w.slice(1))).join(', ') + (words.length > 4 ? '…' : '') + ')') + '. A classmate’s name that looks just like the word, as it does at the start of a sentence, stays as typed. Look for it on the papers and in your comments.');
  return out.length ? '<div class="bbmiss" id="nameWarn" style="margin-bottom:12px"><b>Worth a look:</b><ul style="list-style:disc;margin:4px 0 0;padding-left:20px">' + out.map(x => '<li>' + x + '</li>').join('') + '</ul></div>' : '';
}
/* ---------------- finding names on its own: off unless she turns it on (11/11) ---------------- */
// It covered too many words that weren't names, so by default only the boxes she draws in Check the covers cover anything.
const nameFindOn = () => !!store.get('gs.nameFind', false);
function nameFindShow() { for (const b of document.querySelectorAll('#setNameFind button')) b.setAttribute('aria-pressed', String((b.dataset.v === '1') === nameFindOn())); }
$('#setNameFind').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  if (b.dataset.v === '1') store.set('gs.nameFind', true); else store.del('gs.nameFind');
  nameFindShow();
});
nameFindShow();
/* ---------------- the safety net: a paper says so when its own student's name can't be found on it, or can't be trusted when it is ---------------- */
// What proves a student's name is on the page: not My or Will alone, which any page can say.
function sureRx(st) {
  const N = namesNow(); let rx = N.sure.get(st.key);
  if (rx === undefined) { const src = altsRx(ownNames(st).map(p => [...p.flatMap(w => wordAlts(w, 'sure')), ...runAlts(p), ...initialAlts(p)])); N.sure.set(st.key, rx = src ? new RegExp(src, 'gu') : null); }
  return rx;
}
const paperKey = (st, d) => st.key + '\n' + d.pages.map(([path, p]) => boxKey(path, p) + '|' + coverSig(fileByPath(st, path))).join('\n');
// Is anything drawn on this page? A tablet can store handwriting as strokes, so what's in the file can't say: this looks at the page. A white rectangle behind nothing doesn't count.
async function pageInk(page) {
  const v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(1, 1600 / Math.max(v1.width, v1.height)) }), c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const d = ctx.getImageData(0, 0, c.width, c.height).data; c.width = c.height = 0;
  for (let i = 0, n = 0; i < d.length; i += 4) if ((d[i] < 225 || d[i + 1] < 225 || d[i + 2] < 225) && ++n >= 3) return true;
  return false;
}
// 'found', 'none' when a page has something on it but no name, or 'blank'. Blank is only for a page with nothing at all: any picture, however small, could be someone's handwritten name. A page that won't open can't be vouched for.
async function lookForName(st, d) {
  const rx = sureRx(st), docs = new Map(); let has = false;
  try {
    for (const [path, p] of d.pages) {
      if (!docs.has(path)) docs.set(path, await pdfjsLib.getDocument({ data: fileByPath(st, path).data.slice(), isEvalSupported: false }).promise);
      const page = await docs.get(path).getPage(p + 1);
      if (rx && (await autoCovers(page, page.getViewport({ scale: 1 }), rx)).length) return 'found';
      has = has || (await page.getTextContent()).items.some(it => it.str && it.str.trim()) || (await page.getAnnotations({ intent: 'display' })).length > 0 || await scanCover(page) > 0 || await pageInk(page);
      page.cleanup();
    }
    return has ? 'none' : 'blank';
  } catch (er) { console.error(er); return 'none'; }
  finally { for (const js of docs.values()) js.destroy(); }
}
// Lone name words found on many papers of the class: a name in the task sheet, or a word everyone writes (Earth, Bank, Mint). On those papers it isn't anyone's name.
// Kept until the papers, the students or the roster change.
async function classCommon() {
  await ensureCounts();
  const N = namesNow(), list = coverList(), key = list.map(x => paperKey(x.st, x.d)).join('\n');
  if (N.commonKey === key) return N.common;
  const count = new Map(), rx = N.classSrc && list.length >= 3 ? new RegExp(N.classSrc, 'gu') : null;
  if (rx) for (const { st, d } of list) {
    const seen = new Set(), docs = new Map();
    try {
      for (const [path, p] of d.pages) {
        const f = fileByPath(st, path);
        if (!docs.has(path)) docs.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
        const page = await docs.get(path).getPage(p + 1), t = (await page.getTextContent()).items.map(it => thaiPlain(it.str)).join('\n').normalize('NFKC');
        page.cleanup();
        for (const m of t.matchAll(rx)) if (m[0] && rawWords(m[0]).length === 1 && !/[@\d]/.test(m[0])) seen.add(nameFold(m[0]));
      }
    } catch (er) { console.error(er); }
    finally { for (const js of docs.values()) js.destroy(); }
    for (const w of seen) count.set(w, (count.get(w) || 0) + 1);
  }
  const need = Math.max(3, Math.ceil(list.length * 0.4));
  N.commonKey = key;
  return N.common = new Set([...count].filter(([, n]) => n >= need).map(([w]) => w));
}
// What autoCovers needs to weigh a hit on this student's paper.
function shareOpts(st) {
  const N = namesNow();
  N.parts ||= new Set(N.all.flatMap(rawWords).map(nameFold));
  return { common: N.common || new Set(), own: new Set(ownNames(st).flat().map(nameFold)), parts: N.parts };
}
let nameLook = null;
// Goes through every paper not looked at yet. What it finds is kept until the students, the roster or the paper change.
function findNames() {
  if (!nameFindOn()) return Promise.resolve();
  return nameLook ||= (async () => {
    const b = batch, left = () => batch === b ? coverList(true).filter(x => !namesNow().found.has(paperKey(x.st, x.d))) : [];
    try {
      await ensureCounts();
      // Over again if the papers changed while it looked.
      for (let list = left(); list.length; list = left()) for (const x of list) {
        const k = paperKey(x.st, x.d), r = await lookForName(x.st, x.d);
        if (batch !== b) break;
        namesNow().found.set(k, r);
      }
      if (batch) nameFlagsShow();
    } catch (er) { console.error(er); }
    finally { nameLook = null; }
  })();
}
const namesLooking = () => nameFindOn() && (stillCounting() || coverList(true).some(x => !namesNow().found.has(paperKey(x.st, x.d))));
// What to say about this paper, if anything.
function nameFlag(st, d) {
  if (!nameFindOn()) return '';
  const r = namesNow().found.get(paperKey(st, d));
  if (r === 'none') return 'Name not found';
  return r === 'found' && ownNames(st).flat().some(w => NOT_LATIN.test(w)) ? 'Name in another alphabet' : '';
}
// A paper she has checked herself is done with.
const nameFlagged = all => coverList(all).map((x, i) => ({ ...x, i, say: nameFlag(x.st, x.d) })).filter(x => x.say && !coverOk(x.st, x.d));
// Word and text papers can't be boxed in Check the covers, and only their lines with a name on them are covered, so the most that can be done is say which ones don't have the student's name.
function wordNoName(st, f) {
  if (f.virtual || !f.data || (f.kind !== 'docx' && f.kind !== 'text')) return false;
  if (f.kind === 'docx') { wordScore(f); if (f.wtext == null) return true; }
  const t = f.kind === 'docx' ? f.wtext : textOf(f), rx = sureRx(st);
  if (!/\S/.test(t) && !(f.kind === 'docx' && f.wpic)) return false;
  return !rx || t.search(rx) < 0;
}
function wordFlagsHtml() {
  // With finding names off, nothing on a Word paper is covered, so every one is listed.
  const off = !nameFindOn(), list = batch.students.flatMap((st, i) => st.files.filter(f => off ? !f.virtual && f.kind === 'docx' : wordNoName(st, f)).map(f => ({ st, i, f }))), one = list.length === 1;
  if (!list.length) return '';
  return '<div class="bbmiss" id="wordFlags" style="margin-bottom:12px"><b>' + (off ? (one ? 'This Word paper shows' : 'These Word papers show') + ' names.' : (one ? 'This paper' : 'These papers') + ' may show a name.') + '</b> Turn ' + (one ? 'it' : 'them') + ' into PDF pages to cover ' + (off ? 'them' : 'it') + '.<ul class="ccflag">' + list.map(x => '<li><button class="link" data-wp="' + x.i + '">' + esc(x.st.key) + '</button> ' + esc(x.f.name) + '</li>').join('') + '</ul></div>';
}
// The papers the name search doubts, as a short list to open in the check. before: 'before you start' in anonymous grading, which checks every paper.
function nameFlagsHtml(before) {
  const anon = before === 'before you start', word = anon ? wordFlagsHtml() : '';
  if (namesLooking()) return '<p class="muted" style="margin:0 0 12px;font-size:13px">Looking for names…</p>' + word;
  const list = nameFlagged(anon);
  return word + (list.length ? '<div class="bbmiss" style="margin-bottom:12px"><b>Check ' + (list.length === 1 ? 'this one' : 'these') + ' first:</b><ul class="ccflag">' + list.map(x => '<li><button class="link" data-cc="' + x.i + '">' + esc(coverName(x.st, x.k)) + '</button> ' + esc(x.say) + '</li>').join('') + '</ul></div>' : '');
}
// A name in another alphabet can be on any paper she hasn't looked at.
const namesInDoubt = () => nameFindOn() && namesLost() && coverList().some(x => !coverOk(x.st, x.d));
const namePromise = () => !nameFindOn() ? (coverList().every(x => coverOk(x.st, x.d)) ? '' : ', once you’ve boxed the names in Check the covers') : namesInDoubt() ? ', once you’ve boxed the ones it can’t read (see below)' : namesLooking() || nameFlagged().length ? ', once you’ve checked the papers listed below' : '';
function nameFlagsShow() {
  const el = $('#nameFlags'); if (!el) return;
  el.innerHTML = nameFlagsHtml(el.dataset.before);
  if ($('#shPromise')) $('#shPromise').textContent = namePromise();
  if ($('#shMade')) $('#shMade').innerHTML = shareMadeLine();
}
// A file's name as it can be shown right now.
const fileShown = (st, name) => anonOn() && st ? scrub(name, fileRx(st)) : name;
Object.assign(window.__gs, { nameFindOn, coverRx, fileRx, classRx, autoCovers, classCommon, shareOpts, labelCovers, nameFlagged, namesLooking, findNames, wordNoName });
