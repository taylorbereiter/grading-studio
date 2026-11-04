// The third blind set, written 11/4 after the decision model was finished and before it was ever run on these papers.
// Unlike the first two it isn't only English essays: each class has a subject (English, history, science, a personal statement,
// a reflection after a trip) and writes in the ways students do in that subject, with a task sheet for the class.
// Every student, relative, teacher, school, street and number is invented; given and family names are mixed at random.
'use strict';

const FIRST = ('Abebe Adaeze Aino Alessio Amara Anouk Arjun Bashir Beatriz Bilal Bronwen Caetano Ciara Dariusz Delphi Dmitri Eamon Elif Emeka Esperanza Fenna Florin Giulia Gunnar Hadley Halima Henrike Ignacio Ilsa Inti Jarrah Jovana Kaveh Keziah Kofi Lachlan Laleh Lior Lucan Malak Marisela Mattias Mehmet Mireille Nalani Nikolai Noor Oisin Olamide Oriel Paavo Pilar Quilla Radu Rania Rasmus Saoirse Selam Sigrid Soraya Tadhg Tamar Teodor Thandiwe Ulani Valentin Wanjiru Xiomara Yaretzi Yuki Zainab Zoltan').split(' ');
// given names that are also everyday words
const FIRST_WORD = 'Sunny Summer Mercy Faith Rocky Hunter Bliss Clover Storm Sterling Dusty Ivy'.split(' ');
const LAST = ('Abernathy Adeyemi Bergqvist Bianchi Chukwu Dalgaard Demir Esposito Fairweather Ferreira Gallagher Hakimi Ivanova Jovanovic Kaminski Kowalczyk Lindqvist Mahlangu Moreau Nakamura Novak Oduya Ozturk Petrov Quigley Rahimi Rossetti Sandoval Szabo Takeda Toivonen Umeh Vasquez Wainwright Xu Yamada Zielinski').split(' ');
// family names that are also everyday words
const LAST_WORD = 'Baker Fisher Young Brown Rivers Woods Stone Fox'.split(' ');
const OTHER = ['陈思远', '김하늘', 'محمد العلي', 'Дмитрий Орлов', 'Nguyễn Thu Hà', 'ศิริพร ใจดี', 'Ελένη Παππά', 'ऋषभ मेहता'];
const NICK = { Alessio: 'Al', Bronwen: 'Bron', Dariusz: 'Darek', Dmitri: 'Dima', Esperanza: 'Espe', Ignacio: 'Nacho', Lachlan: 'Lachie', Marisela: 'Mari', Mattias: 'Matti', Nikolai: 'Kolya', Olamide: 'Ola', Saoirse: 'Seer', Teodor: 'Teo', Thandiwe: 'Thandi', Valentin: 'Val', Xiomara: 'Xio', Zainab: 'Zee' };
const REL = ['stepmum', 'dad', 'big sister', 'twin brother', 'nan', 'grandad', 'uncle', 'auntie', 'cousin', 'best friend', 'neighbour', 'host mum', 'foster carer', 'baby brother'];
const TITLE = ['Mr', 'Ms', 'Mrs', 'Coach', 'Mx', 'Dr.', 'Señora', 'Mr.'];
const SCHOOLS = [['Ashgrove Community College', 'Ashgrove'], ['Northfield Grammar School', 'Northfield'], ['Riverside Academy', 'Riverside'], ['Our Lady of the Valley High School', 'Our Lady'], ['Harcourt Park School', 'Harcourt Park']];
const TOWNS = ['Oakhampton', 'Little Barrow', 'Kestrel Bay', 'Stanmore', 'Greyfield', 'Penhallow', 'Ivybridge', 'Westmere'];
const STREETS = ['Mulberry', 'Station', 'Ferndale', 'Orchard', 'Kingsway', 'Hawthorn', 'Mill'];
const STREET_KIND = ['Road', 'Street', 'Way', 'Gardens', 'Crescent', 'Rd', 'Court'];
const MONTH = 'January February March April May June July August September October November December'.split(' ');

