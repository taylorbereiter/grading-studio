// The sixth and last English blind set, written 11/4 after every change prompted by the fifth and before anything was scored on
// it. New names (Korean, Indian, Nigerian, Latin American and Polish students beside the others), new books, and new kinds of
// writing: an email to the teacher, a peer-review form, a reflection log, a poem analysis, a persuasive letter and a play script.
// Half the books are on src/redact-public.txt's list and half are not. Every student, relative, teacher, school, street and
// number is invented; given and family names are mixed at random.
'use strict';

const PINYIN_GIVEN = 'Boyang Xinyi Junhao Yutong Zhixuan Haoran Shuyi Tianyu Ziyi Kexin Ruochen Wenjie Yiming Siqi Jiahui'.split(' ');
const PINYIN_FAMILY = 'Liang Song Tang Han Feng Deng Cao Peng Zeng Xiao Tian Dong Yuan Pan Cai Du Ye Cheng Wei Lu Ding Ren Yao Lu Jiang Cui Zhong Tan'.split(' ');
const ENGLISH_NAME = 'Kevin Cindy Leo Coco Eric Fiona Tony Vivian Alex Echo Sunny Apple Lucky Snow Ocean'.split(' ');
const WORLD_GIVEN = 'Seo-yeon Ji-ho Min-jun Aarav Ishaan Priya Ananya Chidi Adaeze Tobenna Valentina Mateo Ximena Santiago Zofia Kacper Wiktoria Leilani Soren Maeve Callum Esme Rhys Ottilie'.split(' ');
const WORLD_FAMILY = 'Park Choi Jung Kang Sharma Iyer Kapoor Reddy Okafor Eze Nwosu Adeyemi Castillo Vargas Medina Ochoa Kowalczyk Nowak Wozniak Brennan Whitlock Pemberton Galloway Achterberg'.split(' ');
const NICK = { Boyang: 'BY', Xinyi: 'Xinxin', Junhao: 'Jun', Yutong: 'Tongtong', Tianyu: 'Tian', Kexin: 'Kiki', 'Seo-yeon': 'Seo', 'Min-jun': 'MJ', Aarav: 'Aaru', Ishaan: 'Ish', Ananya: 'Anu', Tobenna: 'Tobi', Adaeze: 'Ada', Valentina: 'Vale', Santiago: 'Santi', Wiktoria: 'Wiki', Ottilie: 'Tilly', Callum: 'Cal' };
const REL = ['mum', 'dad', 'nani', 'dadi', 'abuela', 'halmeoni', 'ye ye', 'nai nai', 'older sister', 'younger brother', 'stepmum', 'guardian', 'host mum', 'tutor', 'cousin'];
const TITLE = ['Mr', 'Ms', 'Mrs', 'Mr.', 'Ms.', 'Dr', 'Miss'];
const SCHOOLS = [['Harrowgate Grammar School', 'Harrowgate'], ['Westbury International Academy', 'Westbury'], ['Cedar Ridge High School', 'Cedar Ridge'], ['St. Columba\'s School', 'St. Columba\'s']];
const TOWNS = ['Ashby Marsh', 'Kettleford', 'Northbrook', 'Pine Hollow', 'Wrenfield', 'Stonebridge'];
const STREETS = ['Acorn', 'Bramble', 'Chestnut', 'Heron', 'Meadow', 'Orchard', 'Willowbank'];
const STREET_KIND = ['Lane', 'Drive', 'Crescent', 'Road', 'Terrace', 'Court'];
const MONTH = 'January February March April May June July August September October November December'.split(' ');

