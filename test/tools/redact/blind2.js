// The second blind set, for the cover decision model: written before the decision model and never used to change it.
// Each class reads its own book and has a task sheet, one teacher, one school and two towns, like a real class does,
// so a name shared across the class is sometimes the book's and sometimes the class's own (its teacher, school or town).
// Every student, relative, teacher, school, street and number is invented; given and family names are mixed at random.
'use strict';

const FIRST = ('Amaru Anahera Aneurin Arwen Ayelet Baraka Bodhi Cosima Dagny Dashiell Ebru Efua Elio Eskander Farida Galen Gwyneth Hollis Idris Imogen Jessamy Jomo Kahurangi Kemal Kioko Lavrenti Leocadia Linnea Maelle Makoa Marisol Matthias Nadezhda Nkechi Odalys Orrin Paloma Ptolemy Rasmus Rukhsana Saskia Seun Signe Taavi Tamsin Teodor Ulla Vashti Wairimu Xochitl Yannick Zephyrine').split(' ');
const FIRST_WORD = 'Destiny Angel Major Royal Honor Justice Precious Echo Ember Haven'.split(' ');
const LAST = ('Agbaje Albescu Arbuthnot Bakshi Brannigan Castaneda Ciobanu Deverell Eriksen Faulkes Gatwiri Haldane Hirvonen Ikemefuna Jankowska Kealoha Lindgren Maalouf Mbatha Nyberg Okoro Pellegrini Quaresma Rautio Sahin Tarkowski Umarov Vasquez Whitcombe Yildirim Zaragoza Aldridge Featherstone Pemberton Ruiz-Ortega').split(' ');
const LAST_WORD = 'Carpenter Gardner Shepherd Steel Hale Marsh Frost Wells'.split(' ');
const OTHER = ['林佳怡', '이서준', 'ليلى منصور', 'Ольга Смирнова', 'สุดา แก้วใส', 'Phạm Minh Châu', 'יונתן ברק', 'कविता राव'];
const NICK = { Aneurin: 'Nye', Dashiell: 'Dash', Eskander: 'Iskie', Gwyneth: 'Gwyn', Imogen: 'Immy', Jessamy: 'Jess', Leocadia: 'Leo', Matthias: 'Matt', Nadezhda: 'Nadya', Ptolemy: 'Tolly', Rukhsana: 'Rukhi', Teodor: 'Teo', Xochitl: 'Xochi', Zephyrine: 'Zeph', Cosima: 'Cosi', Marisol: 'Mari', Hollis: 'Holl', Destiny: 'Des' };
const REL = ['mum', 'father', 'older brother', 'little sister', 'cousin', 'aunt', 'great-uncle', 'grandmother', 'grandpa', 'best mate', 'next-door neighbour', 'stepbrother', 'godfather', 'tutor'];
const TITLE = ['Mr', 'Ms', 'Mrs', 'Mr.', 'Ms.', 'Dr', 'Miss'];
const SCHOOLS = [['Larkspur International School', 'Larkspur'], ['Kingfisher Bay High School', 'Kingfisher Bay'], ['Coldwater Academy', 'Coldwater'], ['St. Brannoc College', 'St. Brannoc'], ['Meridian Park Secondary', 'Meridian Park'], ['Halden Vale School', 'Halden Vale']];
const TOWNS = ['Fenwick', 'Rosebrook', 'Tarrow', 'Ellingham Cross', 'Brackenridge', 'Pollard Bay', 'Wexcombe', 'Thornaby Mill', 'Sallow', 'Quenby', 'Marlow Heath', 'Dunholt'];
const STREETS = ['Bramley', 'Larch', 'Kestrel', 'Tinker', 'Cobble', 'Wren'];
const STREET_KIND = ['Lane', 'Road', 'Close', 'Avenue', 'St', 'Drive'];
const BOOKS = [
  { book: 'Jane Eyre', people: ['Jane', 'Rochester', 'Mr Rochester', 'Bertha', 'St John Rivers', 'Charlotte Brontë', 'Helen Burns'], places: ['Thornfield', 'Lowood'], task: 'Essay: How does Charlotte Brontë present independence in Jane Eyre? Refer to Jane and Mr Rochester.' },
  { book: 'The Hate U Give', people: ['Starr', 'Khalil', 'Angie Thomas', 'Maverick', 'Chris', 'Kenya'], places: ['Garden Heights', 'Williamson'], task: 'Analytical essay on voice in The Hate U Give by Angie Thomas. How does Starr find hers?' },
  { book: 'Brave New World', people: ['Bernard', 'Lenina', 'John', 'Huxley', 'Mustapha Mond', 'Helmholtz'], places: ['London', 'the Reservation'], task: 'Brave New World (Aldous Huxley): is stability worth the price? Use Bernard or John as evidence.' },
  { book: "A Doll's House", people: ['Nora', 'Torvald', 'Helmer', 'Ibsen', 'Krogstad', 'Kristine'], places: ['Norway'], task: "A Doll's House: write about Nora's final decision and Ibsen's view of marriage." },
  { book: 'Beloved', people: ['Sethe', 'Denver', 'Paul D', 'Toni Morrison', 'Baby Suggs'], places: ['Ohio', '124'], task: 'Beloved by Toni Morrison: explore memory through Sethe and Denver.' },
  { book: 'Death of a Salesman', people: ['Willy', 'Willy Loman', 'Biff', 'Happy', 'Linda', 'Arthur Miller'], places: ['Brooklyn', 'Boston'], task: 'Death of a Salesman essay: how does Arthur Miller show the American Dream through Willy and Biff?' },
];
const MONTH = 'January February March April May June July August September October November December'.split(' ');

