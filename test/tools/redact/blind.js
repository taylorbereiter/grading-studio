// The blind set: names, places, books and sentences written before version 2 of the network and never used to change it.
// Nothing here is shared with pools.js or the practice sentences, so its score shows how the network does on writing it has never seen.
// Every student, relative, teacher, school, street and number is invented; given and family names are mixed at random.
'use strict';

const pools = {
  FIRST: ('Adaeze Akosua Anouk Aurelio Bastian Benedikt Catalina Chiamaka Cyrus Dalia Dario Delphine Eitan Emilia Esra Ewan Fionn Gael Gulnara Hadiza Hamid Ilse Inaya Itzel Jamal Jarrah Joon Kaito Kalani Keanu Kiri Lavinia Leilani Lior Lorenzo Madina Mattias Meera Nayeli Niamh Nikhil Oisin Ola Paavo Petra Quentin Rafael Rashida Riya Ronan Sabine Samir Selin Tavita Teodora Tevita Uriel Vanya Wiremu Ximena Yaw Yerlan Yusra Zaid Zuri ' +
    'Zarvin Belisandra Korriel Tamsk Ondrell Wysteria').split(' '),   // the last six are invented, so no name list can know them
  FIRST_WORD: 'Robin Penny Grant Chase Wade Lily Pearl Sunny Clay Ray Glen Brook'.split(' '),
  LAST: ('Abernathy Achterberg Adjei Bergström Bianchi Boateng Castellanos Cavanagh Dlamini Esposito Fitzgerald Gashi Halvorsen Hakimi Ilunga Jaramillo Kaminski Kariuki Lachance Laine Mwangi Nakashima Ndlovu Oduya Ortega Papadopoulos Quispe Rinaldi Sabharwal Sorensen Tamaki Tshabalala Udeh Varga Wójcik Xiong Yamada Zielinski Zapata ' +
    'Vellacourt Drummik Osterhane Quarrel-Bayne').split(' '),
  LAST_WORD: 'Bishop Baker Cook Fisher Mason Rivers Snow Swan Bell Banks'.split(' '),
  OTHER: ['陈思远', '최민준', 'عمر خليل', 'Дмитрий Орлов', 'ปิยะ วงศ์ไทย', 'Lê Hoàng Nam', 'נועה לוי', 'अर्जुन मेहता', '高橋 蓮'],
  NICK: { Benedikt: 'Bene', Catalina: 'Cata', Chiamaka: 'Ama', Delphine: 'Del', Emilia: 'Emmy', Gulnara: 'Gula', Lavinia: 'Vinnie', Leilani: 'Lani', Lorenzo: 'Enzo', Mattias: 'Matti', Nikhil: 'Nik', Quentin: 'Q', Rafael: 'Rafa', Sabine: 'Bea', Teodora: 'Teddy', Wiremu: 'Wi', Ximena: 'Xime', Yusra: 'Yuyu', Belisandra: 'Bel', Adaeze: 'Ada', Bastian: 'Basti', Jamal: 'Jam', Penny: 'Pen', Robin: 'Rob' },
  RELATIVE: ['mother', 'dad', 'big brother', 'twin sister', 'cousin', 'auntie', 'uncle', 'nan', 'grandad', 'godmother', 'stepsister', 'best friend', 'neighbour', 'host mum'],
  TEACHER_TITLE: ['Mr', 'Ms', 'Mrs', 'Dr.', 'Professor', 'Coach', 'Mr.'],
  SCHOOL: ['Whitlow International School', 'Brightwater High', 'Ashcombe College', 'Fernhill Secondary School', 'Lumen Bay School', 'Saint Odile Academy'],
  SCHOOL_SHORT: ['Whitlow', 'Brightwater', 'Ashcombe', 'Fernhill', 'Lumen Bay'],
  TOWN: ['Wrenford', 'Oakhurst Ridge', 'Saltmarsh', 'Calder Falls', 'Penwyn', 'Ivory Bay', 'Starling Cross', 'Hob End'],
  STREET: ['Mulberry', 'Sycamore', 'Foxglove', 'Heron', 'Quarry', 'Linden'],
  STREET_KIND: ['Crescent', 'Way', 'Terrace', 'Ave', 'Road', 'Gardens'],
  TEAM: ['Brightwater Bears', 'Kites', 'Wrenford Wolves'],
  HOUSE: ['Talon House', 'Ember House', 'Tide House'],
  // each class reads one book; papers from that class mention its people
  BOOKS: [
    { book: 'The Outsiders', people: ['Ponyboy', 'Johnny', 'Dally', 'Sodapop', 'S.E. Hinton', 'Darry'], places: ['Tulsa'] },
    { book: 'Hamlet', people: ['Hamlet', 'Ophelia', 'Claudius', 'Horatio', 'Gertrude', 'Shakespeare'], places: ['Elsinore', 'Denmark'] },
    { book: 'Frankenstein', people: ['Victor', 'Victor Frankenstein', 'Elizabeth', 'Mary Shelley', 'Clerval'], places: ['Ingolstadt', 'Geneva'] },
    { book: 'The Kite Runner', people: ['Amir', 'Hassan', 'Baba', 'Khaled Hosseini', 'Rahim Khan'], places: ['Kabul', 'Afghanistan'] },
    { book: 'Purple Hibiscus', people: ['Kambili', 'Jaja', 'Papa', 'Aunty Ifeoma', 'Chimamanda Ngozi Adichie'], places: ['Enugu', 'Nigeria'] },
    { book: 'Persepolis', people: ['Marjane', 'Marjane Satrapi', 'Uncle Anoosh'], places: ['Tehran', 'Vienna'] },
  ],
};

