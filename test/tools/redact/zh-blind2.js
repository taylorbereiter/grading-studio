// The second Chinese blind set, written 11/4 after every change prompted by the first and before anything was scored on it.
// New writing: a speech, a diary, an interview write-up, a thank-you letter, a book report on texts the famous list may not have,
// a composition about a neighbour, and short notes. New family names, given names, nicknames, relatives and everyday words.
// Every student, relative, teacher, school, street and number is invented.
'use strict';

const SUR = [...'王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方邹孟熊秦邱江尹薛段雷侯史陶黎贺顾毛郝龚邵钱严覃武戴莫孔向汤温康施牛葛邢乔伍庞颜倪庄聂章岳翟殷詹申耿焦俞柳甘祝包舒阮柯纪梅童凌毕裴霍涂苗谷盛翁冉骆蓝辛靳管柴鲍喻祁蒲房滕饶牟艾尤穆卓缪褚娄窦戚岑'].concat(['欧阳', '司徒', '慕容']);
const GIVEN = [...'安琪嘉禾若曦知远清扬书瑶宸宇芷若一鸣雨晴浩博婧涵子豪梦琪晓东丽华国庆艳红振华秋菊冬梅春生永强海燕佩玲'];
const NICK = ['点点', '球球', '小胖子', '阿乐', '大壮', '小辣椒', '眼镜', '小不点', '阿花', '虎子'];
const REL = ['老妈', '老爸', '爸爸', '妈妈', '奶奶', '外婆', '爷爷', '大姨', '二叔', '小舅', '表姐', '堂弟', '干妈', '邻居阿姨'];
const TOWN = ['梨花镇', '云台县', '北坡村', '青龙镇'];
const ROAD = ['朝阳', '胜利', '团结', '新民', '工农'];
const ESTATE = ['金桂', '御景', '万象', '书香'];
const BOOKS = [
  { book: '《呐喊》', people: ['鲁迅', '阿Q', '孔乙己', '狂人'], task: '读《呐喊》，选一篇小说写读后感。' },
  { book: '《傅雷家书》', people: ['傅雷', '傅聪'], task: '读《傅雷家书》，给父母写一封信。' },
  { book: '《城南旧事》', people: ['林海音', '英子', '宋妈', '秀贞'], task: '读《城南旧事》，说说英子眼中的大人。' },
  { book: '《草房子》', people: ['曹文轩', '桑桑', '秃鹤', '纸月'], task: '《草房子》读书报告：写一个让你感动的孩子。' },
  { book: '《边城》', people: ['沈从文', '翠翠', '傩送', '天保'], task: '读《边城》，谈谈翠翠的等待。' },
];
const HEADERS = ['{self} 九年级（{n}）班\n', '演讲稿  {self}\n', '{self}的日记\n', '感谢信\n', '采访记录  记录人：{self}\n', '{n}班 {self}\n', '', '', ''];
const BODY = [
  // book reports
  '我读完了{book}，心里久久不能平静。', '书里的{pub}让我想起了自己的童年。', '{pub}虽然很普通，却很善良。', '我很同情{pub}的遭遇。', '读到{pub}离开的时候，我哭了。', '作者笔下的{pub}活灵活现。',
  // people the student knows
  '各位老师、同学们：大家好！我是{self}。', '今天我采访了{relWho}{relName}。', '{relName}告诉我，她小时候家里很穷。', '我要感谢{teacherFull}一直以来的帮助。', '{teacher}常常留下来给我们补课。',
  '隔壁的{relName}爷爷每天都在楼下下棋。', '{mateFull}是我们班的班长，大家都很服她。', '我和{mateFull}从幼儿园就认识了。', '下课的时候，{mateFull}递给我一颗糖。', '{nick}是我的外号，因为我小时候很胖。',
  '同学们都喜欢叫我{nick}。', '我家的地址是{addr}。', '我的手机号码：{phone}', '我的学号是{sid}。', '我的生日是{dob}，那天正好下雪。', '暑假我去{town}看望了爷爷奶奶。', '此致\n敬礼！\n学生：{self}', '{selfGiven}\n{date}',
  // everyday words that start with a family name's character
  '雷声越来越大，雨马上就要下了。', '这次考试我考得不太好，有点难过。', '大家围成一圈，有说有笑。', '何必为了一点小事生气呢？', '金黄的稻田一眼望不到边。', '许愿的时候，我闭上了眼睛。', '于是，我们一起出发了。', '江边的风很大。',
  '周日的早上，街上很安静。', '石桥下面的河水很清。', '安静的教室里只听得见笔声。', '时间一分一秒地过去了。', '高高的白杨树站在路边。', '黄狗趴在门口睡觉。',
];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 97) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], papers = [];
  const digits = k => Array.from({ length: k }, () => Math.floor(r() * 10)).join('');
  const given = () => r() < .75 ? pick(GIVEN) + pick(GIVEN) : pick(GIVEN);
  let cls = null;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 0) {
      const seen = new Set(), roster = [];
      while (roster.length < 20) { const sur = pick(SUR), g = given(); if (seen.has(sur + g)) continue; seen.add(sur + g); roster.push({ sur, given: g }); }
      const b = BOOKS[(i / 20) % BOOKS.length], tsur = pick(SUR);
      cls = { roster, names: roster.map(s => s.sur + s.given), ...b, tsur, tfull: tsur + given(), n: 1 + Math.floor(r() * 9) };
    }
    const self = cls.roster[i % 20], mates = cls.roster.filter(s => s !== self);
    let text = '', spans = [];
    const fill = tpl => {
      const mate = pick(mates), pp = () => pick(cls.people);
      const v = {
        self: [self.sur + self.given, 'PERSON', 'self'], selfGiven: [self.given, 'PERSON', 'self'], mateFull: [mate.sur + mate.given, 'PERSON', 'mate'],
        relName: [pick(SUR) + given(), 'PERSON', 'other'], relWho: [pick(['我的', '我', '']) + pick(REL)], date: [(1 + Math.floor(r() * 12)) + '月' + (1 + Math.floor(r() * 28)) + '日'],
        nick: [pick(NICK), 'PERSON', 'nick'], teacherFull: [cls.tfull, 'PERSON', 'teacher'], town: [pick(TOWN), 'PLACE'],
        addr: [pick([() => pick(ROAD) + '路' + (1 + Math.floor(r() * 300)) + '号', () => pick(ESTATE) + '花园' + (1 + Math.floor(r() * 30)) + '号楼' + (1 + Math.floor(r() * 4)) + '单元' + (1 + Math.floor(r() * 18)) + '0' + (1 + Math.floor(r() * 4)) + '室', () => pick(ROAD) + '大街' + (1 + Math.floor(r() * 99)) + '号' + (1 + Math.floor(r() * 9)) + '单元'])(), 'PLACE'],
        phone: [pick([() => '1' + pick(['3', '5', '8']) + digits(9), () => '1' + pick(['3', '5', '8']) + digits(1) + '-' + digits(4) + '-' + digits(4), () => '1' + pick(['3', '5', '8']) + digits(1) + ' ' + digits(4) + ' ' + digits(4)])(), 'CONTACT'], sid: [pick([() => digits(10), () => 'G' + digits(8)])(), 'ID'],
        dob: [(2008 + Math.floor(r() * 4)) + '年' + (1 + Math.floor(r() * 12)) + '月' + (1 + Math.floor(r() * 28)) + '日', 'DATE'],
        pub: [pp(), 'PUBLIC'], book: [cls.book, 'PUBLIC'], n: [String(cls.n)],
      };
      let out = '';
      tpl.replace(/\{(\w+)\}|([^{]+)/g, (m, slot, lit) => {
        if (lit) { out += lit; return ''; }
        if (slot === 'teacher') { spans.push({ start: text.length + out.length, end: text.length + out.length + cls.tsur.length, type: 'PERSON', who: 'teacher', value: cls.tsur }); out += cls.tsur + pick(['老师', '老师', '校长', '教练']); return ''; }
        const [val, type, who] = v[slot];
        if (type) spans.push({ start: text.length + out.length, end: text.length + out.length + val.length, type, who, value: val });
        out += val; return '';
      });
      return out;
    };
    text += fill(pick(HEADERS));
    const k = 6 + Math.floor(r() * 8), used = new Set();
    for (let j = 0; j < k; j++) { let t; do t = pick(BODY); while (used.has(t)); used.add(t); text += fill(t) + (r() < .35 ? '\n' : ''); }
    const trimmed = text.trim();
    papers.push({ id: 'zhblind2-' + i, genre: 'zhblind2', student: self.sur + self.given, roster: cls.names, task: cls.task, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