const HEADERS = ['{self}\n{book}\n', 'Name - {self}\nTeacher - {teacher}\n', '{selfL}, {selfF} ({school})\n', '{selfF}   {month} {d}\n', 'Essay by {self}\n', '', ''];
const BODY = [
  // the book, as a student writes about it
  'In the opening chapter, {pub} is shown as an outsider.',
  '{pub} is a foil for {pub2}, and the contrast drives the plot.',
  'The author gives {pub} the last word, which feels deliberate.',
  'Critics often read {pub} as a symbol of the time.',
  'By the end, {pub} has lost almost everything.',
  'I disagree with the reading that {pub} is simply a victim.',
  "{pub}'s speech in the final act is the turning point.",
  'The setting of {pplace} adds to the tension.',
  'Nobody in {book} is completely honest.',
  'The narrator never fully explains why {pub} leaves.',
  'Written in {oldyear}, the text still feels modern.',
  'This idea goes back to the protagonist, {pub}, and her choices.',
  // the student's own life
  'My {rel} {relName} says {pub} reminds her of herself.',
  'When I read this, I thought of {relName}, who left home at seventeen.',
  '{mateF} lent me her copy because I lost mine on the bus to {town}.',
  '{teacher} suggested I look at the second half again.',
  'As {teacherBare} told us, the first sentence should do the most work.',
  'I live on {addr} in {town}, and the library there was closed all week.',
  'You can reach me on {phone} or {email}.',
  'My student number is {sid}.',
  'I was born on {dob} at the hospital in {town}.',
  '{nick} is what everyone at {schoolS} calls me.',
  'My mate {relName} {lastR} and I revised together at {schoolS}.',
  'Our debate team, the {schoolS} Owls, practised this argument.',
  '{relName} and {relName2} came to watch the performance.',
  'Ask {mate} for the notes from Tuesday.',
  'Special thanks to {teacher} and to my {rel}.',
  '{other} is my name in my first language.',
  // the class's shared words
  'The theme of identity runs through the whole text.',
  'Context matters here, especially the attitudes of the period.',
  'Foreshadowing appears early and often.',
  'Overall, the ending is ambiguous.',
  'Motifs of light and dark recur throughout.',
  'Ultimately, the reader is left to decide.',
  'Thursday was the deadline, but I asked for an extension.',
  'Grace and mercy are rare in this world.',
  'Happy endings are not what this writer believes in.',
  'Thank you for reading,\n{selfF}',
  'Kind regards,\n{selfF} {selfL}',
];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 41) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], papers = [];
  const digits = k => Array.from({ length: k }, () => Math.floor(r() * 10)).join('');
  let cls = null;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 0) {
      const seen = new Set(), roster = [];
      while (roster.length < 20) { const first = r() < .1 ? pick(FIRST_WORD) : pick(FIRST), last = r() < .12 ? pick(LAST_WORD) : pick(LAST); if (seen.has(first)) continue; seen.add(first); roster.push({ first, last }); }
      const b = BOOKS[(i / 20) % BOOKS.length], sc = pick(SCHOOLS);
      cls = { roster, names: roster.map(s => s.first + ' ' + s.last), ...b, teacher: r() < .25 ? pick(LAST_WORD) : pick(LAST), title: pick(TITLE), school: sc[0], schoolS: sc[1], towns: [pick(TOWNS), pick(TOWNS)] };
    }
    const self = cls.roster[i % 20], mates = cls.roster.filter(s => s !== self);
    let text = '', spans = [];
    const fill = tpl => {
      const mate = pick(mates), pp = () => pick(cls.people);
      const v = {
        self: [self.first + ' ' + self.last, 'PERSON', 'self'], selfF: [self.first, 'PERSON', 'self'], selfL: [self.last, 'PERSON', 'self'],
        nick: [NICK[self.first] || self.first, 'PERSON', 'nick'], mate: [mate.first + ' ' + mate.last, 'PERSON', 'mate'], mateF: [mate.first, 'PERSON', 'mate'],
        relName: [r() < .15 ? pick(FIRST_WORD) : pick(FIRST), 'PERSON', 'other'], relName2: [pick(FIRST), 'PERSON', 'other'], lastR: [pick(LAST), 'PERSON', 'other'], rel: [pick(REL)],
        teacherBare: [cls.teacher, 'PERSON', 'teacher'], school: [cls.school, 'SCHOOL'], schoolS: [cls.schoolS, 'SCHOOL'], town: [pick(cls.towns), 'PLACE'],
        addr: [String(1 + Math.floor(r() * 140)) + ' ' + pick(STREETS) + ' ' + pick(STREET_KIND), 'PLACE'],
        phone: [pick([() => '07' + digits(3) + ' ' + digits(3) + ' ' + digits(3), () => '+44 ' + digits(4) + ' ' + digits(6), () => '(' + digits(3) + ') ' + digits(3) + ' ' + digits(4)])(), 'CONTACT'],
        email: [self.first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.' + self.last.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '@' + pick(['gmail.com', 'hotmail.co.uk', 'larkspur.sch.uk']), 'CONTACT'],
        sid: [pick([() => digits(7), () => 'LK' + digits(5), () => digits(6)])(), 'ID'],
        dob: [pick([() => (1 + Math.floor(r() * 28)) + ' ' + pick(MONTH) + ' ' + (2008 + Math.floor(r() * 4)), () => pick(MONTH) + ' ' + (1 + Math.floor(r() * 28)) + ', ' + (2008 + Math.floor(r() * 4))])(), 'DATE'],
        other: [pick(OTHER), 'PERSON', 'other'],
        pub: [pp(), 'PUBLIC'], pub2: [pp(), 'PUBLIC'], book: [cls.book, 'PUBLIC'], pplace: [pick(cls.places), 'PUBLIC'], oldyear: [String(1840 + Math.floor(r() * 120))],
        month: [pick(MONTH)], d: [String(1 + Math.floor(r() * 28))],
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
    const k = 5 + Math.floor(r() * 9), used = new Set();
    for (let j = 0; j < k; j++) { let t; do t = pick(BODY); while (used.has(t)); used.add(t); text += fill(t) + (r() < .2 ? '\n' : ' '); }
    const trimmed = text.trim();
    papers.push({ id: 'blind2-' + i, genre: 'blind2', student: self.first + ' ' + self.last, roster: cls.names, task: cls.task, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
