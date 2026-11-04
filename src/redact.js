/* ---------------- the redaction network: finds what identifies a student beyond the roster (relatives, teachers, nicknames, towns, schools, phone numbers, birthdays) ---------------- */
// A small neural network whose weights were written by hand, not trained. Each word of the text becomes a row of clues;
// the hidden units below each look for one pattern in those clues, and the output adds up what they found.
// A second layer then lets a word join a neighbor that was already found, so "Sunridge Middle School" goes as a whole.
// Emails, phone numbers, postcodes and dates are found by their shape first.
// It only adds covers: the roster covering in names.js stays first and is never undone by this.
// Every weight has a reason beside it. Revisions were made by looking at mistakes on made-up papers only (test/tools/redact).

// Two lists it knows (see redact-lists-LICENSE.txt): everyday English words (SCOWL, up to size 35) and given and family names in the Latin alphabet from many countries (Faker).
let RD_WORDS = null, RD_NAMES = new Set(), RD_FAMOUS = new Set(), RD_TITLES = null;
// Apps and brands students name all the time, capitalized but identifying no one.
const RD_BRANDS = 'instagram tiktok youtube snapchat google discord whatsapp netflix spotify minecraft roblox fortnite iphone ipad xbox playstation nintendo zoom kahoot canva quizlet chatgpt wikipedia facebook twitter reddit pinterest amazon'.split(' ');
// School subjects, languages and nationalities: always capitalized in English, never a person.
const RD_COMMON_PROPER = 'english math maths science history geography biology chemistry physics economics psychology spanish french german chinese mandarin cantonese japanese korean arabic hindi urdu thai vietnamese russian italian portuguese dutch turkish persian hebrew latin greek swahili american british canadian mexican brazilian african european asian australian indian nigerian egyptian christmas easter ramadan eid diwali hanukkah lunar christian muslim jewish hindu buddhist god internet'.split(' ');
function redactWords(words, names, famous) {
  RD_WORDS = new Set(words.split('\n').concat(RD_BRANDS, RD_COMMON_PROPER));
  if (names) RD_NAMES = new Set(names.split('\n'));
  // authors, characters and famous people (src/redact-public.txt): lines starting with # are notes
  if (famous) {
    const lines = famous.split('\n').filter(l => l && !/^#/.test(l));
    RD_FAMOUS = new Set(lines.filter(l => !/^= /.test(l)).join(' ').split(/\s+/).filter(Boolean).map(w => w.replace(/['’]s$/, '')));
    // titles: a cover inside one (Things Fall Apart) is the book's
    const esc = t => t.slice(2).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
    RD_TITLES = new RegExp('(?<![\\p{L}])(?:' + lines.filter(l => /^= /.test(l)).map(esc).sort((a, b) => b.length - a.length).join('|') + ')(?![\\p{L}])', 'gu');
  }
}
const rdSet = s => new Set(s.split(' '));
const RD_FUNC = rdSet('a an the and or but if so of to in on at by for from with as is are was were be been am i you he she it we they me him her us them my your his its our their this that these those not no yes did does have has had would can could should might must there here what when where who why how all any some each very just also than then too');
const RD_TITLE = rdSet('mr mrs ms miss mx dr prof professor sir madam madame monsieur coach grandma grandpa granny gran grandad granddad nana nan papa uncle auntie aunty aunt teacher principal headteacher sensei imam pastor rabbi señor señora');
const RD_REL = rdSet('mom mum mother mama dad father brother sister twin cousin uncle aunt auntie grandma grandpa grandmother grandfather grandad nan nana godmother godfather friend bestie neighbor neighbour stepdad stepmom stepmum stepbrother stepsister sibling partner classmate teammate roommate boyfriend girlfriend crush son daughter wife husband nephew niece tutor mentor counselor counsellor coach');
const RD_GREET = rdSet('dear hi hello hey morning afternoon evening thanks thank thx sincerely regards wishes cheers love yours best warmly from by');
const RD_NAMED = rdSet('named called nicknamed name student author submitted');
const RD_LABEL = rdSet('house school team homeroom tutor form club candidate');
const RD_PLACE_BEFORE = rdSet('in from near to at town city village lived live lives moved born outside visited visit stayed left leave leaving toward towards past across into around');
const RD_STREET = rdSet('road rd street st lane ln avenue ave drive dr close way court ct crescent place pl boulevard blvd terrace gardens grove row square mews walk circle highway hwy parkway');
const RD_SCHOOL = rdSet('school academy high college secondary international university elementary primary middle institute house campus');
const RD_MONTH = rdSet('january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday mondays tuesdays wednesdays thursdays fridays saturdays sundays');
// Words that often open a sentence and are also someone's given name somewhere (Even is Norwegian): at the start, these never join a name after them.
const RD_OPENER = rdSet('even also only just still then now maybe perhaps sometimes today yesterday tomorrow later soon after before since while once unlike every both either neither without according like ask tell thank dear honestly finally overall however next last first second third');
const RD_PARTICLE = rdSet('de van von der den da di del della dos das du le la al el bin ibn bint ben ter');
// What people do in a sentence: a capitalized word right before one of these is very likely someone (Mateo recorded, Grace quizzed me).
const RD_DOES = rdSet('said says told tells lent lends asked asks thinks thought helped helps gave gives took takes wants wanted likes liked loves loved lives lived came comes went goes recorded measured wrote writes drew taught teaches quizzed explained explains pointed agreed disagreed laughed cried called calls texted sent brought made makes showed shows sat sits played plays works worked studied practised practiced drove drives picked picks visited reminds reminded');
// "Mo is my nickname", "Mo is what my friends call me", "Mo and I"
const RD_IS_WHO = /^(?:is|was) (?:my|what|our|the one)\b|^and I\b|^'s\b|^’s\b/;
// Before a name: "help from May", "reminds me of Dawn", "with Robin"
const RD_PERSON_PREP = rdSet('with and of from to by for thank thanks met told asked like ask tell call text email beside behind except');
const RD_ID_CUE = rdSet('id number no candidate #');
// Endings and letter pairs that names have and English words don't, and the other way round. A hand-made guess, used only for words on neither list.
const RD_NAME_END = /(?:a|ia|ya|ah|iah|elle|ette|ina|ana|ika|ita|ito|ino|o|i|ov|ova|ev|eva|enko|sky|ski|ska|vic|vich|ic|sson|sen|berg|stein|ez|az|oglu|yan|dze|shvili|uddin|ullah|preet|deep|jit|esh|endra|kumar|ola|emi|ade|ayo|chukwu|nna|nh|uy|ui|ou)$/;
const RD_NAME_INSIDE = /kh|zh|dzh|^ts|^ng|^mb|^nd|^nk|^ny|^tsh|^hl|^dl|^xh|aa|ii|uu|yy|ij|q(?!u)|[äöüéèêëñçãõőłşğışțęąřčžýśźćđ]/;
const RD_WORD_END = /(?:tion|sion|ment|ness|ity|ism|ist|ology|logy|ize|ise|ous|ive|able|ible|ful|less|ship|hood|ics|ance|ence|ency|ancy|ward|wise|graphy|osis|esis|asis|ally|ly|ing|ed)$/;
const RD_WORD_START = /^(?:photo|bio|geo|hydro|micro|macro|inter|trans|anti|multi|semi|non|over|under|super|auto|tele|thermo|electro|un|re|dis|pre)(?=[a-z]{4})/;

// A date in any common form; the year, if there is one, is in a group.
const RD_MON = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\\.?';
const RD_ORD = '\\d{1,2}(?:st|nd|rd|th)?';
const RD_DATE = new RegExp('(?:' + RD_MON + '\\s+' + RD_ORD + '(?:,?\\s+(\\d{4}))?|(?:the\\s+)?' + RD_ORD + '\\s+(?:of\\s+)?' + RD_MON + '(?:,?\\s+(\\d{4}))?|\\b\\d{1,2}[/.]\\d{1,2}[/.](\\d{4}|\\d{2})\\b|\\b(\\d{4})-\\d{1,2}-\\d{1,2}\\b)', 'g');
const RD_BIRTH_CUE = /\b(?:born|birthday|birth|b\.|dob|d\.o\.b|turned|turn)\b[^.!?\n]*$/i;
// A UK or Canadian postcode, or a 5-digit zip after a town.
const RD_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b|\b[A-Z]\d[A-Z] ?\d[A-Z]\d\b|(?<=\p{Lu}\p{Ll}+,? )\d{5}(?:-\d{4})?\b/gu;

// Pieces of text: an email, a handle, a run of digits that looks like a phone number, a word, or one mark of punctuation.
const RD_TOKEN = /([\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)|(@[\p{L}\p{N}_.]{2,})|(\+?\(?\d[\d ().-]{5,}\d)|([\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*)|(\n)|(\S)/gu;
const RD_ABBR = /^(st|mt|ft|mr|mrs|ms|dr|prof|jr|sr|[A-Z])$/;
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
// A line, or a part of one between | marks, that is nothing but two to four capitalized words: a name on a heading (Mia Tan / Bird, Olivia / VARGA ADAEZE)
function rdNameLine(text, t) {
  const a = Math.max(0, ...['\n', '|', ' / ', ' - '].map(sep => { const k = text.lastIndexOf(sep, t.a - 1); return k < 0 ? 0 : k + sep.length; })), e = text.slice(t.b).search(/\n|\|| \/ | - /), part = text.slice(a, e < 0 ? text.length : t.b + e).trim();
  const ws = part.replace(/\(([^()]{1,30})\)$/, '$1').split(/[\s,]+/).filter(Boolean);
  return ws.length >= 2 && ws.length <= 4 && ws.every(w => /^\p{Lu}[\p{L}\p{M}'’-]*$/u.test(w) && !RD_FUNC.has(w.toLowerCase()) && !RD_TITLE.has(w.toLowerCase().replace(/\.$/, '')) && !RD_MONTH.has(w.toLowerCase()));
}
// How much a word looks like a name from its letters alone: above 0 for names, below for English words.
function rdShape(low) {
  let s = 0;
  if (RD_NAME_END.test(low)) s += 1;
  if (RD_NAME_INSIDE.test(low)) s += 1;
  if (RD_WORD_END.test(low)) s -= 2;
  if (RD_WORD_START.test(low)) s -= 1;
  return s;
}
// Short forms of the roster's given names: Nik for Nikhil, Enzo for Lorenzo.
function rdNicks(roster) {
  const out = new Set();
  for (const n of roster || []) {
    const g = (String(n).match(/[\p{L}\p{M}]+/gu) || [])[0]; if (!g || g.length < 4) continue;
    const low = g.toLowerCase();
    for (let k = 2; k < low.length; k++) { out.add(low.slice(0, k)); if (k >= 3) out.add(low.slice(-k)); }
  }
  for (const w of RD_FUNC) out.delete(w);
  // the roster's family names and given names, for a name written next to them that the roster doesn't have
  out.parts = new Set((roster || []).flatMap(n => (String(n).match(/[\p{L}\p{M}'’-]+/gu) || []).map(w => w.toLowerCase())));
  return out;
}

// The clues for one word, each 0 or 1.
function rdClues(t, i, words, toks, text, nicks) {
  const w = t.s, low = w.toLowerCase(), prev = words[i - 1], prev2 = words[i - 2], next = words[i + 1];
  const between = (x, y) => toks.slice(x.j + 1, y.j).map(z => z.s).join('');   // the punctuation between two words
  const pb = prev ? between(prev, t) : '\n', nb = next ? between(t, next) : '';
  const lowP = prev && prev.s.toLowerCase(), lowP2 = prev2 && prev2.s.toLowerCase(), lowN = next && next.s.toLowerCase();
  const letters = /\p{L}/u.test(w), ordinary = RD_WORDS && RD_WORDS.has(low) ? 1 : 0, listed = RD_NAMES.has(low) ? 1 : 0;
  const start = !prev || /[!?:\n"“|(]\s*$/.test(pb) || /^\s*[-–—]\s*$/.test(pb) || /\.\s*$/.test(pb) && !RD_ABBR.test(prev.s) ? 1 : 0;
  const after = text.slice(t.b, t.b + 24), shape = letters && !ordinary && !listed ? rdShape(low) : 0;
  return {
    word: letters ? 1 : 0,
    digits: /^\d+$/.test(w) ? 1 : 0,
    cap: letters && /^\p{Lu}/u.test(w) && !(w.length > 1 && /^\p{Lu}+$/u.test(w)) ? 1 : 0,
    caps: w.length > 1 && /^\p{Lu}+$/u.test(w) ? 1 : 0,
    lower: letters && /^\p{Ll}/u.test(w) ? 1 : 0,
    ordinary, listed,
    // a word on neither list that looks like a name, or like an English word made from parts
    nameShape: shape > 0 ? 1 : 0, wordShape: shape < 0 ? 1 : 0,
    nick: nicks.has(low) && !ordinary ? 1 : 0,
    nickOrd: nicks.has(low) && ordinary ? 1 : 0,
    func: RD_FUNC.has(low) ? 1 : 0,
    month: RD_MONTH.has(low) ? 1 : 0,
    start,
    otherScript: letters && !RD_LATIN.test(w) ? 1 : 0,
    titleWord: RD_TITLE.has(low) || RD_GREET.has(low) ? 1 : 0,
    pronounI: w === 'I' ? 1 : 0,
    // what comes before
    afterTitle: prev && RD_TITLE.has(lowP) && !/[,;:]/.test(pb) ? 1 : 0,
    afterRel: prev && RD_REL.has(lowP) && !/[.!?;:]/.test(pb) ? 1 : 0,
    // "by" signs a paper only at the start of a line or after written, submitted, essay (a speech by Ella Baker is not a signature)
    afterGreet: prev && (RD_GREET.has(lowP) || lowP === 'you' && lowP2 === 'thank') && /^,?\s*\n?\s*$/.test(pb) && (lowP !== 'by' || !prev2 || /\n\s*$/.test(text.slice(Math.max(0, prev.a - 3), prev.a)) || /^(written|submitted|essay|homework|work|report|draft|poem|story|love|made|all)$/.test(lowP2)) ? 1 : 0,
    afterNamed: prev && RD_NAMED.has(lowP) && /^\s*:?\s*$/.test(pb) || prev && lowP === 'by' && prev2 && lowP2 === 'submitted' ? 1 : 0,
    callsMe: prev && prev2 && (/^(me|him|her)$/.test(lowP) && /^(calls?|called|call)$/.test(lowP2) || lowP === 'as' && lowP2 === 'known' || lowP === 'by' && /^(go|goes|went)$/.test(lowP2) || lowP === 'is' && lowP2 === 'name' || /^i[’']m$/.test(lowP)) ? 1 : 0,
    dashSign: /^\s*[-–—]\s*$/.test(pb) && (!prev || /\n\s*[-–—]\s*$/.test(text.slice(Math.max(0, t.a - 4), t.a)) || i === 0) || /(^|\n)[ \t]*[-–—][ \t]*$/.test(text.slice(Math.max(0, t.a - 8), t.a)) ? 1 : 0,
    afterLabel: prev && RD_LABEL.has(lowP) && /^\s*:\s*$/.test(pb) ? 1 : 0,
    label: /^\s*:/.test(nb) || !next && /^\s*:/.test(after) ? 1 : 0,
    // the words of "Student ID #123" or "Candidate number" themselves
    idLabel: /^(student|candidate)$/.test(low) && /^\s*(id|number|no)\b/i.test(after) || low === 'id' && /^\s*[#:]?\s*[a-z]{0,2}\d/i.test(after) ? 1 : 0,
    afterPlace: prev && RD_PLACE_BEFORE.has(lowP) ? 1 : 0,
    afterNumber: prev && /^\d{1,5}$/.test(prev.s) ? 1 : 0,
    afterPerson: prev && RD_PERSON_PREP.has(lowP) && !/[.!?;:]/.test(pb) ? 1 : 0,
    afterIdCue: prev && (RD_ID_CUE.has(lowP) || /#\s*$/.test(pb) || prev2 && RD_ID_CUE.has(lowP2) && /^(is|was|=)$/.test(lowP)) && w.replace(/\D/g, "").length >= 3 ? 1 : 0,
    // what comes after
    beforeRel: next && /^,\s*$/.test(nb) && (lowN === 'my' || lowN === 'our') ? 1 : 0,
    beforeDoes: next && /^ $/.test(text.slice(t.b, next.a)) && RD_DOES.has(lowN) || RD_IS_WHO.test(after.replace(/^ /, '')) ? 1 : 0,
    beforeStreet: next && RD_STREET.has(lowN) && /^\p{Lu}/u.test(next.s) ? 1 : 0,
    beforeSchool: next && RD_SCHOOL.has(lowN) && /^\p{Lu}/u.test(next.s) ? 1 : 0,
    nextCap: next && /^\p{Lu}/u.test(next.s) && /^ {1,3}$/.test(text.slice(t.b, next.a)) ? 1 : 0,
    nextCapStreet: next && /^\p{Lu}/u.test(next.s) && words[i + 2] && RD_STREET.has(words[i + 2].s.toLowerCase()) ? 1 : 0,
    nextDigit: /^,?\s*\d/.test(after) ? 1 : 0,
    streetWord: RD_STREET.has(low) ? 1 : 0,
    schoolWord: RD_SCHOOL.has(low) ? 1 : 0,
    nameLine: rdNameLine(text, t) ? 1 : 0,
    besideRoster: next && nicks.parts && nicks.parts.has(lowN) && !nicks.parts.has(low) && /^ $/.test(text.slice(t.b, next.a)) && !RD_FAMOUS.has(w) ? 1 : 0,
    andI: next && words[i + 2] && lowN === 'and' && words[i + 2].s === 'I' && /^ $/.test(text.slice(t.b, next.a)) ? 1 : 0,
    // the end of a part of a heading: a new line, a wide gap, or a | mark comes next
    partEnd: !next || /\n|\||\s{2,}/.test(text.slice(t.b, next.a)) ? 1 : 0,
    single: /^\p{Lu}$/u.test(w) ? 1 : 0,
    // "join the Falcons", "play for the Kites": a team
    afterJoinThe: prev && lowP === 'the' && prev2 && /^(join|joined|joining|for|with|on)$/.test(lowP2) ? 1 : 0,
    opener: RD_OPENER.has(low) ? 1 : 0,
    longDigits: /^\p{L}{0,2}\d{6,}$/u.test(w) ? 1 : 0,
    codeLike: /^\p{L}{2,4}\d{3,6}$/u.test(w) ? 1 : 0,
  };
}

// The hidden units. Each fires (ReLU) when the sum of its weighted clues passes its bias, and casts its vote for covering the word.
// "and" units: n clues of weight 1 with a bias of -(n-1) fire only when all n are there. A weight of -3 is a veto.
const RD_UNITS = [
  // ---- names from capital letters and the word lists
  // a capitalized word that isn't an everyday word, in the middle of a sentence: almost always a name or a place
  { why: 'name', w: { cap: 1, word: 1, ordinary: -3, start: -3, month: -3 }, b: -1, out: 3 },
  // the same at the start of a sentence: a name, or a rarer word (Mateo went... / Photosynthesis is...). Leans toward covering.
  { why: 'name', w: { cap: 1, word: 1, ordinary: -3, start: 1, month: -3, wordShape: -3 }, b: -2, out: 2.2 },
  // ...and more sure when the name list knows it, or the letters look like a name
  { why: 'name', w: { cap: 1, listed: 1, ordinary: -3, start: 1, month: -3 }, b: -2, out: 1.5 },
  { why: 'name', w: { cap: 1, nameShape: 1, start: 1 }, b: -2, out: 1.5 },
  // a capitalized everyday word in the middle of a sentence that is also a given name: Grace, Robin, Pearl
  { why: 'name', w: { cap: 1, listed: 1, ordinary: 1, start: -3, month: -3, func: -3, titleWord: -3 }, b: -2, out: 2.5 },
  // a capitalized word at the start of a sentence, right before "said", "told", "is my": someone (Grace quizzed me, Mo is my nickname)
  { why: 'name', w: { cap: 1, start: 1, beforeDoes: 1, listed: 1, func: -3, month: -3 }, b: -3, out: 4 },
  { why: 'name', w: { cap: 1, start: 1, beforeDoes: 1, ordinary: -1, func: -3, month: -3 }, b: -2, out: 4 },
  // after "from", "with", "of": an everyday-word given name, even a month's (help from May, reminds me of Dawn)
  { why: 'name', w: { cap: 1, afterPerson: 1, listed: 1, start: -3, nextDigit: -3, func: -3 }, b: -2, out: 2.5 },
  // a short form of a roster student's given name (Nik, Enzo)
  { why: 'nickname', w: { cap: 1, nick: 1 }, b: -1, out: 4 },
  { why: 'nickname', w: { cap: 1, nickOrd: 1, start: -3 }, b: -1, out: 2.5 },
  // ---- names from the words around them
  // after Mr, Ms, Coach, Grandma: a name even when it's an everyday word, even Will or May (Coach Stone, Mrs. King, Grandma May)
  { why: 'name', w: { afterTitle: 1, cap: 1 }, b: -1, out: 8 },
  // after my brother, my friend: the same (my sister Grace, my mum May), and in small letters if the name list knows it (my friend mateo)
  { why: 'name', w: { afterRel: 1, cap: 1 }, b: -1, out: 8 },
  { why: 'name', w: { afterRel: 1, lower: 1, listed: 1, ordinary: -3 }, b: -2, out: 4 },
  // after Dear, Hi, Thanks, Best wishes
  { why: 'name', w: { afterGreet: 1, cap: 1, func: -3, month: -3 }, b: -1, out: 4 },
  { why: 'name', w: { afterGreet: 1, lower: 1, listed: 1, ordinary: -3 }, b: -2, out: 4 },
  // after Name:, named, Submitted by
  { why: 'name', w: { afterNamed: 1, cap: 1, month: -3 }, b: -1, out: 4 },
  // after "calls me", "known as", "my name is", "I'm": a nickname, however short (calls me An)
  { why: 'nickname', w: { callsMe: 1, cap: 1 }, b: -1, out: 8 },
  { why: 'nickname', w: { callsMe: 1, caps: 1 }, b: -1, out: 8 },
  // a name signed after a dash at the end (- Mo)
  { why: 'name', w: { dashSign: 1, cap: 1, func: -3 }, b: -1, out: 4 },
  { why: 'name', w: { dashSign: 1, caps: 1, func: -3 }, b: -1, out: 4 },
  // a capitalized word right before a roster student's family name or right after their given name: their English name or a
  // name the roster doesn't have (Dragon Han, when the roster says Haoran Han)
  { why: 'name', w: { besideRoster: 1, cap: 1, func: -3, month: -3, titleWord: -3 }, b: -1, out: 4 },
  // the first of "Apple and I": someone the student did something with
  { why: 'name', w: { andI: 1, cap: 1, func: -3, month: -3, titleWord: -3 }, b: -1, out: 2.5 },
  // a name followed by ", my brother"
  { why: 'name', w: { beforeRel: 1, cap: 1 }, b: -1, out: 4 },
  // a heading line with nothing but a name (Mia Tan / VARGA ADAEZE)
  { why: 'name', w: { nameLine: 1, cap: 1, month: -3 }, b: -1, out: 4 },
  { why: 'name', w: { nameLine: 1, caps: 1, ordinary: -1 }, b: -1, out: 4 },
  // a word in another alphabet in a paper that is mostly in the Latin one: very likely a name
  { why: 'name', w: { otherScript: 1, latinPaper: 1 }, b: -1, out: 4 },
  // ---- places and schools
  // a capitalized word right after "in", "from", "moved to": a town or a place
  { why: 'place', w: { afterPlace: 1, cap: 1, ordinary: -1, start: -3, month: -3 }, b: -1, out: 2.5 },
  // two capitalized everyday words after "at" or "to": a place (at Harbor Point, to Cedar Hill)
  { why: 'place', w: { afterPlace: 1, cap: 1, nextCap: 1, start: -3, month: -3, func: -3 }, b: -2, out: 2.5 },
  // a house number and a street: 87 Larchmont Drive
  { why: 'address', w: { afterNumber: 1, cap: 1, beforeStreet: 1 }, b: -2, out: 4 },
  { why: 'address', w: { digits: 1, nextCapStreet: 1 }, b: -1, out: 4 },
  // a capitalized word before School, Academy, House: a school's name (Sunridge Middle School, Phoenix House)
  { why: 'school', w: { cap: 1, beforeSchool: 1 }, b: -1, out: 3 },
  { why: 'team', w: { afterJoinThe: 1, cap: 1, start: -3, func: -3 }, b: -1, out: 2.5 },
  // after House: or Team: on a paper's heading
  { why: 'school', w: { afterLabel: 1, cap: 1 }, b: -1, out: 4 },
  // ---- numbers
  { why: 'ID number', w: { longDigits: 1 }, b: 0, out: 4 },
  { why: 'ID number', w: { codeLike: 1 }, b: 0, out: 4 },
  { why: 'ID number', w: { afterIdCue: 1 }, b: 0, out: 8 },
  // ---- what is almost never a name, even capitalized
  { why: '', w: { func: 1 }, b: 0, out: -6 },
  { why: '', w: { caps: 1, ordinary: 1 }, b: -1, out: -2 },
  { why: '', w: { pronounI: 1 }, b: 0, out: -20 },
  // a single capital letter on its own (P.S., a), unless it joins a name as an initial in layer 2
  { why: '', w: { single: 1, afterTitle: -1, afterGreet: -1, dashSign: -1 }, b: 0, out: -6 },
  { why: '', w: { titleWord: 1 }, b: 0, out: -20 },
  { why: '', w: { idLabel: 1 }, b: 0, out: -20 },
  // words that label a line (House:, Date:)
  { why: '', w: { label: 1, afterLabel: -1, afterNamed: -1 }, b: 0, out: -6 },
];
const RD_FIRE = 2;   // the output needed to cover a word
// Clues that say outright that a word is someone's name, a school or a number (after Mr, my sister, Dear, Name:, before School).
// A cover made by these is sure, and the decision model below never takes it off. A town after "in" or a team after "join the" is fairly sure.
const RD_SURE = new Set('afterTitle afterRel afterGreet afterNamed callsMe dashSign beforeRel nameLine otherScript beforeStreet nextCapStreet beforeSchool afterLabel nick longDigits codeLike afterIdCue'.split(' '));
const RD_FAIR = new Set(['afterPlace', 'afterJoinThe']);
RD_UNITS.forEach(u => { const k = Object.keys(u.w).filter(k => u.w[k] > 0); u.sure = k.some(k => RD_SURE.has(k)) ? 2 : k.some(k => RD_FAIR.has(k)) ? 1 : 0; });

// ---- Chinese writing. Chinese has no capitals and no spaces, so names are found from the family names people have (王, 李, 欧阳)
// and the words around them: 我叫, 同桌, 妈妈 before a name; 老师, 同学, 阿姨 after a family name; 说, 告诉, 和我 after a name;
// a line that is nothing but a name. Hand-written like the rest.
const ZH_SURNAME = new Set([...'王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤常温康施文牛樊葛邢安齐易乔伍庞颜倪庄聂章鲁岳翟殷詹申欧耿关兰焦俞左柳甘祝包宁尚符舒阮柯纪梅童凌毕单季裴霍涂成苗谷盛曲翁冉骆蓝路游辛靳管柴蒙鲍华喻祁蒲房滕屈饶解牟艾尤阳时穆农司卓古吉缪简车项连芦麦褚娄窦戚岑景党宫费卜冷晏席卫米柏宗瞿桂全佟应臧闵苟邬边卞姬师仇栾隋商刁沙荣巫寇桑郎甄丛仲虞敖巩佘池查麻苑迟邝'].concat(['欧阳', '司马', '上官', '诸葛', '东方', '慕容', '令狐', '皇甫', '尉迟', '公孙', '夏侯', '长孙', '宇文', '司徒']));
// family names that are also very common characters: only taken as a name with a clear clue before or after
const ZH_COMMON_SURNAME = new Set([...'和时明全应成车包关文安方万向于白高常华单解司师古吉简连景党宫费冷席米宗边商沙荣丛仲池查麻迟路游曲尚符易齐康温牛甘左']);
// characters that end a name or can't be in one: grammar words, pronouns, verbs that follow a name, numbers and measure words
const ZH_NOT_GIVEN = new Set([...'的了是在和说也就都又还把被给对很不没着过吧呢吗啊呀们个这那我你他她它有去来到上下里问告诉笑跑拿带回答喊叫二三四五六七八九十百千年号时候老师同学妈爸哥姐弟妹先生女士姨叔爷奶公婆舅姑与跟及或而但所该，。、！？；：“”‘’（）《》【】…—·']);
// words after a family name or a full name that say it's a person: 王老师, 李明同学, 张阿姨
const ZH_AFTER_TITLE = /^(老师|同学|先生|女士|小姐|阿姨|叔叔|伯伯|爷爷|奶奶|校长|教练|医生|大夫|主任|班主任|教授|师傅|老板|经理)/;
// words just before a name that say it's a person: 我叫, 同桌, 我妈妈, 作者：
const ZH_BEFORE = /(亲爱的|尊敬的|敬爱的|我叫|叫做|名叫|名字是|名字叫|(?:^|[\s，。！？；：、])我是|老妈|老爸|大伯|大妈|伯伯|伯母|婶婶|舅妈|小姨|大姨|姨妈|姑妈|姑父|姨父|舅舅|表叔|堂叔|嫂子|姐夫|孙女|孙子|女儿|儿子|侄子|侄女|外甥|学生|师傅|教练|姓名[:：]\s*|名字[:：]\s*|作者[:：]\s*|学生[:：]\s*|署名[:：]\s*|同桌|同学|好朋友|朋友|闺蜜|好友|室友|邻居|班长|队长|组长|表哥|表姐|表弟|表妹|堂哥|堂姐|堂弟|堂妹|哥哥|姐姐|弟弟|妹妹|爸爸|妈妈|爷爷|奶奶|外公|外婆|姥姥|姥爷|叔叔|阿姨|舅舅|姑姑|老师|——|—|-\s*)$/;
// words after a name that say someone did something: 李明说, 王芳告诉我, 张伟和我
const ZH_AFTER_DOES = /^(说|问|告诉|批改|讲|教|写|看|来|去|走|送|买|做|请|帮|带|没|在|很|非常|不|会|要|想|刚|才|打|听|唱|画|哭|喜欢|觉得|认为|知道|拿着|站|坐|跳|玩|吃|喝|笑|跑|拿|带|回答|喊|叫|和我|跟我|是我|对我|给我|帮我|陪我|教我|让我|一起|也|就|又|还|都|一边|正在|突然|把|总是|每天|常常|已经|同学|今年|今天|昨天|是一个|是个|的妈妈|的爸爸|的家)/;
// everyday words that start with a family name's character (高兴 is happy, not Mr Gao)
const ZH_WORDS = new Set(('全班 全校 全体 全年 全身 全都 全是 王国 王子 高兴 高中 高大 高山 高考 高级 高速 张开 张望 黄色 黄昏 黄金 白色 白天 白云 白菜 方法 方面 方向 方便 方式 马上 马路 周末 周围 周年 林子 树林 石头 江河 江南 何时 何必 何况 万一 万物 万里 于是 钱包 金色 金子 文化 文章 文字 史书 毛衣 毛巾 毛笔 龙舟 陈旧 李子 杨树 朱红 胡同 胡乱 孙子 宋朝 唐朝 明朝 明天 明白 明亮 清朝 汉朝 韩国 秦朝 吴国 许多 许久 许愿 丁点 常常 常见 夏天 夏日 夏季 雷声 雷雨 云朵 黄河 田野 田地 叶子 程度 苏醒 曾经 任何 任务 任性 沈默 江水 钟表 钟声 陆地 陆续 汪洋 范围 金钱 安全 安静 安排 关于 关心 关系 时候 时间 时光 和平 和谐 全部 全家 应该 成功 成绩 成长 车站 包括 包子 齐心 康复 温暖 温柔 牛奶 甘心 左边 路上 路边 游戏 游泳 曲子 尚未 符合 易于 容易 华丽 单独 解决 司机 师傅 古代 古老 吉利 简单 连续 景色 党员 宫殿 费用 冷静 席位 米饭 宗教 边上 商店 沙发 荣誉 丛林 池塘 查看 麻烦 迟到 向前 向往 汤圆 孔雀 孟夏 熊猫 秦岭 邱陵 尹某 薛定 段落 雷电 侯门 龙卷 陶醉 黎明 贺卡 顾客 顾问 郝然 龚某 邵某 严肃 严格 武器 武术 戴上 莫名 莫非 余下 杜绝 魏晋 吕剧 姚明 卢沟 姜汤 崔嵬 谭某 潘家 蒋氏 蔡伦 廖廓 贾氏 韦氏 付出 付款 邹氏 欧洲 东方 诸位 宇宙 阳光 太阳 牛顿 柳树 梅花 兰花 桂花 童年 童话 凌晨 毕业 季节 裴氏 霍乱 涂抹 苗条 谷物 盛开 翁婿 骆驼 蓝色 蓝天 辛苦 管理 柴火 蒙古 鲍鱼 喻意 蒲公 房间 房子 屈服 饶恕 艾草 尤其 穆斯 农民 农村 卓越 车子 项目 芦苇 麦子 戚戚 岑寂 卜卦 晏起 卫生 柏树 瞿然 全国 佟氏 应用 闵行 边疆 卞氏 姬氏 仇恨 商量 沙滩 巫婆 寇仇 桑树 郎中 甄别 仲夏 虞美 敖包 巩固 池水 查找 苑囿 迟早 宁静 宁愿 包容 祝福 祝贺 甘甜 焦急 焦虑 俞允 章节 鲁莽 岳父 翟某 殷勤 申请 耿直 关门 兰州 柯南 纪律 纪念 梅雨 成为 舒服 舒适 阮囊 冉冉 席子 简直 党史 吉他 古诗 景点').split(' '));
// writers and characters taught in Chinese class: never a student (鲁迅, 李白, 闰土, 林黛玉)
const ZH_FAMOUS = ('鲁迅 李白 杜甫 苏轼 白居易 王维 孟子 老子 庄子 孔子 屈原 毛泽东 孙中山 曹雪芹 林黛玉 贾宝玉 薛宝钗 王熙凤 诸葛亮 刘备 关羽 张飞 曹操 孙权 孙悟空 猪八戒 唐僧 沙僧 武松 宋江 林冲 鲁智深 李逵 祥子 朱自清 冰心 巴金 老舍 莫言 余华 福贵 闰土 孔乙己 阿Q 陶渊明 范仲淹 欧阳修 岳飞 文天祥 司马迁 秦始皇 李清照 辛弃疾 陆游 王安石 韩愈 柳宗元 曹植 王昌龄 孟浩然 杜牧 李商隐 王勃 贺知章 骆宾王 刘禹锡 杨绛 钱钟书 沈从文 史铁生 汪曾祺 萧红 张爱玲 郭沫若 闻一多 徐志摩 艾青 海子 顾城 舒婷 雷锋 钱学森 袁隆平 屠呦呦 邓稼先 詹天佑 华罗庚 李时珍 张衡 祖冲之 蔡伦 毕昇 郑和 花木兰 杨过 小龙女 郭靖 黄蓉 哪吒 嫦娥 后羿 女娲 盘古 刘慈欣 罗辑 叶文洁 汪淼 姚明 刘翔 李娜 郎平 谷爱凌').split(' ');
const ZH_HAN = /\p{Script=Han}/u;

function rdChinese(text, opts = {}) {
  const hits = [], push = (a, b, why, sure) => hits.push({ start: a, end: b, why, sure, person: sure === 2 && why !== 'phone number' && why !== 'ID number' ? 1 : 0 });
  const han = c => c && ZH_HAN.test(c) && !ZH_NOT_GIVEN.has(c);
  const famousAt = i => ZH_FAMOUS.find(f => text.startsWith(f, i));
  // numbers: an 11-digit mobile, a student number, a QQ or WeChat ID; a run of 7 or more digits anywhere in Chinese writing
  for (const m of text.matchAll(/(?<![\d])(1[3-9]\d{9})(?![\d])/gu)) push(m.index, m.index + m[0].length, 'phone number', 2);
  for (const m of text.matchAll(/(学号|学籍号|考号|准考证号|编号|QQ号?|微信号?|手机号?|电话)\s*(?:是|为|[:：])?\s*([A-Za-z0-9_-]{4,})/gu)) { const a = m.index + m[0].length - m[2].length; push(a, a + m[2].length, /QQ|微信|手机|电话/.test(m[1]) ? 'phone number' : 'ID number', 2); }
  for (const m of text.matchAll(/(?<=\p{Script=Han}|^|\s)\d{7,}(?!\d)/gu)) push(m.index, m.index + m[0].length, 'ID number', 2);
  // birthdays: a date with 生日, 出生 or 生于 near it, or a full date with a year a student was born in
  for (const m of text.matchAll(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/gu)) {
    const y = +(m[1] || 0), near = text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 8);
    if (/生日|出生|生于|诞生/.test(near) || y >= 1990 && y <= 2019) push(m.index, m.index + m[0].length, 'birthday', 2);
  }
  // street addresses: 人民路12号, 3栋502室, 阳光小区5号楼
  for (const m of text.matchAll(/[\p{Script=Han}]{1,8}?(?:路|街|大道|大街|巷|胡同|弄)\s*\d+\s*号(?:\s*(?:院|楼)?\s*\d*\s*(?:号楼|栋|幢|单元|室|层)?\s*\d*\s*(?:单元|室|号)?)*|[\p{Script=Han}]{2,6}(?:小区|花园|公寓|新村|大厦)\s*\d+\s*(?:号楼|栋|幢)(?:\s*\d+\s*(?:单元|室|号)?)*|\d+\s*(?:号楼|栋|幢)\s*\d+\s*(?:单元\s*\d+\s*)?室?/gu)) {
    // start after 住在, 在, 是 (我家住在人民路12号 covers 人民路12号)
    const k = (m[0].match(/^[^\d]*?(?:住在|位于|在|是|于|到|从|去|住)(?=[^\d]*?(?:路|街|大道|大街|巷|胡同|弄|小区|花园|公寓|新村|大厦))/u) || [''])[0].length;
    push(m.index + k, m.index + m[0].length, 'address', 2);
  }
  // names
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2), sur = ZH_SURNAME.has(two) && two.length === 2 ? two : ZH_SURNAME.has(text[i]) ? text[i] : null;
    if (!sur) continue;
    // a writer or character (鲁迅, 闰土), unless more of a name follows (孟子杰 is a person, 孟子 a philosopher)
    const f = famousAt(i); if (f && !han(text[i + f.length])) { i += f.length - 1; continue; }
    if (f && ZH_AFTER_DOES.test(text.slice(i + f.length))) { i += f.length - 1; continue; }
    const before = text.slice(Math.max(0, i - 8), i), s = i + sur.length, lineStart = /(^|\n)[ \t]*$/.test(text.slice(Math.max(0, i - 3), i));
    // the character before is part of an everyday word with this one (任何, 许多): not a name
    if (i > 0 && ZH_WORDS.has(text.slice(i - 1, i + 1))) continue;
    // a name with no clue but a verb after it must start after punctuation, a space, the start, or a small word like 和, 跟, 的, 我
    const edge = i === 0 || /[\s\p{P}和跟与把给对让叫是的了说我你他她们]/u.test(text[i - 1]);
    // 王老师: the family name alone, with the title right after
    if (ZH_AFTER_TITLE.test(text.slice(s))) { push(i, s, 'name', 2); continue; }
    // the given name is one or two characters; try both and keep the one a clue supports
    let best = null;
    for (const g of [2, 1]) {
      const e = s + g, given = text.slice(s, e);
      if ([...given].length !== g || ![...given].every(han)) continue;
      const word = text.slice(i, e), rest = text.slice(e);
      const titleAfter = ZH_AFTER_TITLE.test(rest), cue = ZH_BEFORE.test(before), line = lineStart && /^[ \t]*($|\n|[,，(（:：])/.test(rest), does = ZH_AFTER_DOES.test(rest);
      const everyday = ZH_WORDS.has(text.slice(i, i + 2)) || ZH_WORDS.has(text.slice(s, s + 2));
      const sure = titleAfter || cue || line ? 2 : 0;
      // a family name that is also a common character needs a verb that only a person does right after (白超批改, 高宇子带我)
      const strongDoes = /^(说|告诉|带我|和我|跟我|对我|给我|帮我|陪我|教我|让我|问我|批改|笑着说)/.test(rest);
      if (!sure && (!does || !edge || everyday || ZH_COMMON_SURNAME.has(sur) && !strongDoes)) continue;
      if (everyday && !cue && !line) continue;
      best = { a: i, b: e, sure: sure || 1 }; break;
    }
    if (best) { push(best.a, best.b, 'name', best.sure); i = best.b - 1; }
  }
  // a signature line (——琪, ——李明) and the name after 你的孙女, 你的女儿: the one to three characters that follow
  for (const m of text.matchAll(/(?:(?:^|\n|[。！？])[ \t]*(?:——|—|-)\s*|你的(?:孙女|孙子|女儿|儿子|学生|外孙女|外孙))(\p{Script=Han}{1,3})(?=$|\n|[，。！？\s]|这|那|在|于|如|是)/gu)) {
    const a = m.index + m[0].length - m[1].length; if (!ZH_NOT_GIVEN.has(m[1][0]) && !hits.some(h => h.start <= a && h.end > a)) push(a, a + m[1].length, 'name', 2);
  }
  // nicknames: 小明, 阿强 before 说 or after 叫我; whatever follows 我叫 or 大家都叫我 up to the punctuation
  for (const m of text.matchAll(/(?<=叫我|我叫|叫我做|外号是|外号叫|绰号是|绰号叫|小名是|小名叫|昵称是|昵称叫|乳名叫)\s*([\p{Script=Han}A-Za-z]{1,3})/gu)) {
    const a = m.index + m[0].length - m[1].length; const nick = m[1].replace(/[的了是在说也就都又还，。]+.*$/u, ''); if (nick && !hits.some(h => h.start <= a && h.end > a)) push(a, a + nick.length, 'nickname', 2);
  }
  for (const m of text.matchAll(/(\p{Script=Han})\1(?=说|问|告诉|笑|跑|和我|跟我|是我|对我|给我|帮我|也|就|又|还|都|一起)/gu)) {
    if (ZH_NOT_GIVEN.has(m[1]) || /^(常常|天天|刚刚|慢慢|渐渐|好好|妈妈|爸爸|哥哥|姐姐|弟弟|妹妹|爷爷|奶奶|姥姥|姥爷|叔叔|舅舅|姑姑|婆婆|公公|宝宝|人人|个个|偷偷|悄悄|静静|轻轻|默默|看看|想想|试试|走走|说说|听听|谢谢|等等|处处|时时|年年|家家|久久|多多|大大|小小|高高|长长|深深|紧紧|狠狠|早早|白白|明明|往往|纷纷|稍稍|连连|频频|匆匆|快快|乖乖|星星|哈哈|嘻嘻|呵呵|嘿嘿)$/.test(m[0])) continue;
    if (!hits.some(h => h.start <= m.index && h.end > m.index)) push(m.index, m.index + 2, 'nickname', 1);
  }
  for (const m of text.matchAll(/([小阿])([\p{Script=Han}])(?=说|问|告诉|笑|跑|和我|跟我|是我|对我|给我|帮我|也|就|又|还|都|一起|同学)/gu)) {
    const a = m.index + m[0].length - 2; if (!han(m[2]) || ZH_WORDS.has(m[0]) || /^小(时|学|心|狗|猫|鸟|孩|朋|组|说|声|时候|路|草|河|山|船|镇)/.test(text.slice(a))) continue;
    if (!hits.some(h => h.start <= a && h.end > a)) push(a, a + 2, 'nickname', 1);
  }
  return hits;
}

function findPrivate(text, opts = {}) {
  const toks = rdTokens(text); toks.forEach((t, j) => t.j = j);
  const words = toks.filter(t => t.kind === 'word'), nicks = rdNicks(opts.roster);
  const latin = words.filter(t => RD_LATIN.test(t.s)).length, latinPaper = latin > .7 * words.length ? 1 : 0;
  const hits = [];
  // emails, handles and phone numbers are found by their shape alone
  for (const t of toks) if (t.kind === 'email' || t.kind === 'handle' || t.kind === 'phone') hits.push({ start: t.a, end: t.b, why: t.kind === 'phone' ? 'phone number' : t.kind });
  for (const m of text.matchAll(RD_POSTCODE)) hits.push({ start: m.index, end: m.index + m[0].length, why: 'address' });
  // a date is a birthday when its year is one a student was born in, or the sentence says so before it
  for (const m of text.matchAll(RD_DATE)) {
    const y = +(m[1] || m[2] || m[3] || m[4] || 0), year = y && y < 100 ? 2000 + y : y;
    const before = text.slice(Math.max(0, m.index - 80), m.index);
    if (year >= 1990 && year <= 2019 && /\d/.test(m[0].replace(String(y), '')) || RD_BIRTH_CUE.test(before)) hits.push({ start: m.index, end: m.index + m[0].length, why: 'birthday' });
  }
  // layer 1: each word on its own
  const z = words.map((t, i) => {
    const c = rdClues(t, i, words, toks, text, nicks); c.latinPaper = latinPaper;
    let sum = 0, why = '', best = 0, place = 0, person = 0; const by = [0, 0, 0];
    for (const u of RD_UNITS) {
      let a = u.b; for (const k in u.w) a += u.w[k] * (c[k] || 0);
      const v = Math.max(0, a) * u.out; sum += v; if (v > 0) by[u.sure] += v; if (v > best) { best = v; why = u.why; }
      if (v > 0 && (u.why === 'place' || u.why === 'school' || u.why === 'team')) place = 1;
      if (v > 0 && u.sure === 2 && (u.why === 'name' || u.why === 'nickname')) person = 1;
    }
    return { sum, why, c, sure: by[2] >= RD_FIRE ? 2 : by[1] >= RD_FIRE ? 1 : 0, place, person };
  });
  // layer 2, run until nothing changes: a capitalized word next to one already found joins it (a first name before a family name, the rest of
  // "Cedar Hill", "Middle School", the second of "Mia and May"). Only spaces between them, or "Last, First" at the start of a line, or the dot of St.;
  // never a title, a greeting or a label.
  const gap = (x, y) => text.slice(x.b, y.a);
  const glued = (k, i) => { const [x, y] = k < i ? [words[k], words[i]] : [words[i], words[k]], g = gap(x, y); return /^ {1,3}$/.test(g) || g === '. ' && (/^(st|mt|ft)$/i.test(x.s) || /^\p{Lu}$/u.test(x.s)) || g === ', ' && z[k < i ? k : i].c.start && !z[k < i ? k : i].c.ordinary; };
  const listed = (k, i) => { if (k > i) return false; const g = gap(words[k], words[i]); return /^, $/.test(g) || g === ' & '; };
  let s2 = z.map(x => x.sum);
  for (let pass = 0; pass < 3; pass++) {
    const was = s2;
    s2 = z.map((x, i) => {
      let s = x.sum; const c = x.c;
      if (c.titleWord || c.label || c.idLabel || c.pronounI || c.month && (c.nextDigit || !c.listed || /\d\s*$/.test(text.slice(Math.max(0, words[i].a - 4), words[i].a)))) return s;
      if (!c.cap && !c.caps) {
        // a small particle between two parts of a name (Leo de Vries)
        if (RD_PARTICLE.has(words[i].s) && was[i - 1] >= RD_FIRE && was[i + 1] >= RD_FIRE && glued(i - 1, i) && glued(i + 1, i)) s += 2.5;
        return s;
      }
      const touch = [i - 1, i + 1].some(k => words[k] && was[k] >= RD_FIRE && glued(k, i));
      // an everyday short word only joins a name it ends (Yasmin Do, then the line ends)
      if (touch && (!c.func || c.partEnd && !c.start) && (!c.ordinary || !c.start || c.listed && !c.opener || c.schoolWord || c.streetWord)) s += c.func || c.single ? 8.5 : 2.5;
      // the first word of a school's name, even an everyday word at the start of a line or after "(" (Kingfisher Bay High School)
      else if (c.ordinary && !c.func && !c.opener && words[i + 1] && was[i + 1] >= RD_FIRE && z[i + 1].why === 'school' && glued(i + 1, i)) s += 2.5;
      // a name the list knows at the start of a sentence, before "and" and a name already found (Major and Paloma came)
      const n1 = words[i + 1], n2 = words[i + 2];
      if (c.start && c.listed && !c.opener && !c.func && n1 && n2 && n1.s === 'and' && was[i + 2] >= RD_FIRE && gap(words[i], n1) === ' ' && gap(n1, n2) === ' ') s += 2.5;
      // the next name in a list after one already found (Mateo, Lila and I / thank Mia and May)
      const p1 = words[i - 1], p2 = words[i - 2];
      if (!c.start && (!c.ordinary || c.listed)) {
        if (p1 && was[i - 1] >= RD_FIRE && listed(i - 1, i)) s += 2.5;
        if (p1 && p2 && p1.s === 'and' && was[i - 2] >= RD_FIRE && gap(p2, p1) === ' ' && gap(p1, words[i]) === ' ') s += c.func ? 8.5 : 2.5;
      }
      return s;
    });
    if (s2.every((v, i) => (v >= RD_FIRE) === (was[i] >= RD_FIRE))) break;
  }
  // a word joined to a sure cover (the first name before Mr Okafor's family name, the rest of a school's name) is as sure as it
  const sure = z.map(x => x.sure);
  for (let pass = 0; pass < 4; pass++) words.forEach((t, i) => { if (s2[i] < RD_FIRE) return; for (const k of [i - 1, i + 1]) if (words[k] && s2[k] >= RD_FIRE && glued(k, i) && sure[k] > sure[i]) sure[i] = sure[k]; });
  hits.forEach(h => h.sure = 2);
  // Towns, teams and schools stay showing unless opts.places asks for them: on their own they don't single a student out.
  // A run of joined words is a place when a place, school or team unit fired on one of them and nothing said it is a person
  // (Mr, my cousin, Dear) and none of its words is a name the list knows (a letter from Mira). Street addresses stay covered.
  const skip = new Uint8Array(words.length), addr = new Uint8Array(words.length);
  if (!opts.places) for (let i = 0; i < words.length; i++) {
    if (s2[i] < RD_FIRE) continue;
    let j = i; while (words[j + 1] && s2[j + 1] >= RD_FIRE && glued(j + 1, j)) j++;
    const run = z.slice(i, j + 1);
    const school = run.some(x => x.c.schoolWord), place = run.some(x => x.place) || school;
    const person = run.some(x => x.person) || !school && run.some(x => x.c.listed && !x.c.ordinary);
    if (run.some(x => x.why === 'address')) addr.fill(1, i, j + 1);
    else if (place && !person) skip.fill(1, i, j + 1);
    i = j;
  }
  words.forEach((t, i) => { if (s2[i] >= RD_FIRE && !skip[i]) hits.push({ start: t.a, end: t.b, why: z[i].why || 'name', sure: sure[i], person: z[i].person || addr[i] }); });
  // Chinese writing gets its own pass; a word run the first pass covered in it (a Chinese name in an English paper) stays covered
  if (ZH_HAN.test(text)) for (const h of rdChinese(text, opts)) {
    // where a cover from the first pass and one from the Chinese pass overlap (wx_a1605923), keep one cover over both
    const o = hits.find(x => x.start < h.end && h.start < x.end);
    if (o) { o.start = Math.min(o.start, h.start); o.end = Math.max(o.end, h.end); o.sure = Math.max(o.sure || 0, h.sure); } else hits.push(h);
  }
  // the place words left showing, so the decision model can leave the same words showing on the class's other papers
  hits.places = words.filter((t, i) => skip[i] && z[i].c.cap && !z[i].c.schoolWord && !z[i].c.ordinary).map(t => t.s);
  return hits;
}

// ---- the decision model: a second small hand-written network that looks at a whole class's covers together and takes off the ones that
// cover no one: the book's characters and author, and names the teacher's own task sheet uses. It only ever takes off a cover the network
// above made, never one from the roster, and never a sure one except for a word the task sheet itself uses.
const RD_BOOKTALK = rdSet('novel novels poem book text texts chapter chapters scene scenes stanza author authors writer poet playwright narrator narrative protagonist antagonist character characters plot theme themes symbol symbolism symbolic foil reader readers audience ending opening speech quote quotation monologue soliloquy dialogue tragedy tragic hero heroine villain critics critic portrayal presents portrays shows depicts represents');
const RD_MINE = rdSet("i i'm i've me my mine we we're our us");
const RD_DROP = [
  // a word the task sheet uses (Jane Eyre, Mr Rochester): it belongs to the assignment, not to a student
  { why: 'task', w: { inTask: 1, shape: -3, rosterWord: -3 }, b: 0, out: 4 },
  // a word covered on a quarter or more of the class's papers on no sure clue, and never surely anywhere: the class's book, not one student
  { why: 'class', w: { manyPapers: 1, weak: 1, sureElsewhere: -3, rosterWord: -3, fair: -3, mostlyMine: -3 }, b: -1, out: 3 },
  // a word the class mostly writes about in sentences about the book (the author shows, Ponyboy's speech, the narrator)
  { why: 'book', w: { mostlyBook: 1, thrice: 1, weak: 1, sureElsewhere: -3, rosterWord: -3, mostlyMine: -3 }, b: -2, out: 2.5 },
  // an author, a character or a famous person (Gatsby, Steinbeck, Lady Macbeth) in a sentence that isn't about the student's own life;
  // a name people also have (George, Jack, Elizabeth) only when the sentence is about the book too (Lennie and George, the narrator)
  { why: 'famous', w: { famous: 1, notSure: 1, shape: -5, mineHere: -1, rosterWord: -3, sureElsewhere: -3, peopleName: -1, bookHere: 1, famousNext: 1 }, b: -1, out: 3 },
  // a name in Chinese that the class mostly writes about in sentences about the book (书中写孙少安, 孙少安的命运), on three or more papers
  { why: 'book', w: { zhBook: 1, rosterWord: -3 }, b: 0, out: 3 },
  // a word inside the title of a book, play or poem (Things Fall Apart, Nineteen Eighty-Four)
  { why: 'famous', w: { inTitle: 1, notSure: 1, shape: -5, rosterWord: -3 }, b: -1, out: 4 },
  // a place after "in" that the class mostly writes about as the book's setting, on several papers (the setting of Thornfield)
  { why: 'book', w: { mostlyBook: 1, manyPapers: 1, fair: 1, sureElsewhere: -3, rosterWord: -3, mostlyMine: -3 }, b: -2, out: 2.5 },
];

// what the sentence around a cover is about: the student's own life (I, my, we), or the book (the narrator, another author or character, a word from the task sheet)
function rdHere(text, h, w, taskCaps = []) {
  const sen = rdSentence(text, h.start, h.end), sw = sen.match(/[\p{L}'’]+/gu) || [];
  const mine = sw.some(x => RD_MINE.has(x.toLowerCase())) ? 1 : 0;
  // another famous name counts only if it isn't the word right next to this one (Echo Ikemefuna is one person, whatever Ikemefuna is)
  const near = new Set([(text.slice(h.end).match(/^ (\p{Lu}[\p{L}'’-]+)/u) || [])[1], (text.slice(0, h.start).match(/(\p{Lu}[\p{L}'’-]+) $/u) || [])[1]]);
  const book = sw.some(x => RD_BOOKTALK.has(x.toLowerCase()) || x !== w && !near.has(x) && /^\p{Lu}/u.test(x) && RD_FAMOUS.has(x.replace(/['’]s$/, '')) && !RD_NAMES.has(x.toLowerCase())) ? 1 : 0;
  return { mine, book };
}
// the word right before or after is an author's or a famous person's family name that is nobody's given name (Albert Einstein, Isaac Newton)
function rdFamousNext(text, h) {
  const after = text.slice(h.end).match(/^ (\p{Lu}[\p{L}'’-]+)/u), before = text.slice(0, h.start).match(/(\p{Lu}[\p{L}'’-]+) $/u);
  return [after, before].some(m => m && RD_FAMOUS.has(m[1].replace(/['’]s$/, '')) && !RD_NAMES.has(m[1].toLowerCase()));
}
// the capitalized words joined to a cover on either side (Jason in "Jason Liang"), so a sure name that only shares one word
// with the task sheet (an author called Jason) stays covered
function rdNeighbours(text, h) {
  return [(text.slice(h.end).match(/^ (\p{Lu}[\p{L}'’.-]*)/u) || [])[1], (text.slice(0, h.start).match(/(\p{Lu}[\p{L}'’.-]*) $/u) || [])[1]].filter(Boolean).map(x => x.replace(/['’]s$/, ''));
}
function rdSentence(text, a, b) {
  let s = a; while (s > 0 && !/[.!?\n。！？；]/.test(text[s - 1])) s--;
  let e = b; while (e < text.length && !/[.!?\n。！？；]/.test(text[e])) e++;
  return text.slice(s, e);
}

// papers: [{ text, hits (from findPrivate), roster }], all from one class. opts.task: the task sheet's text.
// Returns, for each paper, the hits to keep and the hits taken off, each with the reason to show the teacher.
function reviewCovers(papers, opts = {}) {
  const taskWords = new Set(((opts.task || '').match(/[\p{L}\p{M}'’.-]+/gu) || []).map(w => w.replace(/[.'’]+$|['’]s$/g, '')));
  const taskCaps = [...taskWords].filter(w => /^\p{Lu}/u.test(w) && !RD_FUNC.has(w.toLowerCase()));
  const roster = new Set((papers[0] && papers[0].roster || []).flatMap(n => n.toLowerCase().split(/[\s-]+/)));
  const word = (p, h) => p.text.slice(h.start, h.end).replace(/['’]s$/, '');
  // what the class as a whole says about each covered word
  const seen = new Map();
  papers.forEach((p, n) => p.hits.forEach(h => {
    if (h.why === 'email' || h.why === 'handle' || h.why === 'phone number' || h.why === 'birthday' || h.why === 'ID number') return;
    const w = word(p, h), sen = rdSentence(p.text, h.start, h.end), o = seen.get(w) || { papers: new Set(), sure: 0, uses: 0, book: 0, mine: 0 };
    const sw = sen.toLowerCase().match(/[\p{L}']+/gu) || [];
    if (sw.some(x => RD_BOOKTALK.has(x)) || taskCaps.some(t => t !== w && sen.includes(t)) || /\p{Script=Han}/u.test(w) && /书中|作者|人物|主人公|小说|文章|故事|读了|读完|《|命运|形象|情节/u.test(sen)) o.book++;
    // a word the student uses about their own life (I play for, my grandparents' house in) is theirs, however many classmates share it
    if (sw.some(x => RD_MINE.has(x))) o.mine++;
    o.uses++; o.papers.add(n); if (h.sure === 2) o.sure++;
    seen.set(w, o);
  }));
  const big = papers.length >= 5;
  // words the network found to be a town, team or school on some paper in the class (Larkspur International School)
  const places = new Set(papers.flatMap(p => p.hits.places || []));
  const zhSure = new Set(papers.flatMap(p => p.hits.filter(h => h.sure === 2 && (h.why === 'name' || h.why === 'nickname')).map(h => p.text.slice(h.start, h.end)).filter(w => /^\p{Script=Han}{2,4}$/u.test(w) && !ZH_WORDS.has(w) && !(opts.task || '').includes(w))));
  return papers.map(p => {
    const keep = [], off = [];
    let prevPlace = -1;
    const titles = RD_TITLES ? [...p.text.matchAll(RD_TITLES)].map(m => [m.index, m.index + m[0].length]) : [];
    for (const h of p.hits) {
      const w = word(p, h), o = seen.get(w);
      // the same word elsewhere, and the word right after it (the Larkspur Owls), is that place too, unless something says it's a person
      if (!h.person && !roster.has(w.toLowerCase()) && (places.has(w) || prevPlace >= 0 && /^ $/.test(p.text.slice(prevPlace, h.start)))) { prevPlace = h.end; continue; }
      prevPlace = -1;
      const shape = o ? 0 : 1, here = rdHere(p.text, h, w);
      const c = {
        shape, inTask: /^\p{Script=Han}{2,}$/u.test(w) && (opts.task || '').includes(w) && !roster.has(w.toLowerCase()) || taskWords.has(w) && (h.sure < 2 || rdNeighbours(p.text, h).every(x => taskWords.has(x) || RD_TITLE.has(x.toLowerCase().replace(/\.$/, '')))) ? 1 : 0, rosterWord: roster.has(w.toLowerCase()) ? 1 : 0,
        weak: h.sure === 0 ? 1 : 0, fair: h.sure === 1 ? 1 : 0, sureElsewhere: o && o.sure > 0 && o.sure >= .15 * o.uses ? 1 : 0,
        manyPapers: o && big && o.papers.size >= .25 * papers.length ? 1 : 0, thrice: o && o.papers.size >= 3 ? 1 : 0,
        mostlyBook: o && o.book >= .6 * o.uses ? 1 : 0, mostlyMine: o && o.mine >= .3 * o.uses ? 1 : 0,
        zhBook: /\p{Script=Han}/u.test(w) && h.sure < 2 && o && o.papers.size >= 3 && o.book >= .5 * o.uses ? 1 : 0, famous: RD_FAMOUS.has(w) ? 1 : 0, notSure: h.sure < 2 ? 1 : 0, inTitle: titles.some(([a, b]) => h.start >= a && h.end <= b) ? 1 : 0, famousNext: rdFamousNext(p.text, h) && RD_NAMES.has(w.toLowerCase()) && !here.mine ? 1 : 0, peopleName: RD_NAMES.has(w.toLowerCase()) ? 1 : 0, mineHere: here.mine, bookHere: here.book,
      };
      let sum = 0, why = '', best = 0;
      for (const u of RD_DROP) { let a = u.b; for (const k in u.w) a += u.w[k] * c[k]; const v = Math.max(0, a) * u.out; sum += v; if (v > best) { best = v; why = u.why; } }
      if (sum >= RD_FIRE) off.push({ ...h, reason: why === 'task' ? 'in your task sheet' : why === 'class' ? 'on ' + o.papers.size + ' of ' + papers.length + ' papers' : why === 'famous' ? 'an author, character or famous person' : 'talked about as part of the book' });
      else keep.push(h);
    }
    // in Chinese writing, a name or nickname surely found on any of the class's papers (亲爱的谭曦熙, 大家都叫我大头) is covered wherever it appears
    for (const w of zhSure) for (let k = p.text.indexOf(w); k >= 0; k = p.text.indexOf(w, k + w.length))
      if (!p.hits.some(h => h.start < k + w.length && k < h.end) && !keep.some(h => h.start < k + w.length && k < h.end)) keep.push({ start: k, end: k + w.length, why: 'name', sure: 2, spread: true });
    // the other way round: a word the class surely covers somewhere (Mr Marsh, St. Brannoc College) is covered wherever the class writes it
    // with a capital, even where it looks like an everyday word (As Marsh told us)
    const have = new Set(p.hits.map(h => h.start));
    for (const m of p.text.matchAll(/\p{Lu}[\p{L}\p{M}'’-]*/gu)) {
      const w = m[0].replace(/['’]s$/, ''), o = seen.get(w);
      if (!o || !o.sure || o.sure < .15 * o.uses || have.has(m.index) || places.has(w) || taskWords.has(w) || RD_FUNC.has(w.toLowerCase()) || RD_TITLE.has(w.toLowerCase()) || RD_SCHOOL.has(w.toLowerCase()) || RD_STREET.has(w.toLowerCase()) || RD_LABEL.has(w.toLowerCase()) || w.length < 2) continue;
      // not at the start of a sentence, where any word has a capital (Chapter 3 begins...)
      if (/(^|[.!?:\n"“(|-]\s*)$/.test(p.text.slice(Math.max(0, m.index - 3), m.index))) continue;
      keep.push({ start: m.index, end: m.index + m[0].length, why: 'name', sure: 2, spread: true });
    }
    return { keep, off };
  });
}

if (typeof module !== 'undefined') module.exports = { findPrivate, reviewCovers, redactWords, rdChinese, RD_UNITS };
