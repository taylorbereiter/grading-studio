/* ---------------- the redaction network: finds what identifies a student beyond the roster (relatives, teachers, nicknames, towns, schools, phone numbers, birthdays) ---------------- */
// A small neural network whose weights were written by hand, not trained. Each word of the text becomes a row of clues;
// the hidden units below each look for one pattern in those clues, and the output adds up what they found.
// A second layer then lets a word join a neighbor that was already found, so "Sunridge Middle School" goes as a whole.
// Emails, phone numbers, postcodes and dates are found by their shape first.
// It only adds covers: the roster covering in names.js stays first and is never undone by this.
// Every weight has a reason beside it. Revisions were made by looking at mistakes on made-up papers only (test/tools/redact).

// Two lists it knows (see redact-lists-LICENSE.txt): everyday English words (SCOWL, up to size 35) and given and family names in the Latin alphabet from many countries (Faker).
let RD_WORDS = null, RD_NAMES = new Set();
// Apps and brands students name all the time, capitalized but identifying no one.
const RD_BRANDS = 'instagram tiktok youtube snapchat google discord whatsapp netflix spotify minecraft roblox fortnite iphone ipad xbox playstation nintendo zoom kahoot canva quizlet chatgpt wikipedia facebook twitter reddit pinterest amazon'.split(' ');
// School subjects, languages and nationalities: always capitalized in English, never a person.
const RD_COMMON_PROPER = 'english math maths science history geography biology chemistry physics economics psychology spanish french german chinese mandarin cantonese japanese korean arabic hindi urdu thai vietnamese russian italian portuguese dutch turkish persian hebrew latin greek swahili american british canadian mexican brazilian african european asian australian indian nigerian egyptian christmas easter ramadan eid diwali hanukkah lunar christian muslim jewish hindu buddhist god internet'.split(' ');
function redactWords(words, names) {
  RD_WORDS = new Set(words.split('\n').concat(RD_BRANDS, RD_COMMON_PROPER));
  if (names) RD_NAMES = new Set(names.split('\n'));
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
  const ws = part.split(/[\s,]+/).filter(Boolean);
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
    afterGreet: prev && RD_GREET.has(lowP) && /^,?\s*\n?\s*$/.test(pb) ? 1 : 0,
    afterNamed: prev && RD_NAMED.has(lowP) && /^\s*:?\s*$/.test(pb) || prev && lowP === 'by' && prev2 && lowP2 === 'submitted' ? 1 : 0,
    callsMe: prev && prev2 && (/^(me|him|her)$/.test(lowP) && /^(calls?|called|call)$/.test(lowP2) || lowP === 'as' && lowP2 === 'known' || lowP === 'by' && /^(go|goes|went)$/.test(lowP2) || lowP === 'is' && lowP2 === 'name' || /^i[’']m$/.test(lowP)) ? 1 : 0,
    dashSign: /^\s*[-–—]\s*$/.test(pb) && (!prev || /\n\s*[-–—]\s*$/.test(text.slice(Math.max(0, t.a - 4), t.a)) || i === 0) ? 1 : 0,
    afterLabel: prev && RD_LABEL.has(lowP) && /^\s*:\s*$/.test(pb) ? 1 : 0,
    label: /^\s*:/.test(nb) || !next && /^\s*:/.test(after) ? 1 : 0,
    // the words of "Student ID #123" or "Candidate number" themselves
    idLabel: /^(student|candidate)$/.test(low) && /^\s*(id|number|no)\b/i.test(after) || low === 'id' && /^\s*[#:]?\s*[a-z]{0,2}\d/i.test(after) ? 1 : 0,
    afterPlace: prev && RD_PLACE_BEFORE.has(lowP) ? 1 : 0,
    afterNumber: prev && /^\d{1,5}$/.test(prev.s) ? 1 : 0,
    afterPerson: prev && RD_PERSON_PREP.has(lowP) && !/[.!?;:]/.test(pb) ? 1 : 0,
    afterIdCue: prev && (RD_ID_CUE.has(lowP) || /#\s*$/.test(pb)) && /\d/.test(w) ? 1 : 0,
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
  // a name signed after a dash at the end (- Mo)
  { why: 'name', w: { dashSign: 1, cap: 1, func: -3 }, b: -1, out: 4 },
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
    let sum = 0, why = '', best = 0; const by = [0, 0, 0];
    for (const u of RD_UNITS) {
      let a = u.b; for (const k in u.w) a += u.w[k] * (c[k] || 0);
      const v = Math.max(0, a) * u.out; sum += v; if (v > 0) by[u.sure] += v; if (v > best) { best = v; why = u.why; }
    }
    return { sum, why, c, sure: by[2] >= RD_FIRE ? 2 : by[1] >= RD_FIRE ? 1 : 0 };
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
  words.forEach((t, i) => { if (s2[i] >= RD_FIRE) hits.push({ start: t.a, end: t.b, why: z[i].why || 'name', sure: sure[i] }); });
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
  // a place after "in" that the class mostly writes about as the book's setting, on several papers (the setting of Thornfield)
  { why: 'book', w: { mostlyBook: 1, manyPapers: 1, fair: 1, sureElsewhere: -3, rosterWord: -3, mostlyMine: -3 }, b: -2, out: 2.5 },
];

function rdSentence(text, a, b) {
  let s = a; while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
  let e = b; while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
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
    if (sw.some(x => RD_BOOKTALK.has(x)) || taskCaps.some(t => t !== w && sen.includes(t))) o.book++;
    // a word the student uses about their own life (I play for, my grandparents' house in) is theirs, however many classmates share it
    if (sw.some(x => RD_MINE.has(x))) o.mine++;
    o.uses++; o.papers.add(n); if (h.sure === 2) o.sure++;
    seen.set(w, o);
  }));
  const big = papers.length >= 5;
  return papers.map(p => {
    const keep = [], off = [];
    for (const h of p.hits) {
      const w = word(p, h), o = seen.get(w);
      const shape = o ? 0 : 1;
      const c = {
        shape, inTask: taskWords.has(w) ? 1 : 0, rosterWord: roster.has(w.toLowerCase()) ? 1 : 0,
        weak: h.sure === 0 ? 1 : 0, fair: h.sure === 1 ? 1 : 0, sureElsewhere: o && o.sure > 0 && o.sure >= .15 * o.uses ? 1 : 0,
        manyPapers: o && big && o.papers.size >= .25 * papers.length ? 1 : 0, thrice: o && o.papers.size >= 3 ? 1 : 0,
        mostlyBook: o && o.book >= .6 * o.uses ? 1 : 0, mostlyMine: o && o.mine >= .3 * o.uses ? 1 : 0,
      };
      let sum = 0, why = '', best = 0;
      for (const u of RD_DROP) { let a = u.b; for (const k in u.w) a += u.w[k] * c[k]; const v = Math.max(0, a) * u.out; sum += v; if (v > best) { best = v; why = u.why; } }
      if (sum >= RD_FIRE) off.push({ ...h, reason: why === 'task' ? 'in your task sheet' : why === 'class' ? 'on ' + o.papers.size + ' of ' + papers.length + ' papers' : 'talked about as part of the book' });
      else keep.push(h);
    }
    // the other way round: a word the class surely covers somewhere (Mr Marsh, St. Brannoc College) is covered wherever the class writes it
    // with a capital, even where it looks like an everyday word (As Marsh told us)
    const have = new Set(p.hits.map(h => h.start));
    for (const m of p.text.matchAll(/\p{Lu}[\p{L}\p{M}'’-]*/gu)) {
      const w = m[0].replace(/['’]s$/, ''), o = seen.get(w);
      if (!o || !o.sure || o.sure < .15 * o.uses || have.has(m.index) || taskWords.has(w) || RD_FUNC.has(w.toLowerCase()) || RD_TITLE.has(w.toLowerCase()) || RD_SCHOOL.has(w.toLowerCase()) || RD_STREET.has(w.toLowerCase()) || RD_LABEL.has(w.toLowerCase()) || w.length < 2) continue;
      // not at the start of a sentence, where any word has a capital (Chapter 3 begins...)
      if (/(^|[.!?:\n"“(|-]\s*)$/.test(p.text.slice(Math.max(0, m.index - 3), m.index))) continue;
      keep.push({ start: m.index, end: m.index + m[0].length, why: 'name', sure: 2, spread: true });
    }
    return { keep, off };
  });
}

if (typeof module !== 'undefined') module.exports = { findPrivate, reviewCovers, redactWords, RD_UNITS };
