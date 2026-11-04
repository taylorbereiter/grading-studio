// The fourth blind set: English classes only, written 11/4 after the list of authors and characters (src/redact-public.txt) and
// before anything was scored on it. Half the classes read a book on that list and half read one that isn't, so the score shows
// what happens when a teacher teaches something the list doesn't know. The writing is the kinds an English class hands in:
// essay paragraphs with quotes, creative writing with made-up characters, personal narrative, reading logs, emails and peer review.
// Many students are Chinese and write their names in pinyin or with an English name. Every student, relative, teacher, school,
// street and number is invented; given and family names are mixed at random.
'use strict';

const FIRST = ('Wang Hao|Li Na|Zhang Wei|Liu Yang|Chen Jing|Yang Mei|Zhao Lei|Huang Xin|Zhou Yu|Wu Ting|Xu Ming|Sun Li|Ma Rui|Hu Jun|Guo Yan|Lin Feng|He Ping|Gao Yi|Luo Qing|Zheng Bo').split('|').map(n => n.split(' '));
const PINYIN_GIVEN = 'Haoran Yuxuan Zixuan Xinyi Yutong Junjie Jiahui Siyu Mingze Ruoxi Tianyu Kexin Wenjie Shuhan Yichen Zhiyuan Mengyao Boyang Xiaoyu Jiayi'.split(' ');
const PINYIN_FAMILY = 'Wang Li Zhang Liu Chen Yang Zhao Huang Zhou Wu Xu Sun Ma Zhu Hu Guo He Lin Gao Luo Zheng Liang Xie Tang Han Feng Deng Cao Peng Zeng'.split(' ');
const ENGLISH_NAME = 'Kevin Cindy Tony Vivian Eric Jessica Leo Coco Jason Angela Ryan Fiona Alex Iris Bruce Sunny Lucky Apple Cherry Dragon'.split(' ');
const WEST_GIVEN = 'Aaliyah Brody Camila Declan Esme Finnegan Greer Hamish Isla Jude Kenzie Leland Maeve Nico Odette Pax Rhiannon Sawyer Tilly Wren'.split(' ');
const WEST_FAMILY = 'Abbott Barnes Calloway Dempsey Ellison Fairbanks Grantham Holloway Iverson Jennings Kirkland Lockhart Merriweather Northcott Pemberton Radcliffe Sinclair Thackeray Underwood Whitcombe'.split(' ');
const NICK = { Haoran: 'Ran', Yuxuan: 'Xuan', Zixuan: 'Xuanxuan', Xinyi: 'Yiyi', Junjie: 'JJ', Mingze: 'Ming', Tianyu: 'Tian', Wenjie: 'Wen', Xiaoyu: 'Xiaoxiao', Jiayi: 'Jia', Brody: 'Bro', Finnegan: 'Finn', Hamish: 'Hame', Kenzie: 'Kenz', Leland: 'Lee', Rhiannon: 'Rhi', Odette: 'Detta', Declan: 'Dec' };
const REL = ['mum', 'mom', 'dad', 'grandma', 'grandpa', 'nainai', 'yeye', 'older cousin', 'little brother', 'sister', 'aunt', 'uncle', 'best friend', 'tutor', 'piano teacher'];
const TITLE = ['Mr', 'Ms', 'Mrs', 'Mr.', 'Ms.', 'Miss', 'Dr'];
const SCHOOLS = [['Westbridge International School', 'Westbridge'], ['Harbourview Academy', 'Harbourview'], ['St. Columba\'s School', 'St. Columba\'s'], ['Pinecrest High School', 'Pinecrest']];
const TOWNS = ['Ashford', 'Lantern Bay', 'Millbrook', 'Southgate', 'Elmwood', 'Kettering Heath'];
const STREETS = ['Acacia', 'Bellevue', 'Chestnut', 'Garden', 'Riverside', 'Sycamore', 'Willow'];
const STREET_KIND = ['Road', 'Street', 'Avenue', 'Lane', 'Drive', 'Terrace'];
const MONTH = 'January February March April May June July August September October November December'.split(' ');