// Each subject has its own public people and places (never identifying), its task sheet and the sentences students write in it.
const SUBJECTS = [
  { subject: 'English', people: ['Gatsby', 'Daisy', 'Nick Carraway', 'Tom Buchanan', 'F. Scott Fitzgerald', 'Myrtle', 'Jordan Baker'], places: ['West Egg', 'East Egg', 'New York'],
    task: 'The Great Gatsby: how does Fitzgerald use Nick Carraway as a narrator? 800 words.',
    body: ['{pub} throws parties to impress someone who never comes.', 'The green light shows how far {pub} is from what he wants.', 'Fitzgerald makes {pub} both charming and empty.', 'By chapter seven {pub} and {pub2} can no longer pretend.', 'The trip to {pplace} is where the tension finally breaks.', 'Some readers think {pub} is the real villain.'] },
  { subject: 'History', people: ['Martin Luther King', 'Rosa Parks', 'Malcolm X', 'Lyndon Johnson', 'Ella Baker', 'John Lewis'], places: ['Montgomery', 'Selma', 'Birmingham', 'Washington'],
    task: 'Source analysis: the civil rights movement 1954-1968. Use at least two sources, for example Rosa Parks or Martin Luther King.',
    body: ['In {oldyear}, {pub} was already well known in {pplace}.', 'Source B, a speech by {pub}, is useful but one-sided.', 'The march from {pplace} changed public opinion.', '{pub} and {pub2} disagreed about how fast change should come.', 'The photograph in Source A was taken in {pplace} in {oldyear}.', 'Historians still argue about what {pub} achieved.'] },
  { subject: 'Science', people: ['Rosalind Franklin', 'Darwin', 'Marie Curie', 'Mendel', 'Newton'], places: ['the Galapagos', 'Cambridge'],
    task: 'Practical write-up: rate of reaction. Link your conclusion to collision theory. Optional extension: how did Marie Curie measure radioactivity?',
    body: ['We measured the time for the cross to disappear at five temperatures.', 'My lab partner {mateF} {mateL} recorded the results while I timed it.', 'Like {pub}, we had to repeat the test when the first result looked wrong.', 'The rate doubled between 20 and 30 degrees.', 'One source of error was that {mateF} started the stopwatch late.', '{pub} showed that careful measurement matters more than a big idea.'] },
  { subject: 'Personal statement', people: ['Serena Williams', 'Malala Yousafzai', 'David Attenborough', 'Greta Thunberg'], places: ['Kenya', 'Iceland', 'London'],
    task: 'Draft your personal statement (4000 characters). Say why you want to study your subject and what you have done outside school.',
    body: ['I want to study medicine because of my {rel}, {relName}, who is a nurse.', 'Watching {pub} on television made me want to work outdoors.', 'Last summer I volunteered at the food bank on {addr}.', 'My {rel} {relName} {lastR} taught me to code when I was nine.', 'I captain the netball team and coach the under-elevens on Sundays.', 'A trip to {pplace} showed me how fragile coastlines are.', '{teacher} let me run the science club after school.'] },
  { subject: 'Trip reflection', people: ['Barbara Hepworth', 'Turner', 'Henry Moore'], places: ['Tate St Ives', 'Cornwall', 'the Eden Project'],
    task: 'Reflection: our art trip to Cornwall. What did you see at Tate St Ives and how will it change your final piece?',
    body: ['On the coach I sat next to {mateF}, who slept the whole way.', 'The sculptures by {pub} looked smaller than in the photos.', 'My favourite part was the beach at {pplace}.', '{teacher} said we could sketch for an hour before lunch.', '{mateF} and I shared a room with {mate2F}.', 'Seeing {pub} in real life made me change my colour scheme.'] },
];

