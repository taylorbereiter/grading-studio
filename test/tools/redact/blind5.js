// The fifth blind set: English classes again, written 11/4 after every change prompted by the fourth and before anything was
// scored on it. New names, books, sentence shapes and kinds of writing (a speech, a book review, a diary entry, an argument essay,
// a letter to a character, comments to a classmate). Half the books are on src/redact-public.txt's list and half are not.
// Every student, relative, teacher, school, street and number is invented; given and family names are mixed at random.
'use strict';

const PINYIN_GIVEN = 'Yifan Zihan Ruoyu Haoyu Xiaoxuan Mingyu Jingyi Zeyu Wanting Kaiwen Shiyu Yuhang Xinran Zhenyu Qianyu Jiaming Yueran Zhihao Lanxi Chenxi'.split(' ');
const PINYIN_FAMILY = 'Qian Sun Zhou Wu Zheng Feng Jiang Shen Han Yang Zhu Qin You Xu He Lu Shi Zhang Kong Cao Yan Hua Jin Wei Tao Jiang Qi Xie Zou Yu Bai Ding'.split(' ');
const ENGLISH_NAME = 'Andy Bella Carl Daisy Ethan Grace Henry Ivy Jack Lily Mandy Nancy Oscar Peggy Rainbow Sky Winter Sugar Moon Tiger'.split(' ');
const WEST_GIVEN = 'Ainsley Beckett Cordelia Dashiell Eloise Fletcher Gemma Harlow Imogen Jasper Kit Linnea Magnus Nell Orla Piers Quinn Rosalind Tobias Vera'.split(' ');
const WEST_FAMILY = 'Ashdown Blackwood Carrington Delacroix Everett Forsythe Gilchrist Hawthorne Ingram Jessop Kingsley Langford Montague Nightingale Oakley Prescott Quayle Rutherford Stirling Thornbury'.split(' ');
const NICK = { Yifan: 'Fanfan', Zihan: 'Hanhan', Haoyu: 'Hao', Mingyu: 'Mimi', Kaiwen: 'KW', Yuhang: 'Hang', Zhenyu: 'Zz', Jiaming: 'Jimmy', Zhihao: 'Hao Hao', Chenxi: 'Xixi', Beckett: 'Beck', Cordelia: 'Delia', Dashiell: 'Dash', Fletcher: 'Fletch', Imogen: 'Immy', Magnus: 'Mags', Rosalind: 'Roz', Tobias: 'Toby' };
const REL = ['mother', 'father', 'gran', 'grandad', 'popo', 'gonggong', 'big brother', 'little sister', 'stepdad', 'godmother', 'cousin', 'aunty', 'uncle', 'neighbour', 'swim coach'];
const TITLE = ['Mr', 'Ms', 'Mrs', 'Mr.', 'Ms.', 'Dr.', 'Mx'];
const SCHOOLS = [['Kingsbridge College', 'Kingsbridge'], ['Fairhaven International School', 'Fairhaven'], ['Lakeside Secondary School', 'Lakeside'], ['St. Aidan\'s Academy', 'St. Aidan\'s']];
const TOWNS = ['Brookfield', 'Hollow Creek', 'Redmarsh', 'Silverton', 'Upton Vale', 'Glenmore'];
const STREETS = ['Beacon', 'Clover', 'Dovecote', 'Elm', 'Foxglove', 'Juniper', 'Larkspur'];
const STREET_KIND = ['Road', 'Street', 'Avenue', 'Close', 'Way', 'Grove'];
const MONTH = 'January February March April May June July August September October November December'.split(' ');