// listed: the book is on src/redact-public.txt's list. people and places belong to the book and never identify a student.
const BOOKS = [
  { book: 'Macbeth', listed: true, people: ['Macbeth', 'Lady Macbeth', 'Banquo', 'Duncan', 'Macduff', 'Shakespeare', 'Malcolm'], places: ['Scotland', 'Dunsinane'], quote: '"Fair is foul, and foul is fair"',
    task: 'Macbeth essay: how does Shakespeare present ambition? Write about Macbeth and Lady Macbeth.' },
  { book: 'Of Mice and Men', listed: true, people: ['George', 'Lennie', 'Curley', 'Crooks', 'Candy', 'Steinbeck', 'Slim'], places: ['Soledad', 'Salinas River'], quote: '"A guy needs somebody"',
    task: 'Of Mice and Men: explore loneliness in the novel. Refer to Crooks and Candy.' },
  { book: 'To Kill a Mockingbird', listed: true, people: ['Scout', 'Atticus', 'Boo Radley', 'Tom Robinson', 'Harper Lee', 'Jem', 'Calpurnia'], places: ['Maycomb', 'Alabama'], quote: '"You never really understand a person until you consider things from his point of view"',
    task: 'To Kill a Mockingbird: how does Harper Lee show the loss of innocence?' },
  { book: 'An Inspector Calls', listed: true, people: ['Inspector Goole', 'Mr Birling', 'Sheila', 'Eric', 'Gerald', 'Eva Smith', 'Priestley'], places: ['Brumley'], quote: '"We are members of one body"',
    task: 'An Inspector Calls: how does Priestley present responsibility?' },
  { book: 'Animal Farm', listed: true, people: ['Napoleon', 'Snowball', 'Boxer', 'Squealer', 'Old Major', 'Orwell', 'Benjamin'], places: ['Manor Farm'], quote: '"All animals are equal"',
    task: 'Animal Farm: how does Orwell use Squealer to show the power of language?' },
  { book: 'The Giver', listed: false, people: ['Jonas', 'Gabriel', 'Fiona', 'Asher', 'Lois Lowry', 'Rosemary'], places: ['the Community', 'Elsewhere'], quote: '"The worst part of holding the memories is not the pain"',
    task: 'The Giver: is sameness worth the cost? Use Jonas and the Giver as evidence.' },
  { book: 'Long Way Down', listed: false, people: ['Will', 'Shawn', 'Buck', 'Dani', 'Jason Reynolds', 'Mikey'], places: ['the elevator'], quote: '"No crying. No snitching. Revenge."',
    task: 'Long Way Down by Jason Reynolds: how does the verse form shape Will\'s story?' },
  { book: 'Klara and the Sun', listed: false, people: ['Klara', 'Josie', 'Rick', 'Mr Capaldi', 'Ishiguro', 'Manager'], places: ['the store'], quote: '"The Sun always has ways to reach us"',
    task: 'Klara and the Sun: what does Ishiguro suggest about love? Refer to Klara and Josie.' },
  { book: 'Station Eleven', listed: false, people: ['Kirsten', 'Arthur Leander', 'Jeevan', 'Miranda', 'Emily St. John Mandel', 'the Prophet'], places: ['Severn City', 'Toronto'], quote: '"Survival is insufficient"',
    task: 'Station Eleven: why does art matter after the collapse? Use Kirsten and the Travelling Symphony.' },
  { book: 'Poetry anthology', listed: false, people: ['Warsan Shire', 'Imtiaz Dharker', 'Ocean Vuong', 'Simon Armitage', 'Carol Ann Duffy', 'John Agard'], places: ['Mogadishu', 'Saigon'], quote: '"no one leaves home unless home is the mouth of a shark"',
    task: 'Compare how two poets present identity. You may use Warsan Shire, Imtiaz Dharker or John Agard.' },
];

