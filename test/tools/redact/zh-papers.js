// Made-up papers written in Chinese, for practice on the Chinese pass in src/redact.js: compositions, book reports, weekly journals
// and letters, as a Chinese class hands them in. Every student, relative, teacher, school, street and number is invented.
'use strict';

const SUR = [...'王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁沈姚卢姜崔钟谭陆汪范金石廖贾夏韦方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵钱严武戴莫孔向汤'].concat(['欧阳', '司马', '诸葛']);
const GIVEN = [...'明华伟强军杰涛超勇平刚飞龙长青美丽娜静敏芳英玉兰红花月雪海波洋宇航鑫浩然思远雨萱子轩欣怡梓涵一诺博文俊熙佳琪晨阳若曦天佑可馨嘉怡宇轩'];
const NICK = ['豆豆', '乐乐', '果果', '小胖', '小雨', '阿杰', '小宝', '大头', '小鱼', '甜甜', '阿明', '小可'];
const REL = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '表哥', '表姐', '舅舅', '姑姑', '哥哥', '姐姐', '弟弟', '妹妹'];
const TITLE = ['老师', '老师', '老师', '班主任'];
const TOWN = ['青石镇', '桃源县', '白沙村', '临江镇', '东山村'];
const ROAD = ['人民', '解放', '建设', '中山', '和平', '幸福', '光明'];
const ESTATE = ['阳光', '金色', '翠湖', '锦绣', '碧水'];
const SCHOOL = ['实验中学', '育才中学', '第三中学', '外国语学校'];
const BOOKS = [
  { book: '《故乡》', people: ['鲁迅', '闰土', '杨二嫂'], task: '读《故乡》，写一篇读后感，谈谈你对闰土的看法。' },
  { book: '《西游记》', people: ['孙悟空', '唐僧', '猪八戒', '沙僧'], task: '《西游记》读书笔记：你最喜欢哪个人物？' },
  { book: '《骆驼祥子》', people: ['祥子', '老舍', '虎妞'], task: '读《骆驼祥子》，说说祥子的命运。' },
  { book: '《背影》', people: ['朱自清', '父亲'], task: '学习《背影》，写一写你的父亲或母亲。' },
  { book: '《红楼梦》', people: ['林黛玉', '贾宝玉', '曹雪芹', '王熙凤'], task: '《红楼梦》人物分析：林黛玉还是薛宝钗？' },
];
const HEADERS = ['姓名：{self}  班级：初二（{n}）班\n', '{self}\n{book}读后感\n', '作者：{self}\n', '亲爱的{teacherFull}：\n', '{teacher}：\n您好！\n', '{self}  学号：{sid}\n', '', ''];
const BODY = [
  // the book
  '读了{book}，我对{pub}有了新的认识。', '{pub}是一个让人难忘的人物。', '作者通过{pub}写出了那个时代的悲哀。', '我最喜欢的人物是{pub}，因为他很勇敢。', '{pub}和{pub2}的性格完全不同。', '这篇文章的语言非常朴素，却很感人。',
  // the student's own life
  '我的同桌{mate}说这本书很无聊，可是我不同意。', '{mateG}告诉我，她也读过这本书。', '我的{rel}{relName}是一名医生，她每天都很忙。', '我和{mateG}一起在图书馆看书。', '{teacher}告诉我们，读书要多思考。',
  '我{rel}{relName}说我长大了。', '放学后，{relName}带我去吃了一碗面。', '我住在{addr}，离学校很近。', '我的电话是{phone}，有问题可以联系我。', '我的生日是{dob}。', '大家都叫我{nick}。', '我的小名叫{nick}。',
  '{nick}说今天要早点回家。', '上周末我回了{town}看外婆。', '我在{school}上初二。', '我的QQ号是{qq}。', '——{self}', '{teacherFull}批改作业非常认真。', '{mate}和我是最好的朋友。',
  // everyday words that start with a family name's character
  '我今天特别高兴。', '马上就要考试了，我有点紧张。', '周末我去了公园。', '这个方法很好用。', '白天和黑夜一样长。', '许多同学都喜欢这本书。', '万一下雨了怎么办？', '我曾经也这样想过。', '任何困难都打不倒我。', '黄昏的时候，天边一片金色。', '明天是星期五。', '江南的春天很美。', '安全第一，大家要注意。', '时间过得真快。',
];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 71, pools = {}) {
  const P = { SUR, GIVEN, NICK, REL, TITLE, TOWN, ROAD, ESTATE, SCHOOL, BOOKS, HEADERS, BODY, ...pools };
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], papers = [];
  const digits = k => Array.from({ length: k }, () => Math.floor(r() * 10)).join('');
  const person = () => pick(P.SUR) + (r() < .7 ? pick(P.GIVEN) + pick(P.GIVEN) : pick(P.GIVEN));
  let cls = null;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 0) {
      const seen = new Set(), roster = [];
      while (roster.length < 20) { const sur = pick(P.SUR), given = r() < .7 ? pick(P.GIVEN) + pick(P.GIVEN) : pick(P.GIVEN); if (seen.has(sur + given)) continue; seen.add(sur + given); roster.push({ sur, given }); }
      const b = P.BOOKS[(i / 20) % P.BOOKS.length], tsur = pick(P.SUR);
      cls = { roster, names: roster.map(s => s.sur + s.given), ...b, tsur, tfull: tsur + pick(P.GIVEN) + (r() < .5 ? pick(P.GIVEN) : ''), title: pick(P.TITLE), school: pick(P.SCHOOL), n: 1 + Math.floor(r() * 9) };
    }
    const self = cls.roster[i % 20], mates = cls.roster.filter(s => s !== self);
    let text = '', spans = [];
    const fill = tpl => {
      const mate = pick(mates), pp = () => pick(cls.people);
      const v = {
        self: [self.sur + self.given, 'PERSON', 'self'], mate: [mate.sur + mate.given, 'PERSON', 'mate'], mateG: [mate.sur + mate.given, 'PERSON', 'mate'],
        relName: [person(), 'PERSON', 'other'], rel: [pick(P.REL)], nick: [pick(P.NICK), 'PERSON', 'nick'],
        teacherFull: [cls.tfull, 'PERSON', 'teacher'], school: [cls.school, 'SCHOOL'], town: [pick(P.TOWN), 'PLACE'],
        addr: [pick([() => pick(P.ROAD) + '路' + (1 + Math.floor(r() * 200)) + '号', () => pick(P.ESTATE) + '小区' + (1 + Math.floor(r() * 20)) + '栋' + (1 + Math.floor(r() * 6)) + '0' + (1 + Math.floor(r() * 4)) + '室'])(), 'PLACE'],
        phone: ['1' + pick(['3', '5', '8']) + digits(9), 'CONTACT'], qq: [String(1 + Math.floor(r() * 9)) + digits(8), 'CONTACT'], sid: [digits(8), 'ID'],
        dob: [(2008 + Math.floor(r() * 4)) + '年' + (1 + Math.floor(r() * 12)) + '月' + (1 + Math.floor(r() * 28)) + '日', 'DATE'],
        pub: [pp(), 'PUBLIC'], pub2: [pp(), 'PUBLIC'], book: [cls.book, 'PUBLIC'], n: [String(cls.n)],
      };
      let out = '';
      tpl.replace(/\{(\w+)\}|([^{]+)/g, (m, slot, lit) => {
        if (lit) { out += lit; return ''; }
        if (slot === 'teacher') { spans.push({ start: text.length + out.length, end: text.length + out.length + cls.tsur.length, type: 'PERSON', who: 'teacher', value: cls.tsur }); out += cls.tsur + cls.title; return ''; }
        const [val, type, who] = v[slot];
        if (type) spans.push({ start: text.length + out.length, end: text.length + out.length + val.length, type, who, value: val });
        out += val; return '';
      });
      return out;
    };
    text += fill(pick(P.HEADERS));
    const k = 5 + Math.floor(r() * 8), used = new Set();
    for (let j = 0; j < k; j++) { let t; do t = pick(P.BODY); while (used.has(t)); used.add(t); text += fill(t) + (r() < .3 ? '\n' : ''); }
    const trimmed = text.trim();
    papers.push({ id: 'zh' + seed + '-' + i, genre: 'zh', student: self.sur + self.given, roster: cls.names, task: cls.task, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
