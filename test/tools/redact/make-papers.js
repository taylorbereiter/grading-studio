// Makes made-up student papers with every identifying detail marked, for measuring the redaction network.
// node test/tools/redact/make-papers.js [count] [seed] [dev|test] > papers.json
// Every student, relative, teacher, school, town, phone number and ID is invented and mixed at random.
// The "test" set also uses sentences the "dev" set never has, so revisions made by looking at dev mistakes can't simply learn the test set's wording.
'use strict';
let P = require('./pools');
const BLIND = require('./blind');

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Slots: {self} full name, {selfF} given name, {selfL} family name, {nick}, {mate} a classmate's full name, {mateF},
// {relName} a relative's or friend's given name, {rel} the relation word, {teacher} Ms. Surname, {school}, {schoolS}, {town}, {addr},
// {phone}, {email}, {sid}, {dob}, {handle}, {team}, {house}, {other} a name in another alphabet,
// and things that identify no one: {pub} a public figure or character, {pplace}, {book}, {topic}, {month}, {day}.
const HEADERS = [
  'Name: {self}\nClass: 12EL-{n}\nDate: {month} {d}\n',
  '{self}\nEnglish 12 - {teacher}\n{month} {d}, 2026\n',
  '{self} | Period {n} | {book} essay\n',
  'Student: {self}   ID: {sid}\n',
  '{selfL}, {selfF}\nScience - Lab report\n',
  'By {self}\n',
  '{book}: final draft\n',
  'Name: {selfF} {selfL}   House: {house}\n',
  '',
];
const BODY = {
  essay: [
    'In {book}, the author shows how {topic} shapes the choices people make.',
    '{pub} is a character who changes the most over the course of the story.',
    'At the start of the novel, {pub} seems confident, but this does not last.',
    'This essay will argue that {topic} is the central idea of the text.',
    'The setting of {pplace} matters because it isolates the characters.',
    'One example is when {pub} refuses to speak in chapter {n}.',
    'Overall, the writer uses symbolism to make the reader question {topic}.',
    'When I first read this book my {rel} {relName} told me it was boring, but I disagreed.',
    'This reminded me of my own town, {town}, where everyone knows everyone.',
    'My classmate {mateF} said in our discussion that the ending was hopeful.',
    'In conclusion, {book} is still relevant today because {topic} has not gone away.',
    'Many readers believe {pub} is the hero, yet the evidence suggests otherwise.',
    'The quote on page {n} shows that the narrator cannot be trusted.',
    'Like {pub}, I have felt pressure to fit in at {schoolS}.',
    { held: 1, s: 'I talked about this chapter with {relName}, my {rel}, over dinner.' },
    { held: 1, s: 'The theme of {topic} links {book} to what {pub} believed.' },
    { held: 1, s: 'Back when I lived on {addr}, I saw something similar happen.' },
    { held: 1, s: 'Even {mate} agreed the second half was weaker.' },
  ],
  reflection: [
    'This semester I learned a lot about {topic}.',
    'My goal for next term is to manage my time better.',
    'I worked with {mate} on the group project and we split the slides.',
    'Honestly, I struggled with the research part at first.',
    'My {rel} {relName} helped me practice my speech every night.',
    'I am proud of how much my writing improved since {month}.',
    'Next year I want to join the {team} again.',
    '{teacher} gave me feedback that helped me fix my thesis.',
    'I would like to thank {mateF} and {relName} for their help.',
    'If you need to reach me, my number is {phone}.',
    'I usually post my art on Instagram as {handle}.',
    'Being in {house} this year made me more confident.',
    'Will I keep doing this next year? I think so.',
    'May was the hardest month because of exams.',
    { held: 1, s: 'Shout out to {nick}, who always sat next to me in class.' },
    { held: 1, s: 'My {rel} drives me to {schoolS} every morning from {town}.' },
    { held: 1, s: 'Anyone can text me at {phone} about the project.' },
    { held: 1, s: 'Hope this reflection shows how hard I tried.' },
  ],
  lab: [
    'The purpose of this experiment was to test how temperature affects {topic}.',
    'We measured the mass of each sample three times.',
    'My lab partner was {mate}.',
    'The independent variable was temperature and the dependent variable was time.',
    'Our results showed a clear increase between trial {n} and trial {n2}.',
    'One source of error was that the scale was not calibrated.',
    'Data was collected on {day}, {month} {d} in Room {room}.',
    'We followed the method from {teacher}.',
    'The hypothesis was supported by the data.',
    'In the future we would repeat each trial five times.',
    { held: 1, s: '{mateF} recorded the times while I mixed the solutions.' },
    { held: 1, s: 'Dr. {pubL} first described this reaction in 1903.' },
  ],
  email: [
    'Dear {teacher},',
    'Hi {teacher}, I am sorry my essay is late.',
    'I was sick on {day} and could not come to {schoolS}.',
    'My {rel} can confirm this if you call {phone}.',
    'You can email me at {email} if anything is missing.',
    'Thank you for understanding.',
    'Best wishes,\n{selfF}',
    'Sincerely,\n{self}',
    'Thanks,\n{nick}',
    'I attached my draft to this message.',
    'My student number is {sid}.',
    { held: 1, s: 'Kind regards,\n{selfF} {selfL} ({sid})' },
    { held: 1, s: 'My {rel} {relName} will pick up the form on {day}.' },
  ],
  narrative: [
    'I was born on {dob} in a small hospital in {town}.',
    'When I was seven, we moved to {addr}.',
    'My {rel} {relName} always told me stories about {pplace}.',
    'Everyone at {school} calls me {nick}.',
    'The first time I met {mate}, we argued about football.',
    'Our house was the blue one at the end of the street.',
    'That summer changed everything for my family.',
    'Grandma {relName} still keeps the photo on her wall.',
    'I wrote my name, {other}, on the first page of my notebook.',
    'Mark my words, I said, this will not happen again.',
    'Grace is something I learned from my grandmother.',
    { held: 1, s: 'Our neighbor {relName} {lastR} lent us a ladder.' },
    { held: 1, s: 'I still have the card {relName} gave me when I left {town}.' },
    { held: 1, s: 'We used to meet at {schoolS} station after practice.' },
  ],
};
// Written after the network's weights were finished and never looked at while changing them: the "fresh" set uses only these, so its score is a fair one.
const FRESH = {
  headers: ['{selfF} {selfL}\n{month} {d}\n', 'Author: {self}\n', '{self} - Draft {n}\n', '{selfL} {selfF} / {schoolS}\n', 'Homework by {selfF}\n', ''],
  body: [
    '{mateF} and I disagreed about the ending.',
    'According to {mateF}, the narrator is lying.',
    'The poem was read aloud by {teacher} in class.',
    'Last week {relName} took me to the library in {town}.',
    'Without help from {relName} I would have given up.',
    'I live with my {rel} near {addr}.',
    'Our {rel}, {relName}, works as a nurse.',
    'Message me on {phone} or at {email}.',
    'I was born in {town} on {dob}.',
    'Before moving here, I went to {school}.',
    '{nick} is what my friends call me.',
    'Thank you, {teacher}, for the extra time.',
    '{relName} {lastR} is my best friend since primary school.',
    '{pub} reminds me of {relName}, who is also stubborn.',
    'In {pplace}, the story begins with a storm.',
    'Chapter {n} is where {pub} finally tells the truth.',
    'The class debated whether {pub} was right.',
    'Photosynthesis needs light, water and carbon dioxide.',
    'Renewable energy could replace coal within decades.',
    'Unfortunately the experiment did not work the first time.',
    'Love, {selfF}',
    'Cheers,\n{nick}',
    'P.S. my {rel} says hi to {teacher}.',
    '{other} is how my grandmother writes my name.',
    'Ask {mate} if you need the notes.',
  ],
};
const MONTH = 'January February March April May June July August September October November December'.split(' ');
const DAY = 'Monday Tuesday Wednesday Thursday Friday Saturday Sunday'.split(' ');