const BOOKS = [
  { book: 'Macbeth', listed: true, people: ['Macbeth', 'Lady Macbeth', 'Banquo', 'Macduff', 'Duncan', 'Malcolm', 'Shakespeare'], places: ['Scotland', 'Dunsinane'], quote: '"Fair is foul, and foul is fair"',
    task: 'Macbeth: how does Shakespeare present ambition through Macbeth and Lady Macbeth?' },
  { book: 'Of Mice and Men', listed: true, people: ['George', 'Lennie', 'Curley', 'Candy', 'Crooks', 'Slim', 'Steinbeck'], places: ['Soledad', 'the ranch'], quote: '"Guys like us… are the loneliest guys in the world"',
    task: 'Of Mice and Men: how does Steinbeck present loneliness? Refer to Crooks and Candy.' },
  { book: 'Jane Eyre', listed: true, people: ['Jane', 'Rochester', 'Bertha', 'St. John Rivers', 'Helen Burns', 'Mrs Reed', 'Charlotte Brontë'], places: ['Thornfield', 'Lowood'], quote: '"I am no bird; and no net ensnares me"',
    task: 'Jane Eyre: how does Brontë present Jane\'s search for independence?' },
  { book: 'The Hate U Give', listed: true, people: ['Starr', 'Khalil', 'Maverick', 'Chris', 'Hailey', 'Angie Thomas', 'DeVante'], places: ['Garden Heights', 'Williamson'], quote: '"What\'s the point of having a voice if you\'re gonna be silent?"',
    task: 'The Hate U Give: how does Angie Thomas show Starr finding her voice?' },
  { book: 'Poetry anthology', listed: true, people: ['Seamus Heaney', 'Carol Ann Duffy', 'Simon Armitage', 'Wilfred Owen', 'Maya Angelou'], places: ['the Somme'], quote: '"Dulce et decorum est"',
    task: 'Compare how two poets present conflict. Use Owen and one other poet.' },
  { book: 'Long Way Down', listed: false, people: ['Will', 'Shawn', 'Buck', 'Dani', 'Uncle Mark', 'Jason Reynolds', 'Frick'], places: ['the elevator'], quote: '"No crying. No snitching. Revenge."',
    task: 'Long Way Down by Jason Reynolds: how does the verse form build tension?' },
  { book: 'Klara and the Sun', listed: false, people: ['Klara', 'Josie', 'Rick', 'the Mother', 'the Father', 'Kazuo Ishiguro', 'Melania Housekeeper'], places: ['the store'], quote: '"There was something very special, but it wasn\'t inside Josie"',
    task: 'Klara and the Sun: what does Ishiguro suggest about love through Klara?' },
  { book: 'The Book Thief', listed: false, people: ['Liesel', 'Hans', 'Rosa', 'Max', 'Rudy', 'Markus Zusak', 'Death'], places: ['Molching', 'Himmel Street'], quote: '"I am haunted by humans"',
    task: 'The Book Thief: how does Zusak use Death as a narrator? Discuss Liesel and Max.' },
  { book: 'Purple Hibiscus', listed: false, people: ['Kambili', 'Jaja', 'Papa', 'Aunty Ifeoma', 'Amaka', 'Father Amadi', 'Adichie'], places: ['Enugu', 'Nsukka'], quote: '"Things started to fall apart at home"',
    task: 'Purple Hibiscus: how does Adichie present freedom through Kambili and Jaja?' },
  { book: 'Persepolis', listed: false, people: ['Marji', 'Marjane Satrapi', 'Anoosh', 'Grandmother', 'Ebi', 'Taji'], places: ['Tehran', 'Vienna'], quote: '"The world is basically divided into two"',
    task: 'Persepolis: how does Satrapi use images to tell a personal story?' },
];