const headers = [
  '{selfF} {selfL} - {book} essay\n',
  '{self}\nCandidate {cand}\n',
  '{selfCaps}\n',
  'Submitted by: {self}\n',
  '{selfF}\n{month} {d}\n',
  'Group: {self}, {mate}, {mate2}\n',
  '',
  '',
];

const body = [
  '{pub} is the most complex character in {book}.',
  'When {pub} lies to everyone, the reader stops trusting the narrator.',
  '{pub} and {pub2} react in opposite ways to the same event.',
  'My partner {mateF} pointed out a symbol I had missed.',
  '{mateF} thinks the ending is unfair, and I agree.',
  'In my opinion, the strongest scene is in chapter {n}.',
  'Like {pub}, my cousin {relName} moved countries when she was young.',
  'This connects to my own life because my {rel} grew up in {pplace}.',
  'I am really grateful to {teacher} for staying after school with me.',
  '{relName} quizzed me every night before the test.',
  'During the trip to {pplace} I shared a room with {mate}.',
  'Next term I will sit next to {mateF} so we can revise together.',
  '{nick} is my nickname at home, but at school everyone uses my full name.',
  'My little sister {relName} drew the cover page.',
  "I spent the weekend at my grandparents' house in {town}.",
  'Text me on {phone} if the group needs me.',
  'I added my email ({email}) to the shared document.',
  'Follow our project page at {handle}.',
  'My candidate number is {cand}.',
  'Student ID #{sid}',
  'My birthday is {dob2}, so I am the youngest in my class.',
  'I turned fifteen on {dob2}.',
  'DOB: {dob2}',
  'We live at {addr}, {town} {postcode}.',
  'Every Sunday {relName} {lastR} from next door brings us bread.',
  '{relName} taught me how to ride a bike behind {schoolS}.',
  'The day {relName} was born, my whole family cried.',
  'At {school} I am in {house}.',
  'I play for the {team} on Saturdays.',
  'Hello {teacher},',
  'Good morning {teacher}, here is my revised draft.',
  'Could you send the rubric to my mum at {email}?',
  'Warm regards,\n{selfF}',
  'Best,\n{selfF} {selfL}',
  '- {nick}',
  '{mateF} and {mate2F} measured the temperature every minute.',
  'Our group ({mateF}, {mate2F} and I) used the second method.',
  '{teacher} checked our setup before we started.',
  'Mitochondria produce most of the energy a cell needs.',
  'Overall, the results were surprising.',
  'However, the data had a lot of noise.',
  'Globalization has changed how people work.',
  "Shakespeare's use of imagery is especially strong in this act.",
  'Napoleon lost at Waterloo in 1815.',
  'Transcribed interviews are in the appendix.',
  'Ironically, the hero is the one who fails.',
  'Sunday is the only day I can rest.',
  'Will power alone is not enough.',
  'Grace under pressure is the real theme.',
  'April showers bring May flowers, as my teacher says.',
];

module.exports = { pools, headers, body };