const BOOKS = [
  { book: 'Romeo and Juliet', listed: true, people: ['Romeo', 'Juliet', 'Mercutio', 'Tybalt', 'the Nurse', 'Friar Lawrence', 'Shakespeare'], places: ['Verona', 'Mantua'], quote: '"These violent delights have violent ends"',
    task: 'Romeo and Juliet: who is most to blame for the deaths? Consider Friar Lawrence and the Nurse.' },
  { book: 'Lord of the Flies', listed: true, people: ['Ralph', 'Piggy', 'Jack', 'Simon', 'Roger', 'Golding'], places: ['the island', 'Castle Rock'], quote: '"Maybe there is a beast… maybe it\'s only us"',
    task: 'Lord of the Flies: how does Golding present the loss of civilisation through Jack and Ralph?' },
  { book: 'A Christmas Carol', listed: true, people: ['Scrooge', 'Marley', 'Bob Cratchit', 'Tiny Tim', 'Fezziwig', 'Dickens', 'Fred'], places: ['London', 'Camden Town'], quote: '"I will honour Christmas in my heart"',
    task: 'A Christmas Carol: how does Dickens use Scrooge to explore redemption?' },
  { book: 'The Crucible', listed: true, people: ['John Proctor', 'Abigail', 'Elizabeth Proctor', 'Reverend Hale', 'Danforth', 'Arthur Miller', 'Mary Warren'], places: ['Salem', 'Massachusetts'], quote: '"Because it is my name!"',
    task: 'The Crucible: how does Miller present the power of reputation? Refer to John Proctor.' },
  { book: 'Frankenstein', listed: true, people: ['Victor', 'the Creature', 'Elizabeth', 'Clerval', 'Walton', 'Mary Shelley', 'Justine'], places: ['Geneva', 'Ingolstadt', 'the Arctic'], quote: '"I was benevolent and good; misery made me a fiend"',
    task: 'Frankenstein: is the Creature born a monster? Use Victor and Walton.' },
  { book: 'Ghost Boys', listed: false, people: ['Jerome', 'Carlos', 'Sarah', 'Emmett Till', 'Jewell Parker Rhodes', 'Kim'], places: ['Chicago'], quote: '"Only the living can make the world better"',
    task: 'Ghost Boys by Jewell Parker Rhodes: how does Jerome\'s voice shape the novel?' },
  { book: 'The Marrow Thieves', listed: false, people: ['Frenchie', 'Miig', 'Rose', 'Wab', 'Cherie Dimaline', 'RiRi'], places: ['the north'], quote: '"We need to find a place to land"',
    task: 'The Marrow Thieves: how does Cherie Dimaline use story to keep culture alive? Use Miig and Frenchie.' },
  { book: 'Piranesi', listed: false, people: ['Piranesi', 'the Other', 'Raphael', 'Susanna Clarke', 'Laurence Arne-Sayles'], places: ['the House'], quote: '"The Beauty of the House is immeasurable"',
    task: 'Piranesi: what does Susanna Clarke suggest about knowledge and wonder?' },
  { book: 'Educated', listed: false, people: ['Tara', 'Tara Westover', 'Shawn', 'Tyler', 'Gene'], places: ['Idaho', 'Buck\'s Peak'], quote: '"You can love someone and still choose to say goodbye"',
    task: 'Educated: how does Tara Westover present education as freedom?' },
  { book: 'Short stories', listed: false, people: ['Chimamanda Ngozi Adichie', 'Ted Chiang', 'Ken Liu', 'Jack', 'Kirin'], places: ['Lagos', 'Connecticut'], quote: '"Love is a choice"',
    task: 'Compare two short stories: The Paper Menagerie by Ken Liu and one other.' },
];