const HEADERS = [
  '{self}\n{teacher}\nEnglish 10\n{today}\n\n', '{self}\n{book} essay\n', 'Name: {self}\nClass: 10{form}\n', '{self} ({english})\n', '{english} {family}\n{today}\n',
  'Dear {teacher},\n', 'Hi {teacherBare},\n\n', '{family} {given}\n', '', '', '',
];
const ESSAY = [
  'In {book}, {pub} is presented as someone who cannot escape the past.', 'The quotation {quote} shows that {pub} is more aware than the others.', 'When {pub} speaks to {pub2}, the tone changes completely.',
  'The writer uses {pub} to criticise the society of the time.', 'Many readers sympathise with {pub} by the final chapter.', '{pub} is a foil to {pub2}.', 'The setting of {pplace} reflects the mood of the characters.',
  'This is shown when {pub} says {quote}.', 'Through {pub}, the author explores guilt and responsibility.', 'At first {pub} seems confident, but this does not last.',
  'Some critics argue that {pub} is the real hero.', '{pub}\'s final decision is the climax of the text.', 'The image of light links {pub} to hope.',
];
const CREATIVE = [
  'The rain had not stopped for three days when Marcus found the letter.', 'Elena pressed her face against the cold glass and waited.', '"Run," whispered Theo, and they ran.',
  'Nobody in the village of Thornwick had ever seen the sea.', 'Captain Ardent looked at the map one last time.', 'Ivy Moreland was twelve when the lights went out.',
];
const PERSONAL = [
  'My {rel} {relName} read my first draft and said it was too long.', 'I wrote this at my {rel}\'s house because our wifi was down.', 'Last summer my {rel} {relName} took me to {town} to see where she grew up.',
  'My {rel}, {relName}, came here from Guangzhou when she was nineteen.', '{relName} {lastR}, my {rel}, says I should read more poetry.', 'Peer reviewed by {mate}.', 'Thanks to {mateGiven} for checking my quotes.',
  '{mateGiven} and I argued about the ending for the whole lesson.', 'Sorry it is late, {teacherBare}, I had a fever on Tuesday.', 'Please email me at {email} if there is a problem with the file.',
  'My phone is {phone} if the group chat breaks again.', 'Student number {sid}', 'My exam candidate number is {sid}.', 'I live at {addr} in {town}, which is near the library.',
  'My birthday is {dob}, so I will be away that day.', 'I was born on {dob}.', 'Everyone calls me {nick}.', 'My friends call me {nick} because it is easier to say.', 'At {schoolS} we do not have a library, so I used the one in {town}.',
  'Reading log: pages 40 to 62, read on the bus to {town}.', '{other} is my name in Chinese.', 'My Chinese name is {other}.', 'Love, {english}', 'Thank you,\n{selfGiven}', '- {nick}',
];
const SHARED = ['In conclusion, the text still matters today.', 'Overall, I think the ending is fair.', 'However, there is another way to read this.', 'Firstly, the opening is important.', 'Word count: 742', 'Next time I will plan my paragraphs first.', 'Hope you like it!', 'Bibliography: class copy of the text.'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 67) {
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
      cls = { roster, ...b, teacher: pick(WEST_FAMILY.concat(['Fox', 'Wells', 'Hart', 'Lee', 'Chen'])), title: pick(TITLE), school: sc[0], schoolS: sc[1], form: pick(['A', 'B', 'C']) };
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
        relName: [r() < .3 ? pick(PINYIN_GIVEN) : pick(['Margaret', 'Lily', 'Daniel', 'Rose', 'Sam', 'Grace', 'Joy', 'Mei', 'Hui']), 'PERSON', 'other'], lastR: [pick(PINYIN_FAMILY.concat(WEST_FAMILY)), 'PERSON', 'other'], rel: [pick(REL)],
        teacherBare: [cls.teacher, 'PERSON', 'teacher'], schoolS: [cls.schoolS, 'SCHOOL'], town: [pick(TOWNS), 'PLACE'],
        addr: [String(1 + Math.floor(r() * 180)) + ' ' + pick(STREETS) + ' ' + pick(STREET_KIND), 'PLACE'],
        phone: [pick([() => '07' + digits(3) + ' ' + digits(6), () => '+86 1' + digits(2) + ' ' + digits(4) + ' ' + digits(4), () => '1' + digits(10), () => '(' + digits(3) + ') ' + digits(3) + '-' + digits(4)])(), 'CONTACT'],
        email: [pick([() => plain(call(self)) + '.' + plain(self.family), () => plain(self.family) + plain(self.given) + digits(3), () => plain(call(self)) + digits(4)])() + '@' + pick(['gmail.com', 'qq.com', '163.com', 'student.' + plain(cls.schoolS) + '.edu']), 'CONTACT'],
        sid: [pick([() => digits(6), () => 'S' + digits(5), () => digits(4)])(), 'ID'],
        dob: [pick([() => (1 + Math.floor(r() * 28)) + ' ' + pick(MONTH) + ' ' + (2008 + Math.floor(r() * 4)), () => pick(MONTH) + ' ' + (1 + Math.floor(r() * 28)) + ', ' + (2008 + Math.floor(r() * 4)), () => (2008 + Math.floor(r() * 4)) + '-0' + (1 + Math.floor(r() * 9)) + '-1' + Math.floor(r() * 9)])(), 'DATE'],
        other: [pick(['王浩然', '李雨萱', '张子轩', '刘欣怡', '陈雨桐', '杨俊杰', '赵佳慧', '黄思雨']), 'PERSON', 'other'],
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
    papers.push({ id: 'blind4-' + i, genre: 'blind4', student: cls.names[i % 20], roster: cls.names, task: cls.task, listed: cls.listed, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
