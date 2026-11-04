/* ---------------- the redaction network: finds what identifies a student beyond the roster (relatives, teachers, nicknames, towns, schools, phone numbers) ---------------- */
// A small neural network whose weights were written by hand, not trained. Each word of the text becomes a row of yes/no clues;
// the hidden units below each look for one pattern in those clues, and the output adds up what they found.
// A second layer then lets a word join a neighbor that was already found, so "Sunridge Middle School" goes as a whole.
// It only adds covers: the roster covering in names.js stays first and is never undone by this.
// Every weight has a reason in the comment beside it. Revisions were made by looking at mistakes on made-up papers only (test/tools/redact).

// Words used in ordinary English, from the 12,000 most common (wordfreq), leaving out any the en_US Hunspell dictionary only spells with a capital letter (names and places).
let RD_WORDS = null;
// Apps and brands students name all the time, capitalized but identifying no one.
const RD_BRANDS = 'instagram tiktok youtube snapchat google discord whatsapp netflix spotify minecraft roblox fortnite iphone ipad xbox playstation nintendo zoom kahoot canva quizlet chatgpt wikipedia facebook twitter reddit pinterest amazon'.split(' ');
// School subjects, languages and nationalities: always capitalized in English, never a person.
const RD_COMMON_PROPER = 'english math maths science history geography biology chemistry physics economics psychology spanish french german chinese mandarin cantonese japanese korean arabic hindi urdu thai vietnamese russian italian portuguese dutch turkish persian hebrew latin greek swahili american british canadian mexican brazilian african european asian australian indian nigerian egyptian christmas easter ramadan eid diwali hanukkah lunar christian muslim jewish hindu buddhist god internet'.split(' ');
function redactWords(list) { RD_WORDS = new Set(list.split('\n').concat(RD_BRANDS, RD_COMMON_PROPER)); }
const RD_FUNC = new Set('a an the and or but if so of to in on at by for from with as is are was were be been am i you he she it we they me him her us them my your his its our their this that these those not no yes do did does have has had will would can could should may might must there here what when where who why how all any some each very just also than then too'.split(' '));
const RD_TITLE = new Set('mr mrs ms miss mx dr prof professor sir madam coach grandma grandpa granny gran nana nan papa uncle auntie aunt teacher'.split(' '));
const RD_REL = new Set('mom mum mother mama dad father brother sister cousin uncle aunt grandma grandpa grandmother grandfather friend neighbor neighbour stepdad stepmom stepmum stepbrother stepsister partner classmate teammate boyfriend girlfriend son daughter wife husband nephew niece tutor bestie'.split(' '));
const RD_GREET = new Set('dear hi hello hey thanks thank sincerely regards wishes cheers love yours from by'.split(' '));
const RD_NAMED = new Set('named called name student author'.split(' '));
const RD_LABEL = new Set('house school team homeroom tutor form club'.split(' '));
const RD_PLACE_BEFORE = new Set('in from near to at town city village lived live moved born'.split(' '));
const RD_STREET = new Set('road rd street st lane ln avenue ave drive dr close way court ct crescent place boulevard blvd terrace'.split(' '));
const RD_SCHOOL = new Set('school academy high college secondary international university elementary primary middle institute house campus'.split(' '));
const RD_MONTH = new Set('january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday'.split(' '));
const RD_BIRTH = new Set('born birthday dob birth'.split(' '));