const HEADERS = [
  '{self}\nEnglish, {teacher}\n{today}\n\n', 'Book review: {book}\nby {self}\n', 'Student: {self}   Set: 9{form}\n', '{family}, {given}\n', 'To: {teacher}\nFrom: {self}\n\n', '{english} ({family})\n',
  'Good morning everyone. My name is {selfGiven} and today I will talk about {book}.\n', 'Dear diary,\n', '', '', '',
];
const ESSAY = [
  'I believe {pub} is the most complex character in the text.', 'When {pub} meets {pub2}, everything changes.', 'The line {quote} reveals what {pub} fears most.', '{pub} wants control, but loses it.',
  'Readers often blame {pub}, but I think the system is to blame.', 'Look at how {pub} speaks in the opening scene.', 'Even {pub} admits the plan has failed.', 'The contrast between {pub} and {pub2} is clear.',
  'In my view, {pub} changes the least.', 'The journey to {pplace} marks a turning point.', 'Dear {pub}, I understand why you did it, but I cannot forgive you.', '{pub} reminds me that people can change.',
];
const CREATIVE = ['Juno climbed the last step and looked down at the city.', '"Where is it?" asked Barnaby, holding the lamp higher.', 'The house on Wicker Hill had been empty for years.', 'Old Mrs Penhaligon never opened her curtains.'];
const PERSONAL = [
  'My {rel}, {relName}, helped me find better quotes.', 'I read the ending to my {rel} {relName} on the phone.', '{relName} {lastR} is my {rel} and she teaches English too.', 'My {rel} {relName} grew up in {town}.',
  'Great point here, {mateGiven}! Maybe add one more quote. (comment from {mate})', 'Comment from {mateGiven}: your intro is strong.', 'I worked with {mateGiven} on this plan.', '{mateGiven} lent me the book over half term.',
  'Apologies for the late submission, {teacherBare}; my laptop broke.', 'Contact: {email}', 'Call or text {phone}.', 'Candidate no. {sid}', 'ID: {sid}', 'My address is {addr}, {town}.', 'I will be fifteen on {dob}.',
  'DOB: {dob}', 'Please call me {nick}, everyone does.', 'My nickname is {nick}.', 'I joined {schoolS} in Year 7.', 'Signed: {self}', 'Cheers, {nick}', 'Best wishes,\n{selfGiven}', '{other} is my Chinese name.', 'From your student, {english}',
];
const SHARED = ['To sum up, the writer leaves us with hope.', 'On the other hand, the ending is bleak.', 'Thank you for listening.', 'Today we had a supply teacher.', 'I have attached my plan.', 'Word count: 655', 'Hope this is okay!', 'Spring term homework.'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 89) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], papers = [];
  const digits = k => Array.from({ length: k }, () => Math.floor(r() * 10)).join('');
  let cls = null;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 0) {
      const seen = new Set(), roster = [];
      // about half the class are Chinese students: pinyin family and given names, many with an English name too
      while (roster.length < 20) {
        let s;
        if (r() < .5) s = { given: pick(PINYIN_GIVEN), family: pick(PINYIN_FAMILY), english: r() < .6 ? pick(ENGLISH_NAME) : null, chinese: true };
        else s = { given: pick(WEST_GIVEN), family: pick(WEST_FAMILY), english: null };
        if (seen.has(s.given)) continue; seen.add(s.given); roster.push(s);
      }
      const b = BOOKS[(i / 20) % BOOKS.length], sc = pick(SCHOOLS);
      cls = { roster, ...b, teacher: pick(WEST_FAMILY.concat(['Bird', 'Moss', 'Ward', 'Ng', 'Lin'])), title: pick(TITLE), school: sc[0], schoolS: sc[1], form: pick(['X', 'Y', 'Z']) };
      // the roster as the teacher pastes it: Chinese students as Family Given, or with the English name first
      cls.names = roster.map(s => s.chinese ? (s.english && r() < .5 ? s.english + ' ' + s.family : s.given + ' ' + s.family) : s.given + ' ' + s.family);
    }
    const self = cls.roster[i % 20], mates = cls.roster.filter(s => s !== self);
    let text = '', spans = [];
    const fill = tpl => {
      const mate = pick(mates), pp = () => pick(cls.people), call = s => s.english || s.given;
      const plain = s => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
      const v = {
        self: [call(self) + ' ' + self.family, 'PERSON', 'self'], given: [self.given, 'PERSON', 'self'], family: [self.family, 'PERSON', 'self'], selfGiven: [call(self), 'PERSON', 'self'],
        english: [self.english || self.given, 'PERSON', 'self'], nick: [NICK[self.given] || call(self), 'PERSON', 'nick'],
        mate: [call(mate) + ' ' + mate.family, 'PERSON', 'mate'], mateGiven: [call(mate), 'PERSON', 'mate'],
        relName: [r() < .3 ? pick(PINYIN_GIVEN) : pick(['Patricia', 'Hope', 'Colin', 'June', 'Ray', 'Ling', 'Fang', 'Bonnie', 'Duncan']), 'PERSON', 'other'], lastR: [pick(PINYIN_FAMILY.concat(WEST_FAMILY)), 'PERSON', 'other'], rel: [pick(REL)],
        teacherBare: [cls.teacher, 'PERSON', 'teacher'], schoolS: [cls.schoolS, 'SCHOOL'], town: [pick(TOWNS), 'PLACE'],
        addr: [String(1 + Math.floor(r() * 180)) + ' ' + pick(STREETS) + ' ' + pick(STREET_KIND), 'PLACE'],
        phone: [pick([() => '07' + digits(3) + ' ' + digits(6), () => '+86 1' + digits(2) + ' ' + digits(4) + ' ' + digits(4), () => '1' + digits(10), () => '(' + digits(3) + ') ' + digits(3) + '-' + digits(4)])(), 'CONTACT'],
        email: [pick([() => plain(call(self)) + '.' + plain(self.family), () => plain(self.family) + plain(self.given) + digits(3), () => plain(call(self)) + digits(4)])() + '@' + pick(['icloud.com', 'yahoo.com', '126.com', 'pupils.' + plain(cls.schoolS) + '.sch.uk']), 'CONTACT'],
        sid: [pick([() => digits(6), () => 'S' + digits(5), () => digits(4)])(), 'ID'],
        dob: [pick([() => (1 + Math.floor(r() * 28)) + ' ' + pick(MONTH) + ' ' + (2008 + Math.floor(r() * 4)), () => pick(MONTH) + ' ' + (1 + Math.floor(r() * 28)) + ', ' + (2008 + Math.floor(r() * 4)), () => (2008 + Math.floor(r() * 4)) + '-0' + (1 + Math.floor(r() * 9)) + '-1' + Math.floor(r() * 9)])(), 'DATE'],
        other: [pick(['孙一凡', '周子涵', '吴若瑜', '郑浩宇', '冯晓萱', '蒋明宇', '沈静怡', '韩泽宇']), 'PERSON', 'other'],
        today: [(1 + Math.floor(r() * 28)) + ' ' + pick(MONTH) + ' 2025'], form: [cls.form], quote: [cls.quote],
        pub: [pp(), 'PUBLIC'], pub2: [pp(), 'PUBLIC'], book: [cls.book, 'PUBLIC'], pplace: [pick(cls.places), 'PUBLIC'],
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
    const lines = [], take = (pool, n) => { const used = new Set(); for (let j = 0; j < n; j++) { let t; do t = pick(pool); while (used.has(t)); used.add(t); lines.push(t); } };
    take(ESSAY, 3 + Math.floor(r() * 4)); take(PERSONAL, 1 + Math.floor(r() * 4)); take(SHARED, Math.floor(r() * 3)); if (r() < .2) take(CREATIVE, 2);
    for (let j = lines.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [lines[j], lines[k]] = [lines[k], lines[j]]; }
    for (const t of lines) text += fill(t) + (r() < .3 ? '\n' : ' ');
    const trimmed = text.trim();
    papers.push({ id: 'blind5-' + i, genre: 'blind5', student: cls.names[i % 20], roster: cls.names, task: cls.task, listed: cls.listed, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