function paper(r, split, roster, studentIdx, cls) {
  const pick = a => a[Math.floor(r() * a.length)], n = () => 1 + Math.floor(r() * 9);
  const self = roster[studentIdx], mates = roster.filter((_, i) => i !== studentIdx);
  const relFirst = () => r() < .15 ? pick(P.FIRST_WORD) : pick(P.FIRST);
  const digits = k => Array.from({ length: k }, () => Math.floor(r() * 10)).join('');
  const phoneFmt = [() => '0' + digits(2) + ' ' + digits(3) + ' ' + digits(4), () => '+' + digits(2) + ' ' + digits(2) + ' ' + digits(4) + ' ' + digits(4), () => '(' + digits(3) + ') ' + digits(3) + '-' + digits(4), () => digits(3) + '-' + digits(3) + '-' + digits(4), () => '0' + digits(9)];
  const genre = split === 'fresh' || split === 'blind' ? split : pick(Object.keys(BODY));
  const sentences = split === 'blind' ? BLIND.body : split === 'fresh' ? FRESH.body : BODY[genre].filter(t => typeof t === 'string' || split === 'test').map(t => typeof t === 'string' ? t : t.s);
  let text = '', spans = [];
  // fill a template, recording where each slot's value lands
  const fill = tpl => {
    const mate = pick(mates), rel = pick(P.RELATIVE);
    const v = {
      self: [self.first + ' ' + self.last, 'PERSON', 'self'], selfF: [self.first, 'PERSON', 'self'], selfL: [self.last, 'PERSON', 'self'],
      nick: [P.NICK[self.first] || self.first.slice(0, Math.max(2, Math.ceil(self.first.length / 2))), 'PERSON', 'nick'],
      mate: [mate.first + ' ' + mate.last, 'PERSON', 'mate'], mateF: [mate.first, 'PERSON', 'mate'],
      relName: [relFirst(), 'PERSON', 'other'], lastR: [r() < .2 ? pick(P.LAST_WORD) : pick(P.LAST), 'PERSON', 'other'], rel: [rel],
      teacher: null, school: [pick(P.SCHOOL), 'SCHOOL'], schoolS: [pick(P.SCHOOL_SHORT), 'SCHOOL'], town: [pick(P.TOWN), 'PLACE'],
      addr: [n() + digits(Math.floor(r() * 2)) + ' ' + pick(P.STREET) + ' ' + pick(P.STREET_KIND), 'PLACE'],
      phone: [pick(phoneFmt)(), 'CONTACT'], email: [(r() < .5 ? self.first.toLowerCase() + '.' + self.last.toLowerCase().replace(/[^a-z]/g, '') : self.first.toLowerCase().slice(0, 1) + self.last.toLowerCase().replace(/[^a-z]/g, '') + digits(2)) + '@' + pick(['gmail.com', 'outlook.com', 'student.riverbend.edu', 'northgate.org']), 'CONTACT'],
      sid: [(r() < .5 ? '' : 'S') + digits(r() < .5 ? 6 : 8), 'ID'], dob: [pick(MONTH) + ' ' + n() + ', ' + (2007 + Math.floor(r() * 4)), 'DATE'],
      handle: ['@' + self.first.toLowerCase() + '_' + pick(['art', 'draws', 'x', '07', 'creates']), 'CONTACT'], team: [pick(P.TEAM), 'SCHOOL'], house: [pick(P.HOUSE), 'SCHOOL'],
      other: [pick(P.OTHER), 'PERSON', 'other'],
      pub: [pick(P.PUBLIC), 'PUBLIC'], pubL: [pick(['Arrhenius', 'Curie', 'Haber', 'Pasteur']), 'PUBLIC'], pplace: [pick(P.PUBLIC_PLACE), 'PUBLIC'], book: [pick(P.BOOK), 'PUBLIC'], topic: [pick(P.TOPIC)],
      month: [pick(MONTH)], day: [pick(DAY)], d: [String(n() + Math.floor(r() * 20))], n: [String(n())], n2: [String(n() + 9)], room: [String(100 + Math.floor(r() * 300))],
    };
    if (split === 'blind') {   // the blind set's own slots; the other sets never draw these, so their papers stay as they were
      const mate2 = pick(mates.filter(m => m !== mate)), pp = () => r() < .85 ? pick(cls.people) : pick(BLIND.pools.BOOKS.flatMap(b => b.people));
      const two = k => String(k).padStart(2, '0'), y = 2008 + Math.floor(r() * 5), mo = Math.floor(r() * 12), dd = 1 + Math.floor(r() * 28);
      const dob2 = pick([() => two(dd) + '/' + two(mo + 1) + '/' + y, () => y + '-' + two(mo + 1) + '-' + two(dd), () => 'the ' + dd + (dd % 10 === 1 && dd !== 11 ? 'st' : dd % 10 === 2 && dd !== 12 ? 'nd' : dd % 10 === 3 && dd !== 13 ? 'rd' : 'th') + ' of ' + MONTH[mo] + ' ' + y, () => MONTH[mo] + ' ' + dd + 'th, ' + y, () => dd + ' ' + MONTH[mo].slice(0, 3) + ' ' + y])();
      const L = () => 'ABCDEFGHJKLMNPRSTWXY'[Math.floor(r() * 20)];
      Object.assign(v, {
        nick: [P.NICK[self.first] || self.first, 'PERSON', 'nick'],
        mate2: [mate2.first + ' ' + mate2.last, 'PERSON', 'mate'], mate2F: [mate2.first, 'PERSON', 'mate'],
        pub: [pp(), 'PUBLIC'], pub2: [pp(), 'PUBLIC'], book: [cls.book, 'PUBLIC'], pplace: [r() < .7 ? pick(cls.places) : pick(['Lagos', 'Chicago', 'Lisbon', 'Seoul', 'Peru']), 'PUBLIC'],
        dob2: [dob2, 'DATE'], postcode: [L() + L() + (1 + Math.floor(r() * 9)) + ' ' + Math.floor(r() * 10) + L() + L(), 'PLACE'],
        cand: [pick([() => L().toLowerCase() + L().toLowerCase() + L().toLowerCase() + digits(3), () => digits(4) + '-' + digits(3), () => digits(7)])(), 'ID'],
        selfCaps: [(self.last + ' ' + self.first).toUpperCase(), 'PERSON', 'self'],
        phone: [pick([() => '07' + digits(3) + ' ' + digits(6), () => '+1 (' + digits(3) + ') ' + digits(3) + '-' + digits(4), () => digits(4) + ' ' + digits(4), () => digits(3) + '.' + digits(3) + '.' + digits(4)])(), 'CONTACT'],
        email: [self.first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + pick(['', '.', '_']) + self.last.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 5) + pick(['', digits(2)]) + '@' + pick(['icloud.com', 'yahoo.com', 'whitlow.edu', 'mail.com']), 'CONTACT'],
        handle: ['@' + pick(['team', 'project', 'class']) + '_' + self.first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''), 'CONTACT'],
      });
    }
    const tl = r() < .2 ? pick(P.LAST_WORD) : pick(P.LAST);
    let out = '';
    tpl.replace(/\{(\w+)\}|([^{]+)/g, (m, slot, lit) => {
      if (lit) { out += lit; return ''; }
      if (slot === 'teacher') {   // the title stays as typed; the surname is what identifies
        const t = pick(P.TEACHER_TITLE) + ' '; out += t;
        spans.push({ start: text.length + out.length, end: text.length + out.length + tl.length, type: 'PERSON', who: 'teacher', value: tl }); out += tl; return '';
      }
      const [val, type, who] = v[slot];
      if (type) spans.push({ start: text.length + out.length, end: text.length + out.length + val.length, type, who, value: val });
      out += val; return '';
    });
    return out;
  };
  text += fill(pick(split === 'blind' ? BLIND.headers : split === 'fresh' ? FRESH.headers : HEADERS));
  const k = 4 + Math.floor(r() * 9), used = new Set();
  const body = [];
  for (let i = 0; i < k; i++) { let t; do t = pick(sentences); while (used.has(t) && used.size < sentences.length); used.add(t); body.push(t); }
  // a letter opens with one greeting and ends with one sign-off
  const greet = t => /^(Dear|Hi) /.test(t), sign = t => /,\n/.test(t);
  const ordered = genre === 'email' ? [body.find(greet), ...body.filter(t => !greet(t) && !sign(t)), body.find(sign)].filter(Boolean) : body;
  for (const t of ordered) text += fill(t) + (genre === 'email' || r() < .25 ? '\n' : ' ');
  return { genre, student: self.first + ' ' + self.last, text: text.trim(), spans: spans.filter(s => s.end <= text.trim().length) };
}

