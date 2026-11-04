// The third and last Chinese blind set, written 11/4 after every change prompted by the second and before anything was scored
// on it. New writing: a class meeting record, a reading log, a composition about a sports day, a letter to a future self, a
// review of a classmate's essay, a weekend journal and a book report on texts the famous list may not have. New family names,
// given names, nicknames, relatives and everyday words. Every student, relative, teacher, school, street and number is invented.
'use strict';

const SUR = [...'王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严武戴莫孔向汤温康施文牛樊葛邢安齐易乔伍庞颜倪庄聂章鲁岳柏甘祝包左'].concat(['欧阳', '司徒']);
const GIVEN = [...'沐宸梓轩欣妍诗琪宇泽锦程思源嘉懿晨曦语嫣浩宇一航子淇雅静文博梦瑶俊杰佳慧秀兰建军红梅永福金凤德明'];
const NICK = ['小猴', '豆芽', '阿星', '小黑', '胖墩', '圆圆', '木头', '小龙虾', '阿琳', '贝贝'];
const REL = ['妈妈', '爸爸', '老妈', '外公', '外婆', '姥爷', '三姨', '小叔', '大舅', '姑妈', '表弟', '堂姐', '继母', '干爹'];
const TOWN = ['枫林镇', '白马县', '南湾村', '松山镇'];
const ROAD = ['滨江', '振兴', '向阳', '育才', '东风'];
const ESTATE = ['碧桂', '翠苑', '华府', '星河'];
const BOOKS = [
  { book: '《骆驼祥子》', people: ['老舍', '祥子', '虎妞', '刘四爷'], task: '读《骆驼祥子》，分析祥子的三起三落。' },
  { book: '《红岩》', people: ['江姐', '许云峰', '甫志高', '罗广斌'], task: '读《红岩》，写一写你心中的英雄。' },
  { book: '《昆虫记》', people: ['法布尔'], task: '《昆虫记》读书笔记：选一种昆虫介绍。' },
  { book: '《哈利·波特》', people: ['哈利', '赫敏', '罗恩', '邓布利多', '伏地魔'], task: '读《哈利·波特》，谈谈友谊。' },
  { book: '《人世间》', people: ['周秉昆', '周蓉', '郑娟', '梁晓声'], task: '读《人世间》，说说普通人的坚守。' },
];
const HEADERS = ['班会记录  记录：{self}\n', '阅读记录卡  {n}班  {self}\n', '给十年后的自己\n', '作文互评  作者：{mateFull}  评改人：{self}\n', '周记  {self}\n', '{self}（{n}班）\n', '', '', ''];
const BODY = [
  // book reports
  '这本书我读了两遍，最喜欢{pub}。', '{pub}的选择让我很意外。', '我不太理解{pub}为什么要这样做。', '{pub}身上有一种不服输的劲儿。', '{book}让我知道了生活的不容易。', '如果能和{pub}聊天，我想问很多问题。',
  // people the student knows
  '运动会上，{mateFull}跑了第一名，全班都在欢呼。', '主持人是{mateFull}，她说话特别有条理。', '{mateFull}的作文开头写得很吸引人。', '建议{mateFull}结尾再写具体一点。', '{relWho}{relName}开车送我去比赛。',
  '{relName}阿姨在社区医院上班。', '班主任{teacherFull}宣布了下周的安排。', '{teacher}说我的字有进步。', '{nick}，这是同桌给我起的名字。', '在家里大家都叫我{nick}。', '十年后的{selfGiven}，你还好吗？',
  '我住在{addr}，门口有棵大槐树。', '联系电话：{phone}', '准考证号：{sid}', '出生日期：{dob}', '周六我们一家去了{town}钓鱼。', '{selfGiven}写于{date}', '署名：{self}', '谢谢你，{teacherFull}！',
  // everyday words that start with a family name's character
  '马上就要放寒假了。', '王国里住着一位国王。', '高兴的时候，我会唱歌。', '江边的风很大。', '何时才能再见面呢？', '万里无云，天空很蓝。', '白色的雪覆盖了操场。', '章节的最后一句话很有意思。',
  '安排好的计划被打乱了。', '黄金周的时候人特别多。', '石头上长满了青苔。', '向前看，不要回头。', '包子铺门口排起了长队。', '左边的同学先发言。', '史书上记载了这件事。',
];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function make(count = 500, seed = 103) {
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
        phone: [pick([() => '1' + pick(['3', '7', '9']) + digits(9), () => '0' + digits(2) + '-' + digits(8), () => '+86 1' + pick(['5', '8']) + digits(1) + ' ' + digits(4) + ' ' + digits(4)])(), 'CONTACT'], sid: [pick([() => digits(12), () => 'ZK' + digits(6)])(), 'ID'],
        dob: [(2008 + Math.floor(r() * 4)) + '年' + (1 + Math.floor(r() * 12)) + '月' + (1 + Math.floor(r() * 28)) + '日', 'DATE'],
        pub: [pp(), 'PUBLIC'], book: [cls.book, 'PUBLIC'], n: [String(cls.n)],
      };
      let out = '';
      tpl.replace(/\{(\w+)\}|([^{]+)/g, (m, slot, lit) => {
        if (lit) { out += lit; return ''; }
        if (slot === 'teacher') { spans.push({ start: text.length + out.length, end: text.length + out.length + cls.tsur.length, type: 'PERSON', who: 'teacher', value: cls.tsur }); out += cls.tsur + pick(['老师', '老师', '主任', '老师']); return ''; }
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
    papers.push({ id: 'zhblind3-' + i, genre: 'zhblind3', student: self.sur + self.given, roster: cls.names, task: cls.task, text: trimmed, spans: spans.filter(s => s.end <= trimmed.length) });
  }
  return papers;
}

module.exports = { make };