// Pieces of text: an email, a handle, a run of digits that looks like a phone number, a word, or one mark of punctuation.
const RD_TOKEN = /([\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)|(@[\p{L}\p{N}_.]{2,})|(\+?\(?\d[\d ().-]{5,}\d)|([\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*)|(\n)|(\S)/gu;
const RD_ABBR = /^(st|mt|ft|mr|mrs|ms|dr|prof|jr|sr)$/i;
function rdNameLine(text, t) {
  const a = Math.max(text.lastIndexOf('\n', t.a - 1), text.lastIndexOf('|', t.a - 1)) + 1, e = text.slice(t.b).search(/\n|\|/), part = text.slice(a, e < 0 ? text.length : t.b + e).trim();
  const ws = part.split(/[\s,]+/).filter(Boolean);
  return ws.length >= 2 && ws.length <= 4 && ws.every(w => /^\p{Lu}[\p{L}\p{M}'’-]*$/u.test(w) && !RD_FUNC.has(w.toLowerCase()) && !RD_TITLE.has(w.toLowerCase().replace(/\.$/, '')));
}
const RD_LATIN = /^[\p{Script=Latin}\p{M}\p{N}'’-]+$/u;

function rdTokens(text) {
  const out = [];
  for (const m of text.matchAll(RD_TOKEN)) {
    const kind = m[1] ? 'email' : m[2] ? 'handle' : m[3] ? (m[3].replace(/\D/g, '').length >= 7 ? 'phone' : 'num') : m[4] ? 'word' : m[5] ? 'line' : 'punct';
    if (kind === 'num') { for (const n of m[3].matchAll(/\d+|\S/g)) out.push({ s: n[0], a: m.index + n.index, b: m.index + n.index + n[0].length, kind: /\d/.test(n[0]) ? 'word' : 'punct' }); continue; }
    out.push({ s: m[0], a: m.index, b: m.index + m[0].length, kind });
  }
  return out;
}

// The clues for one word, each 0 or 1.
function rdClues(t, i, words, toks, text) {
  const w = t.s, low = w.toLowerCase(), prev = words[i - 1], prev2 = words[i - 2], next = words[i + 1];
  const between = (x, y) => toks.slice(x.j + 1, y.j).map(z => z.s).join('');   // the punctuation between two words
  const pb = prev ? between(prev, t) : '\n', nb = next ? between(t, next) : '';
  const lowP = prev && prev.s.toLowerCase(), lowP2 = prev2 && prev2.s.toLowerCase(), lowN = next && next.s.toLowerCase();
  const letters = /\p{L}/u.test(w);
  return {
    word: letters ? 1 : 0,
    digits: /^\d+$/.test(w) ? 1 : 0,
    cap: letters && /^\p{Lu}/u.test(w) && !/^\p{Lu}+$/u.test(w.length > 1 ? w : '') ? 1 : 0,
    caps: w.length > 1 && /^\p{Lu}+$/u.test(w) ? 1 : 0,
    ordinary: RD_WORDS && RD_WORDS.has(low) ? 1 : 0,
    func: RD_FUNC.has(low) ? 1 : 0,
    month: RD_MONTH.has(low) ? 1 : 0,
    start: !prev || /[!?:\n"“|]\s*$/.test(pb) || /\.\s*$/.test(pb) && !RD_ABBR.test(prev.s) ? 1 : 0,
    otherScript: letters && !RD_LATIN.test(w) ? 1 : 0,
    // what comes before
    afterTitle: prev && RD_TITLE.has(lowP) && !/[,;]/.test(pb) ? 1 : 0,
    afterRel: prev && RD_REL.has(lowP) && !/[.!?;]/.test(pb) ? 1 : 0,
    afterGreet: prev && RD_GREET.has(lowP) && (/^,?\s*\n?\s*$/.test(pb)) ? 1 : 0,
    afterNamed: prev && RD_NAMED.has(lowP) && /^\s*:?\s*$/.test(pb) ? 1 : 0,
    callsMe: prev && lowP === 'me' && prev2 && /^(calls?|called|call)$/.test(lowP2) ? 1 : 0,
    afterLabel: prev && RD_LABEL.has(lowP) && /^\s*:\s*$/.test(pb) ? 1 : 0,
    label: next && /^\s*:/.test(nb) || !next && /^\s*:/.test(toks.slice(t.j + 1).map(z => z.s).join('')) ? 1 : 0,
    birthDate: (RD_MONTH.has(low) || /^\d{1,4}$/.test(w)) && words.slice(Math.max(0, i - 4), i).some(x => RD_BIRTH.has(x.s.toLowerCase())) ? 1 : 0,
    longDigits: /^\p{L}{0,2}\d{6,}$/u.test(w) ? 1 : 0,
    pronounI: w === 'I' ? 1 : 0,
    nextCap: next && /^\p{Lu}/u.test(next.s) && /^ {1,3}$/.test(text.slice(t.b, next.a)) ? 1 : 0,
    // a line, or a part of one between | marks, that is nothing but two to four capitalized words: a name on a heading (Mia Tan / Bird, Olivia)
    nameLine: rdNameLine(text, t) ? 1 : 0,
    // the end of a part of a heading: a new line, a wide gap, or a | mark comes next
    partEnd: !next || /\n|\||\s{2,}/.test(text.slice(t.b, next.a)) ? 1 : 0,
    titleWord: RD_TITLE.has(low) || RD_GREET.has(low) ? 1 : 0,
    afterPlace: prev && RD_PLACE_BEFORE.has(lowP) ? 1 : 0,
    afterNumber: prev && /^\d{1,5}$/.test(prev.s) ? 1 : 0,
    afterBirth: (prev && RD_BIRTH.has(lowP)) || (prev2 && RD_BIRTH.has(lowP2)) ? 1 : 0,
    // what comes after
    beforeRel: next && /^,\s*$/.test(nb) && (lowN === 'my' || lowN === 'our') ? 1 : 0,
    beforeStreet: next && RD_STREET.has(lowN) && /^\p{Lu}/u.test(next.s) ? 1 : 0,
    beforeSchool: next && RD_SCHOOL.has(lowN) && /^\p{Lu}/u.test(next.s) ? 1 : 0,
    streetWord: RD_STREET.has(low) ? 1 : 0,
    schoolWord: RD_SCHOOL.has(low) ? 1 : 0,
  };
}

// The hidden units. Each fires (ReLU) when the sum of its weighted clues passes its bias, and casts its vote for covering the word.
// "and" units: n clues of weight 1 with bias -(n-1) fire only when all n are there. A weight of -2 or -3 is a veto.
const RD_UNITS = [
  // a capitalized word that isn't an everyday word, in the middle of a sentence: almost always a name or a place
  { why: 'name', w: { cap: 1, word: 1, ordinary: -3, start: -3, month: -3 }, b: -1, out: 3 },
  // the same at the start of a sentence: could be a name, but weaker (Siobhan went... / Photosynthesis is...)
  { why: 'name', w: { cap: 1, word: 1, ordinary: -3, start: 1, month: -3 }, b: -2, out: 2.2 },
  // after Mr, Ms, Coach, Grandma: a name even when it's an everyday word, even Will or May (Coach Stone, Mrs. King, Grandma May)
  { why: 'name', w: { afterTitle: 1, cap: 1 }, b: -1, out: 8 },
  // after my brother, my friend: the same (my sister Grace, my mum May)
  { why: 'name', w: { afterRel: 1, cap: 1 }, b: -1, out: 8 },
  // after Dear, Hi, Thanks, Sincerely, By
  { why: 'name', w: { afterGreet: 1, cap: 1, func: -3, month: -3 }, b: -1, out: 4 },
  // after Name: or named
  { why: 'name', w: { afterNamed: 1, cap: 1, month: -3 }, b: -1, out: 4 },
  // after "calls me": a nickname, however short (calls me An)
  { why: 'nickname', w: { callsMe: 1, cap: 1 }, b: -1, out: 8 },
  // after House: or Team: on a paper's heading
  { why: 'school', w: { afterLabel: 1, cap: 1 }, b: -1, out: 4 },
  // a long number: a student ID
  { why: 'ID number', w: { longDigits: 1 }, b: 0, out: 4 },
  // a name followed by ", my brother"
  { why: 'name', w: { beforeRel: 1, cap: 1 }, b: -1, out: 4 },
  // a word in another alphabet in a paper that is mostly in the Latin one: very likely a name
  { why: 'name', w: { otherScript: 1, latinPaper: 1 }, b: -1, out: 4 },
  // a capitalized word right after "in", "from", "moved to": a town or a place
  { why: 'place', w: { afterPlace: 1, cap: 1, ordinary: -1, start: -3, month: -3 }, b: -1, out: 2.5 },
  // a house number and a street: 87 Larchmont Drive
  { why: 'address', w: { afterNumber: 1, cap: 1, beforeStreet: 1 }, b: -2, out: 4 },
  { why: 'address', w: { digits: 1, nextCapStreet: 1 }, b: -1, out: 4 },
  // two capitalized everyday words after "at" or "to": a place (at Harbor Point, to Cedar Hill)
  { why: 'place', w: { afterPlace: 1, cap: 1, nextCap: 1, start: -3, month: -3, func: -3 }, b: -2, out: 2.5 },
  // a capitalized word before School, Academy, House: a school's name (Sunridge Middle School, Phoenix House)
  { why: 'school', w: { cap: 1, beforeSchool: 1, start: -1 }, b: -1, out: 3 },
  // a birthday: the date after "born on"
  { why: 'birthday', w: { birthDate: 1 }, b: 0, out: 8 },
  { why: 'name', w: { nameLine: 1, cap: 1, month: -3 }, b: -1, out: 4 },
  // everyday words that are almost never names, even capitalized
  { why: '', w: { func: 1 }, b: 0, out: -6 },
  { why: '', w: { caps: 1, ordinary: 1 }, b: -1, out: -2 },
  // I, and words that label a line (House:, Date:)
  { why: '', w: { pronounI: 1 }, b: 0, out: -20 },
  { why: '', w: { titleWord: 1 }, b: 0, out: -20 },
  { why: '', w: { label: 1, afterLabel: -1, afterNamed: -1 }, b: 0, out: -6 },
];
const RD_FIRE = 2;   // the output needed to cover a word

function findPrivate(text, opts = {}) {
  const toks = rdTokens(text); toks.forEach((t, j) => t.j = j);
  const words = toks.filter(t => t.kind === 'word');
  const latin = words.filter(t => RD_LATIN.test(t.s)).length, latinPaper = latin > .7 * words.length ? 1 : 0;
  const hits = [];
  // emails, handles and phone numbers are found by their shape alone
  for (const t of toks) if (t.kind === 'email' || t.kind === 'handle' || t.kind === 'phone') hits.push({ start: t.a, end: t.b, why: t.kind === 'phone' ? 'phone number' : t.kind });
  // layer 1: each word on its own
  const z = words.map((t, i) => {
    const c = rdClues(t, i, words, toks, text); c.latinPaper = latinPaper;
    const nx = words[i + 1]; c.nextCapStreet = nx && /^\p{Lu}/u.test(nx.s) && words[i + 2] && RD_STREET.has(words[i + 2].s.toLowerCase()) ? 1 : 0;
    let sum = 0, why = '', best = 0;
    for (const u of RD_UNITS) {
      let a = u.b; for (const k in u.w) a += u.w[k] * (c[k] || 0);
      const v = Math.max(0, a) * u.out; sum += v; if (v > best) { best = v; why = u.why; }
    }
    return { sum, why, c };
  });
  // layer 2: a capitalized word next to one already found joins it (a first name before a family name, the rest of "Cedar Hill", "Middle School").
  // Only spaces between them, or "Last, First" at the start of a line, or the dot of St.; never a title or a greeting.
  const glued = (x, y) => { const gap = text.slice(x.b, y.a); return /^ {1,3}$/.test(gap) || gap === '.' + ' ' && /^(st|mt|ft)$/i.test(x.s) || gap === ', ' && z[words.indexOf(x)].c.start && !z[words.indexOf(x)].c.ordinary; };
  const t0 = i => words[i].a;
  const z2 = z.map((x, i) => {
    let s = x.sum;
    if (x.c.titleWord || x.c.label || x.c.month || x.c.pronounI || !x.c.cap) return s;
    const touch = [i - 1, i + 1].some(k => words[k] && z[k].sum >= RD_FIRE && (k < i ? glued(words[k], words[i]) : glued(words[i], words[k])));
    // an everyday short word only joins a name it ends (Yasmin Do, then the line ends)
    if (touch && (!x.c.func || x.c.partEnd && !x.c.start) && (!x.c.ordinary || !x.c.start || x.c.schoolWord || x.c.streetWord)) s += x.c.func ? 8.5 : 2.5;
    // the second of two names joined by "and" (thank Mia and May)
    const p1 = words[i - 1], p2 = words[i - 2];
    if (p1 && p2 && p1.s === 'and' && z[i - 2].sum >= RD_FIRE && !x.c.start && /^ $/.test(text.slice(p1.b, t0(i))) && /^ $/.test(text.slice(p2.b, p1.a))) s += x.c.func ? 8.5 : 2.5;
    return s;
  });
  words.forEach((t, i) => { if (z2[i] >= RD_FIRE) hits.push({ start: t.a, end: t.b, why: z[i].why || 'name' }); });
  return hits;
}

if (typeof module !== 'undefined') module.exports = { findPrivate, redactWords, RD_UNITS };