function makeRoster(r, size) {
  const pick = a => a[Math.floor(r() * a.length)], seen = new Set(), out = [];
  while (out.length < size) {
    const first = r() < .08 ? pick(P.FIRST_WORD) : pick(P.FIRST), last = r() < .1 ? pick(P.LAST_WORD) : pick(P.LAST);
    if (seen.has(first) || seen.has(first + last)) continue; seen.add(first); seen.add(first + last); out.push({ first, last });
  }
  return out;
}

function make(count, seed, split) {
  P = split === 'blind' ? { ...require('./pools'), ...BLIND.pools } : require('./pools');
  const r = rng(seed), papers = [];
  let roster = null, names = null, cls = null, c = 0;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 0) { roster = makeRoster(r, 20); names = roster.map(s => s.first + ' ' + s.last); cls = split === 'blind' ? BLIND.pools.BOOKS[c++ % BLIND.pools.BOOKS.length] : null; }
    const p = paper(r, split, roster, i % 20, cls);
    p.id = split + '-' + i; p.roster = names;
    // the class's task sheet, made from its book without drawing on the random numbers so the papers stay as they were
    if (cls) p.task = cls.book + ' essay: write about ' + cls.people[0] + ' and ' + cls.people[1] + ' and what ' + cls.people[cls.people.length - 1] + ' wanted readers to see.';
    papers.push(p);
  }
  return papers;
}

module.exports = { make };
if (require.main === module) {
  const [count = 500, seed = 1, split = 'dev'] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(make(+count, +seed, split), null, 1));
}