const HEADERS = ['{self}\n{subject}\n', 'Name: {self}   Form: {form}\n', '{selfF} {selfL} - {subject} - {teacher}\n', 'From: {email}\nTo: {teacher}\nSubject: my draft\n\nHi {teacherBare},\n', '{subject} homework, {selfF}\n', '', '', ''];
const PERSONAL = [
  'My {rel} {relName} helped me check this.', 'I wrote most of this at my {rel}\'s flat.', '{relName}, my {rel}, says I should be a lawyer.', 'Sorry this is late, {teacherBare}: I was ill on Monday.',
  'If you need me, my mobile is {phone}.', 'You can email me at {email} over the holidays.', 'My candidate number is {sid}.', 'Student number: {sid}', 'I live at {addr}, {town}, so I can drop the paper in.',
  'My date of birth is {dob}.', 'I turned sixteen on {dob}.', 'Everyone calls me {nick}, even the teachers.', 'People call me {nick} because {selfF} is too long.', '{mate} and I worked on this together.',
  'Thanks to {mateF} for lending me a calculator.', 'I asked {teacher} about this in the lesson.', '{other} is how my grandmother writes my name.', 'Signed, {self}', 'From {selfF}', '- {nick}',
  'I go to {schoolS} but I moved here from {town} last year.', 'At {school} we only have one lab.',
];
const SHARED = ['This shows that the evidence is mixed.', 'In conclusion, the question has no simple answer.', 'Overall I am pleased with this draft.', 'Next time I will plan more carefully.', 'Firstly, the method was fair.', 'However, there is another way to read this.', 'Sunday was the only day I could work on it.', 'Faith in the system is not the same as trust.', 'Summer holidays give students time to read.', 'Mercy is a theme that keeps coming back.'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 53) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], papers = [];
  const digits = k => Array.from({ length: k }, () => Math.floor(r() * 10)).join('');
  let cls = null;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 0) {
      const seen = new Set(), roster = [];
      while (roster.length < 20) { const first = r() < .1 ? pick(FIRST_WORD) : pick(FIRST), last = r() < .12 ? pick(LAST_WORD) : pick(LAST); if (seen.has(first)) continue; seen.add(first); roster.push({ first, last }); }
      const sub = SUBJECTS[(i / 20) % SUBJECTS.length], sc = pick(SCHOOLS);
      cls = { roster, names: roster.map(s => s.first + ' ' + s.last), ...sub, teacher: r() < .25 ? pick(LAST_WORD) : pick(LAST), title: pick(TITLE), school: sc[0], schoolS: sc[1], towns: [pick(TOWNS), pick(TOWNS)], form: pick(['10B', '11R', 'Y12', '9H']) };
    }
    const self = cls.roster[i % 20], mates = cls.roster.filter(s => s !== self);
    let text = '', spans = [];
    const fill = tpl => {
      const mate = pick(mates), mate2 = pick(mates.filter(m => m !== mate)), pp = () => pick(cls.people);
      const plain = s => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
      const v = {
        self: [self.first + ' ' + self.last, 'PERSON', 'self'], selfF: [self.first, 'PERSON', 'self'], selfL: [self.last, 'PERSON', 'self'],
        nick: [NICK[self.first] || self.first.slice(0, 3), 'PERSON', 'nick'], mate: [mate.first + ' ' + mate.last, 'PERSON', 'mate'], mateF: [mate.first, 'PERSON', 'mate'], mateL: [mate.last, 'PERSON', 'mate'], mate2F: [mate2.first, 'PERSON', 'mate'],
        relName: [r() < .15 ? pick(FIRST_WORD) : pick(FIRST), 'PERSON', 'other'], lastR: [pick(LAST), 'PERSON', 'other'], rel: [pick(REL)],
        teacherBare: [cls.teacher, 'PERSON', 'teacher'], school: [cls.school, 'SCHOOL'], schoolS: [cls.schoolS, 'SCHOOL'], town: [pick(cls.towns), 'PLACE'],
        addr: [String(1 + Math.floor(r() * 220)) + ' ' + pick(STREETS) + ' ' + pick(STREET_KIND), 'PLACE'],
        phone: [pick([() => '07' + digits(3) + ' ' + digits(6), () => '+44 7' + digits(3) + ' ' + digits(3) + ' ' + digits(3), () => digits(3) + '-' + digits(3) + '-' + digits(4)])(), 'CONTACT'],
        email: [pick([() => plain(self.first) + '.' + plain(self.last), () => plain(self.first)[0] + plain(self.last) + digits(2), () => plain(self.last) + '_' + plain(self.first)])() + '@' + pick(['gmail.com', 'outlook.com', 'students.' + plain(cls.schoolS) + '.org']), 'CONTACT'],
        sid: [pick([() => digits(5), () => 'C' + digits(6), () => digits(4) + '-' + digits(3)])(), 'ID'],
        dob: [pick([() => (1 + Math.floor(r() * 28)) + '/' + (1 + Math.floor(r() * 12)) + '/' + (2007 + Math.floor(r() * 5)), () => (1 + Math.floor(r() * 28)) + ' ' + pick(MONTH) + ' ' + (2007 + Math.floor(r() * 5)), () => pick(MONTH) + ' ' + (1 + Math.floor(r() * 28)) + 'th'])(), 'DATE'],
        other: [pick(OTHER), 'PERSON', 'other'], subject: [cls.subject], form: [cls.form],
        pub: [pp(), 'PUBLIC'], pub2: [pp(), 'PUBLIC'], pplace: [pick(cls.places), 'PUBLIC'], oldyear: [String(1955 + Math.floor(r() * 13))],
      };
      let out = '';
      tpl.replace(/\{(\w+)\}|([^{]+)/g, (m, slot, lit) => {
        if (lit) { out += lit; return ''; }
        if (slot === 'teacher') { const t = cls.title + ' '; out += t; spans.push({ start: text.length + out.length, end: text.length + out.length + cls.teacher.length, type: 'PERSON', who: 'teacher', value: cls.teacher }); out += cls.teacher; return ''; }
        const [val, type, who] = v[slot];
        if (type) spans.push({ start: text.length + out.length, end: text.length + out.length + val.length, type, who, value: val });
        out += val; return '';
      });
      return out;
    };
    text += fill(pick(HEADERS));
    // most of a paper is the subject; a few sentences are the student's own life, and a few are things anyone might write
    const lines = [];
    const take = (pool, n) => { const used = new Set(); for (let j = 0; j < n; j++) { let t; do t = pick(pool); while (used.has(t)); used.add(t); lines.push(t); } };
    take(cls.body, 3 + Math.floor(r() * 3)); take(PERSONAL, 1 + Math.floor(r() * 4)); take(SHARED, 1 + Math.floor(r() * 3));
    for (let j = lines.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [lines[j], lines[k]] = [lines[k], lines[j]]; }
    for (const t of lines) text += fill(t) + (r() < .25 ? '\n' : ' ');
    const trimmed = text.trim();
    papers.push({ id: 'blind3-' + i, genre: 'blind3', student: self.first + ' ' + self.last, roster: cls.names, task: cls.task, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
