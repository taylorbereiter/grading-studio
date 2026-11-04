// The Chinese blind set, written 11/4 after the Chinese pass in src/redact.js was finished and before it was ever run on these
// papers. Its writing differs from the practice papers (zh-papers.js): narrative compositions with people met along the way,
// diary entries, speeches, letters home and book reports on texts the famous list may not have. Different family names, given
// names, nicknames and everyday words. Every student, relative, teacher, school, street and number is invented.
'use strict';

const SUR = [...'王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤温康施文牛樊葛邢安齐易乔伍庞颜倪庄聂章鲁岳翟殷'].concat(['欧阳', '上官']);
const GIVEN = [...'梓萱诗涵子墨奕辰语桐思彤皓轩沐阳紫萱昊天铭泽雅琪睿哲晓峰丹妮婉清志强建国秀英桂兰淑芬俊豪家乐心怡宏伟玉梅春燕'];
const NICK = ['毛毛', '亮亮', '团团', '小米', '阿宝', '胖虎', '小七', '妞妞', '阿飞', '小豆子'];
const REL = ['老妈', '老爸', '妈妈', '爸爸', '奶奶', '姥姥', '外公', '小姨', '叔叔', '舅妈', '堂哥', '表妹', '大伯'];
const TOWN = ['柳河镇', '清水湾', '石门县', '杏花村'];
const ROAD = ['长江', '黄河', '新华', '文化', '友谊'];
const ESTATE = ['春晖', '紫荆', '东湖', '丽景'];
const BOOKS = [
  { book: '《朝花夕拾》', people: ['鲁迅', '阿长', '藤野先生'], task: '读《朝花夕拾》，写一写阿长或藤野先生。' },
  { book: '《水浒传》', people: ['武松', '宋江', '林冲', '鲁智深'], task: '《水浒传》人物评析，选一位好汉。' },
  { book: '《平凡的世界》', people: ['孙少平', '孙少安', '田晓霞', '路遥'], task: '读《平凡的世界》，谈谈孙少平的奋斗。' },
  { book: '《活着》', people: ['福贵', '余华', '家珍', '有庆'], task: '读《活着》，说说福贵的一生。' },
  { book: '《三体》', people: ['刘慈欣', '叶文洁', '罗辑', '汪淼'], task: '《三体》读后感：你怎么看叶文洁的选择？' },
];
const HEADERS = ['班级：九年级{n}班  姓名：{self}\n', '{self}\n', '题目：难忘的一天\n作者：{self}\n', '{relTitle}：\n见字如面。\n', '敬爱的{teacher}：\n', '{self}（学号{sid}）\n', '', '', ''];
const BODY = [
  // book reports
  '在{book}里，{pub}给我留下了很深的印象。', '我觉得{pub}其实很孤独。', '{pub}的命运让我想了很久。', '书中写{pub}的那一段，我读了好几遍。', '如果我是{pub}，我也许不会那样做。',
  // a composition about people the student knows
  '那天早上，{mateFull}在校门口等我。', '{mateFull}笑着说：“你终于来了！”', '我和{mateFull}约好周六一起去爬山。', '体育课上，{mateFull}摔倒了，我赶紧扶她起来。', '{relWho}{relName}每天早上五点就起床做饭。',
  '{relWho}{relName}在医院工作，很少回家。', '我们班的{teacher}特别幽默。', '{teacher}把我叫到办公室，跟我谈了很久。', '数学课代表{mateFull}总是第一个交作业。', '昨天{nick}又把我的橡皮借走了。',
  '我的外号叫{nick}，是小学同学给我起的。', '朋友们都叫我{nick}。', '我家在{addr}，楼下有一家早餐店。', '有事可以打我妈妈的电话{phone}。', '我的微信号是{wechat}。', '我是{dob}出生的。', '去年暑假我们回了{town}的老家。',
  '{teacherFull}是我最尊敬的老师。', '此致\n敬礼！\n{self}', '你的孙女{selfGiven}', '——{selfGiven}',
  // everyday words that start with a family name's character, and characters that look like names
  '那天的天气非常好，阳光明媚。', '高考对每个人都很重要。', '我常常想起小时候的事情。', '马路上的车越来越多。', '这件事情让我明白了很多道理。', '江水静静地流淌。', '周围的人都在看我们。', '白云在天上慢慢飘。',
  '于是我下定决心要好好学习。', '金色的秋天来了。', '许久没有见到外婆了。', '方老板的店今天没开门。', '万事开头难。', '全班同学都笑了。', '何况这只是一次小测验。', '时光一去不复返。',
];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 83) {
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
        relName: [pick(SUR) + given(), 'PERSON', 'other'], relWho: [pick(['我的', '我', '']) + pick(REL)], relTitle: [pick(['亲爱的', '']) + pick(['爸爸妈妈', '奶奶', '姥姥'])],
        nick: [pick(NICK), 'PERSON', 'nick'], teacherFull: [cls.tfull, 'PERSON', 'teacher'], town: [pick(TOWN), 'PLACE'],
        addr: [pick([() => pick(ROAD) + '路' + (1 + Math.floor(r() * 300)) + '号', () => pick(ESTATE) + '花园' + (1 + Math.floor(r() * 30)) + '号楼' + (1 + Math.floor(r() * 4)) + '单元' + (1 + Math.floor(r() * 18)) + '0' + (1 + Math.floor(r() * 4)) + '室', () => pick(ROAD) + '街' + (1 + Math.floor(r() * 99)) + '号'])(), 'PLACE'],
        phone: ['1' + pick(['3', '5', '7', '8', '9']) + digits(9), 'CONTACT'], wechat: [pick(['wx_', 'zz', '']) + 'a' + digits(7), 'CONTACT'], sid: [digits(9), 'ID'],
        dob: [(2008 + Math.floor(r() * 4)) + '年' + (1 + Math.floor(r() * 12)) + '月' + (1 + Math.floor(r() * 28)) + '日', 'DATE'],
        pub: [pp(), 'PUBLIC'], book: [cls.book, 'PUBLIC'], n: [String(cls.n)],
      };
      let out = '';
      tpl.replace(/\{(\w+)\}|([^{]+)/g, (m, slot, lit) => {
        if (lit) { out += lit; return ''; }
        if (slot === 'teacher') { spans.push({ start: text.length + out.length, end: text.length + out.length + cls.tsur.length, type: 'PERSON', who: 'teacher', value: cls.tsur }); out += cls.tsur + '老师'; return ''; }
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
    papers.push({ id: 'zhblind-' + i, genre: 'zhblind', student: self.sur + self.given, roster: cls.names, task: cls.task, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