const HEADERS = [
  'Subject: essay draft\nHi {teacher},\n', 'PEER REVIEW\nWriter: {self}\nReviewer: {mate}\n', 'Reflection log, week {form}\nName: {self}\n', '{self} | {schoolS} | Year 10\n',
  'Name: {family}, {given}\nTeacher: {teacher}\n', '{book} – persuasive letter\n', 'SCENE ONE\n', '{selfGiven} {family}\n\n', '', '', '',
];
const ESSAY = [
  'From the start, {pub} is driven by fear.', 'It is {pub} who pushes the story forward.', 'The phrase {quote} shows how trapped {pub} feels.', 'Unlike {pub2}, {pub} never questions the rules.',
  'Some critics argue that {pub} is a victim.', 'At the climax, {pub} finally speaks up.', 'Arguably, {pub} is the moral centre of the text.', '{pub} and {pub2} both lose something they love.',
  'Notice the short sentences when {pub} is afraid.', 'Moving to {pplace} changes how {pub} sees the world.', 'If I could ask {pub} one question, I would ask why.', 'This is where my sympathy for {pub} grows.',
];
const CREATIVE = ['NORA: You said you would come back.', 'Felix pulled the hood over his face and kept walking.', 'Grandpa Elias kept a jar of buttons on the windowsill.', 'The ferry to Inishmore left without us.'];
const PERSONAL = [
  'My {rel} {relName} read my draft and said it was too long.', 'I talked about the ending with my {rel}, {relName}.', 'My {rel}, {relName} {lastR}, is a nurse and works nights.', 'Last summer I stayed with my {rel} in {town}.',
  'What went well: your quotes. Even better if: explain more. ({mate})', 'Reviewer comment: {mateGiven}, this paragraph is really clear.', '{mateGiven} and I swapped drafts on Friday.', 'Thanks to {mateGiven} for proofreading.',
  'Sorry {teacherBare}, I was off sick on Monday.', 'You can email me at {email}.', 'My number is {phone} if the file does not open.', 'Exam number: {sid}', 'Student number {sid}', 'I live at {addr} in {town}.', 'My birthday is {dob}.',
  'Born {dob}.', 'My friends call me {nick}.', 'Most people just say {nick}.', 'I moved to {schoolS} last year.', 'Thanks, {selfGiven}', 'From {nick}', 'Kind regards,\n{self}', 'My Korean name is {other}.', 'Written by {self}',
];
const SHARED = ['In conclusion, the text asks us to look again.', 'However, not every reader will agree.', 'Thank you for reading my letter.', 'We read this aloud in class.', 'Draft 2.', 'Word count: 812', 'Sorry it is late!', 'Autumn term assessment.'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 101) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], papers = [];
  const digits = k => Array.from({ length: k }, () => Math.floor(r() * 10)).join('');
  let cls = null;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 0) {
      const seen = new Set(), roster = [];
      // about half the class are Chinese students: pinyin family and given names, many with an English name too
      while (roster.length < 20) {
        let s;
        if (r() < .4) s = { given: pick(PINYIN_GIVEN), family: pick(PINYIN_FAMILY), english: r() < .6 ? pick(ENGLISH_NAME) : null, chinese: true };
        else s = { given: pick(WORLD_GIVEN), family: pick(WORLD_FAMILY), english: null };
        if (seen.has(s.given)) continue; seen.add(s.given); roster.push(s);
      }
      const b = BOOKS[(i / 20) % BOOKS.length], sc = pick(SCHOOLS);
      cls = { roster, ...b, teacher: pick(WORLD_FAMILY.concat(['Fox', 'Hart', 'Quinn', 'Oh', 'Das'])), title: pick(TITLE), school: sc[0], schoolS: sc[1], form: String(1 + Math.floor(r() * 9)) };
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
        relName: [r() < .3 ? pick(PINYIN_GIVEN) : pick(['Sunita', 'Marisol', 'Grace', 'Desmond', 'Hye-jin', 'Ngozi', 'Bartosz', 'Mei', 'Archie']), 'PERSON', 'other'], lastR: [pick(PINYIN_FAMILY.concat(WORLD_FAMILY)), 'PERSON', 'other'], rel: [pick(REL)],
        teacherBare: [cls.teacher, 'PERSON', 'teacher'], schoolS: [cls.schoolS, 'SCHOOL'], town: [pick(TOWNS), 'PLACE'],
        addr: [String(1 + Math.floor(r() * 180)) + ' ' + pick(STREETS) + ' ' + pick(STREET_KIND), 'PLACE'],
        phone: [pick([() => '+44 7' + digits(3) + ' ' + digits(6), () => '+82 10-' + digits(4) + '-' + digits(4), () => digits(3) + '.' + digits(3) + '.' + digits(4), () => '+91 ' + digits(5) + ' ' + digits(5)])(), 'CONTACT'],
        email: [pick([() => plain(call(self)) + '.' + plain(self.family), () => plain(self.family) + plain(self.given) + digits(3), () => plain(call(self)) + digits(4)])() + '@' + pick(['gmail.com', 'outlook.com', 'qq.com', 'students.' + plain(cls.schoolS) + '.org']), 'CONTACT'],
        sid: [pick([() => digits(7), () => 'HG' + digits(4), () => digits(5) + '-' + digits(2)])(), 'ID'],
        dob: [pick([() => (1 + Math.floor(r() * 28)) + ' ' + pick(MONTH) + ' ' + (2008 + Math.floor(r() * 4)), () => pick(MONTH) + ' ' + (1 + Math.floor(r() * 28)) + ', ' + (2008 + Math.floor(r() * 4)), () => (2008 + Math.floor(r() * 4)) + '-0' + (1 + Math.floor(r() * 9)) + '-1' + Math.floor(r() * 9)])(), 'DATE'],
        other: [pick(['박서연', '김지호', '이민준', '최수아', '정하윤']), 'PERSON', 'other'],
        today: [(1 + Math.floor(r() * 28)) + ' ' + pick(MONTH) + ' 2026'], form: [cls.form], quote: [cls.quote],
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
    papers.push({ id: 'blind6-' + i, genre: 'blind6', student: cls.names[i % 20], roster: cls.names, task: cls.task, listed: cls.listed, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
