import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base items data copied from knowledge-data.js
const deItems = [
  ["安静__教室", "的", "名词前用的"],
  ["认真__写作业", "地", "动作前用地"],
  ["跑__很快", "得", "程度前用得"],
  ["温柔__语气", "的", "名词前用的"],
  ["飞快__冲向终点", "地", "动作前用地"],
  ["笑__合不拢嘴", "得", "程度前用得"],
  ["整洁__书桌", "的", "名词前用的"],
  ["仔细__检查答案", "地", "动作前用地"],
  ["做__一丝不苟", "得", "程度前用得"],
  ["明亮__阳光", "的", "名词前用的"],
  ["轻轻__关上门", "地", "动作前用地"],
  ["急__直跺脚", "得", "程度前用得"],
  ["难忘__经历", "的", "名词前用的"],
  ["开心__跳起来", "地", "动作前用地"],
  ["累__满头大汗", "得", "程度前用得"],
  ["清脆__铃声", "的", "名词前用的"],
  ["耐心__解释", "地", "动作前用地"],
  ["写__很具体", "得", "程度前用得"],
  ["宽阔__操场", "的", "名词前用的"],
  ["慢慢__走回教室", "地", "动作前用地"],
  ["激动__说不出话", "得", "程度前用得"],
  ["香甜__苹果", "的", "名词前用的"],
  ["迅速__整理书包", "地", "动作前用地"],
  ["疼__皱起眉头", "得", "程度前用得"],
].map(([text, answer, tag]) => ({ text, answer, tag }));

const typoItems = [
  ["我__经完成作业了。", "已", "以", "同音字"],
  ["比赛马上开__。", "始", "使", "同音字"],
  ["我要再读一__。", "遍", "变", "形近字"],
  ["小__正在慢慢长高。", "树", "数", "同音字"],
  ["我觉__这句话很有道理。", "得", "的", "常用字"],
  ["老师认真地__作。", "工", "天", "形近字"],
  ["这是一件幸__的事。", "福", "遇", "字形记忆"],
  ["雾气笼__着小路。", "罩", "照", "同音字"],
  ["我把狗绳__好再下楼。", "牵", "掏", "词义辨析"],
  ["请把错别字改__。", "正", "证", "同音字"],
  ["他露出了灿烂的笑__。", "容", "荣", "同音字"],
  ["我们继续向小路的尽__走。", "头", "投", "同音字"],
  ["阿姨把餐盘认真消__。", "毒", "度", "同音字"],
  ["我把事情完整地__述了一遍。", "讲", "奖", "同音字"],
  ["同学们排着整齐的队__。", "伍", "五", "同音字"],
  ["妈妈提醒我要细__。", "心", "新", "同音字"],
  ["他终于获__了奖牌。", "得", "的", "常用字"],
  ["我们沿着弯曲的小__前进。", "路", "露", "同音字"],
  ["食堂阿姨准备了新__的饭菜。", "鲜", "先", "同音字"],
  ["我把图书摆放得整整__齐。", "齐", "其", "同音字"],
  ["这件事给我留下深刻的印__。", "象", "像", "同音字"],
  ["我鼓起勇气走上讲__。", "台", "抬", "同音字"],
  ["他把每个步__都做得很认真。", "骤", "聚", "形近字"],
  ["经过努力，我终于成__了。", "功", "工", "同音字"],
].map(([text, correct, wrong, tag]) => ({ text, correct, wrong, tag }));

const dialogueItems = [
  ["妈妈", "说", "今天早点睡吧", "。", "陈述句标点"],
  ["老师", "问", "你找到原文证据了吗", "？", "问句标点"],
  ["Leo", "回答", "我已经找到了", "。", "陈述句标点"],
  ["小明", "喊", "快来看这棵小树", "！", "感叹句标点"],
  ["爸爸", "问", "这道题的单位1是谁", "？", "问句标点"],
  ["我", "说", "让我再检查一遍", "。", "陈述句标点"],
  ["同桌", "提醒", "别忘了写答句", "。", "陈述句标点"],
  ["教练", "喊", "坚持到最后", "！", "感叹句标点"],
  ["妈妈", "问", "你今天最想练什么", "？", "问句标点"],
  ["我", "回答", "我想先练错别字", "。", "陈述句标点"],
  ["老师", "说", "三分题至少要写两点", "。", "陈述句标点"],
  ["小华", "问", "这句话能支持答案吗", "？", "问句标点"],
  ["爷爷", "笑着说", "你进步得真快", "！", "感叹句标点"],
  ["我", "问", "可以再给我一次机会吗", "？", "问句标点"],
  ["同学们", "喊", "我们成功了", "！", "感叹句标点"],
  ["妈妈", "说", "先读题再动笔", "。", "陈述句标点"],
  ["老师", "问", "这篇文章写了几件事", "？", "问句标点"],
  ["我", "回答", "文章写了两件事", "。", "陈述句标点"],
].map(([speaker, verb, quote, end, tag]) => ({
  speaker,
  verb,
  quote,
  end,
  tag,
  correct: `${speaker}${verb}：“${quote}${end}”`,
}));

const detailItems = [
  ["他很开心。", "他一下子从椅子上跳起来，举着奖状喊：“我做到了！”", "动作和语言", "把开心写成了看得见、听得到的表现"],
  ["我很紧张。", "我的手心冒汗，手指紧紧攥着衣角。", "动作和神态", "用身体反应表现紧张"],
  ["妈妈很累。", "妈妈靠在沙发上，揉着发酸的肩膀，连说话的声音都轻了。", "动作和声音", "用动作和声音表现疲惫"],
  ["雨下得很大。", "豆大的雨点砸在窗上，发出噼里啪啦的响声。", "环境描写", "写出了雨点、声音和力度"],
  ["他跑得很快。", "他弓着身子，双臂飞快摆动，几步就冲到了队伍最前面。", "动作描写", "把跑步动作分解得更具体"],
  ["教室很安静。", "教室里只听见笔尖划过纸面的沙沙声。", "环境描写", "用声音反衬安静"],
  ["我很后悔。", "我低下头，不敢看妈妈的眼睛，心里一遍遍想着刚才的话。", "动作和心理", "用动作和心理表现后悔"],
  ["阿姨很热情。", "阿姨笑着把热饭递过来，还提醒我：“小心烫。”", "神态和语言", "通过笑容和提醒表现热情"],
  ["他很生气。", "他皱紧眉头，猛地把书合上，脸涨得通红。", "神态和动作", "用神态 and 动作表现生气"],
  ["我很感动。", "看到那把一直向我倾斜的雨伞，我的鼻子一酸。", "细节和感受", "用雨伞倾斜这一细节表达感动"],
  ["小狗很兴奋。", "小狗摇着尾巴绕着我转圈，前爪不停地往我腿上扑。", "动作描写", "连续动作让画面更鲜活"],
  ["操场很热闹。", "加油声、哨声和脚步声混在一起，跑道边挤满了挥手的同学。", "环境描写", "从声音和人群写热闹"],
  ["老师很耐心。", "老师俯下身，指着算式一步一步问我：“这里为什么用减法？”", "动作和语言", "具体写出耐心指导的过程"],
  ["我很害怕。", "门外一响，我立刻屏住呼吸，背紧紧贴住墙。", "动作描写", "动作表现害怕"],
  ["爸爸很惊讶。", "爸爸睁大眼睛，愣了两秒，随后又看了一遍成绩单。", "神态和动作", "神态变化表现惊讶"],
  ["风很大。", "树枝被吹得左右摇晃，路边的塑料袋一下子卷上了半空。", "环境描写", "用物体变化表现风大"],
  ["she写字很认真。", "她一笔一画地写着，每写完一行都停下来检查。", "动作描写", "写出了认真完成和检查的过程"],
  ["我很着急。", "我不停地看钟，脚尖在地上轻轻点着。", "动作描写", "用连续小动作表现着急"],
  ["饭菜很香。", "锅盖一掀开，热气裹着香味扑过来，我忍不住咽了咽口水。", "感官描写", "调动嗅觉和动作写香味"],
  ["他很失望。", "他盯着落空的球门，肩膀慢慢垂了下来。", "神态 and 动作", "用姿态变化表现失望"],
].map(([general, detail, type, explanation]) => ({ general, detail, type, explanation, tag: type }));

const readingItems = [
  ["下课后，小林发现教室地上有许多纸屑。他没有马上离开，而是拿起扫把把地面扫干净。", "小林下课后做了什么？", "他拿起扫把把地面扫干净。", "他马上离开教室。", 2, "信息定位"],
  ["清晨，爷爷每天都给院子里的花浇水，还细心剪去枯叶。春天到了，花开得格外鲜艳。", "花为什么开得格外鲜艳？", "爷爷每天浇水并剪去枯叶。", "春天的风很大。", 2, "原因结果"],
  ["比赛最后一分钟，队友把球传给小刚。小刚没有急着射门，而是观察位置后把球传给空位的同学，球队最终进球。", "小刚是怎样帮助球队进球的？", "他观察位置后把球传给空位的同学。", "他一个人带球离开了球场。", 3, "过程概括"],
  ["小雨第一次演讲时声音很小。她每天对着镜子练习，还请妈妈帮她指出问题。一个月后，她能自信地站在台上。", "小雨发生了什么变化？", "她从声音很小变得能自信演讲。", "她不再参加任何活动。", 2, "变化概括"],
  ["食堂阿姨每天很早到校，洗菜、切菜、做饭。午餐时，她总把热乎乎的饭菜递给同学们。", "食堂阿姨有哪些辛苦的表现？", "她很早到校，还要洗菜、切菜和做饭。", "她午餐后才到学校。", 3, "分点表达"],
  ["一场大雨后，小桥被冲坏了。村民们有人搬木头，有人钉木板，有人清理泥沙，很快修好了桥。", "村民们怎样修好小桥？", "大家分工合作，搬木头、钉木板、清泥沙。", "大家站在桥边等待。", 3, "分点表达"],
  ["小猫听见门外的声音，先竖起耳朵，又慢慢走到门边，最后躲到沙发后面。", "小猫听见声音后有哪些动作？", "竖耳朵、走到门边、躲到沙发后面。", "一直趴在窗台上睡觉。", 3, "顺序概括"],
  ["老师把一颗种子交给我们，让大家每天观察。几天后，种皮裂开，嫩芽钻了出来。", "种子发生了怎样的变化？", "种皮裂开，嫩芽钻了出来。", "种子变成了一块石头。", 2, "信息定位"],
  ["爸爸修自行车时，先检查轮胎，再拧紧螺丝，最后给链条上油。自行车很快又能骑了。", "爸爸修车分哪几个步骤？", "检查轮胎、拧紧螺丝、给链条上油。", "买车、卖车、洗车。", 3, "顺序概括"],
  ["太阳落山后，天空先变成橙红色，接着慢慢暗下来，第一颗星星出现在天边。", "傍晚的天空有什么变化？", "由橙红色慢慢变暗，并出现星星。", "一直保持明亮的蓝色。", 2, "变化概括"],
  ["哥哥把自己的雨衣给了弟弟，自己却淋着雨跑回家。到家时，他的衣服全湿了。", "从哪里能看出哥哥关心弟弟？", "他把雨衣给弟弟，自己淋雨回家。", "他到家后换了衣服。", 2, "证据判断"],
  ["小芳画画失败了好几次，但她没有放弃。她重新观察实物，修改线条，最后完成了作品。", "小芳具有什么品质？", "遇到困难不放弃，愿意反复修改。", "做事马虎，遇事逃避。", 3, "品质概括"],
  ["图书管理员发现书架很乱，便按类别重新整理，还贴上清楚的标签。大家找书方便多了。", "管理员整理书架带来了什么结果？", "大家找书更方便了。", "书架上的书更少了。", 2, "原因结果"],
  ["冬天，松树仍然披着绿色的外衣。大雪压在枝头，它依然挺立着。", "文中的松树给你怎样的感受？", "坚强、不怕严寒。", "柔弱、害怕风雪。", 2, "品质概括"],
  ["我把捡到的钱包交给老师。老师找到失主后，失主连声向我道谢。", "事情的结果是什么？", "失主找回钱包并向我道谢。", "我把钱包带回了家。", 2, "结果定位"],
].map(([passage, question, evidence, distractor, points, tag]) => ({
  passage,
  question,
  evidence,
  distractor,
  points,
  expectedParts: points >= 3 ? 2 : 1,
  tag,
}));

const unitItems = [
  ["一本书第一天看了全书的1/5。", "全书页数", ["第一天看的页数", "剩下的页数"], "占比单位1"],
  ["月季占花园总面积的1/4。", "花园总面积", ["月季面积", "草坪面积"], "占比单位1"],
  ["男生人数是全班人数的2/5。", "全班人数", ["男生人数", "女生人数"], "占比单位1"],
  ["已修路程占公路全长的3/8。", "公路全长", ["已修路程", "未修路程"], "占比单位1"],
  ["苹果重量是水果总重量的1/3。", "水果总重量", ["苹果重量", "梨的重量"], "占比单位1"],
  ["足球组人数占五年级人数的2/9。", "五年级人数", ["足球组人数", "绘画组人数"], "占比单位1"],
  ["用去的布料占原有布料的3/7。", "原有布料", ["用去的布料", "剩下的布料"], "占比单位1"],
  ["女生人数比男生人数多1/6。", "男生人数", ["女生人数", "全班人数"], "比较单位1"],
  ["今年产量比去年增加1/5。", "去年产量", ["今年产量", "增加的产量"], "比较单位1"],
  ["甲数比乙数少2/9。", "乙数", ["甲数", "甲乙两数之和"], "比较单位1"],
  ["白兔只数是黑兔的3/4。", "黑兔只数", ["白兔只数", "兔子总数"], "比较单位1"],
  ["现在价格比原价降低1/10。", "原价", ["现价", "降低的钱数"], "比较单位1"],
  ["完成的任务是全部任务的5/6。", "全部任务", ["完成的任务", "未完成的任务"], "占比单位1"],
  ["反思时间占学习总时间的1/5。", "学习总时间", ["反思时间", "做题时间"], "占比单位1"],
  ["百合占花圃总面积的1/3。", "花圃总面积", ["百合面积", "玫瑰面积"], "占比单位1"],
].map(([text, unit, distractors, tag]) => ({ text, unit, distractors, tag }));

const targetItems = [
  ["月季占1/4，菊花占1/3，其余是草坪。问草坪占几分之几。", "剩余占比", "用1减去已知占比", "单位1减法"],
  ["上衣用去3/8米，裤子用去1/4米。问一共用去多少米。", "实际数量", "把两段长度相加", "实际量加法"],
  ["白菜占3/8，辣椒占1/12。问白菜比辣椒多占几分之几。", "相差占比", "用白菜占比减辣椒占比", "比较减法"],
  ["第一天看1/6，第二天看1/4。问两天共看全书的几分之几。", "合计占比", "把两天占比相加", "占比加法"],
  ["一根彩带用去2/5米，还剩1/3米。问原来长多少米。", "实际数量", "把用去和剩下的长度相加", "实际量加法"],
  ["绘画组占2/9，足球组占1/3，其余参加合唱。问合唱组占几分之几。", "剩余占比", "用1减去已知占比", "单位1减法"],
  ["全程12千米，已经走了5千米。问还剩多少千米。", "实际数量", "用总路程减已走路程", "实际量减法"],
  ["甲数是3/5，乙数 is 1/4。问两数相差多少。", "相差数量", "用较大数减较小数", "比较减法"],
  ["读书30分钟，做题40分钟，反思10分钟。问学习总时间。", "合计数量", "把三部分时间相加", "实际量加法"],
  ["反思10分钟，总学习80分钟。问反思时间占总时间的几分之几。", "部分占比", "用部分量除以总量并化成分数", "部分除以总量"],
  ["一桶油用去3/10，还剩几分之几。", "剩余占比", "用1减去用去的占比", "单位1减法"],
  ["一块地种菜2/5公顷，种花1/6公顷。问共用多少公顷。", "实际数量", "把两个实际面积相加", "实际量加法"],
  ["男生占2/5，女生占几分之几。", "剩余占比", "用1减去男生占比", "单位1减法"],
  ["原有布料2米，用去3/4米。问还剩多少米。", "实际数量", "用原有长度减去用去长度", "实际量减法"],
  ["总面积5/6公顷，玫瑰占总面积4/15。问玫瑰实际面积。", "实际数量", "用总面积乘玫瑰占比", "占比求实际量"],
].map(([text, category, method, tag]) => ({ text, category, method, tag }));

const fractionItems = [
  ["1/4", "+", "1/3"],
  ["2/5", "+", "1/10"],
  ["3/4", "-", "1/6"],
  ["5/6", "-", "1/4"],
  ["1/8", "+", "3/8"],
  ["7/9", "-", "2/3"],
  ["2/7", "+", "3/14"],
  ["11/12", "-", "5/18"],
  ["1/5", "+", "7/15"],
  ["5/8", "-", "1/12"],
  ["3/10", "+", "4/15"],
  ["7/12", "-", "1/8"],
  ["2/3", "+", "5/9"],
  ["13/15", "-", "2/5"],
  ["1/6", "+", "5/12"],
  ["7/10", "-", "3/20"],
  ["4/9", "+", "5/6"],
  ["9/14", "-", "2/7"],
  ["3/16", "+", "5/24"],
  ["17/18", "-", "7/12"],
].map(([a, op, b], index) => ({ a, op, b, tag: index % 3 === 0 ? "通分" : index % 3 === 1 ? "约分" : "结果检查" }));

const statsItems = [
  ["学习时间", [["读书", 30], ["做题", 40], ["反思", 10]], "反思", "先求总量"],
  ["运动时间", [["跑步", 20], ["跳绳", 15], ["足球", 25]], "足球", "部分占总量"],
  ["零花钱", [["文具", 12], ["图书", 18], ["储蓄", 30]], "图书", "部分占总量"],
  ["阅读页数", [["周一", 12], ["周二", 18], ["周三", 30]], "周三", "先求总量"],
  ["社团人数", [["绘画", 8], ["足球", 12], ["合唱", 20]], "足球", "部分占总量"],
  ["植树棵数", [["一组", 15], ["二组", 20], ["三组", 25]], "一组", "先求总量"],
  ["家务时间", [["整理", 10], ["扫地", 15], ["洗碗", 5]], "洗碗", "部分占总量"],
  ["借书数量", [["文学", 14], ["科普", 10], ["历史", 6]], "科普", "部分占总量"],
  ["比赛得分", [["上半场", 24], ["下半场", 36]], "上半场", "先求总量"],
  ["水果数量", [["苹果", 18], ["梨", 12], ["橙子", 30]], "梨", "部分占总量"],
  ["练习题数", [["计算", 20], ["应用", 10], ["图形", 10]], "应用", "部分占总量"],
  ["活动人数", [["朗诵", 9], ["舞蹈", 15], ["合唱", 21]], "舞蹈", "先求总量"],
  ["用水量", [["洗漱", 8], ["洗衣", 16], ["清洁", 24]], "洗衣", "部分占总量"],
  ["观察天数", [["晴天", 12], ["阴天", 6], ["雨天", 2]], "雨天", "部分占总量"],
  ["作业时间", [["语文", 25], ["数学", 35], ["英文", 20]], "数学", "先求总量"],
].map(([title, parts, target, tag]) => ({ title, parts, target, tag }));

// Helper functions for math question generation
function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function parseFraction(value) {
  const [n, d] = value.split("/").map(Number);
  return [n, d];
}

function fraction(n, d) {
  const divisor = gcd(n, d);
  const numerator = n / divisor;
  const denominator = d / divisor;
  if (denominator === 1) return String(numerator);
  return `${numerator}/${denominator}`;
}

function calculateFraction(a, op, b) {
  const [an, ad] = parseFraction(a);
  const [bn, bd] = parseFraction(b);
  const numerator = op === "+" ? an * bd + bn * ad : an * bd - bn * ad;
  return fraction(numerator, ad * bd);
}

function rotateOptions(options, seed, targetLength = 3) {
  const unique = [...new Set(options)];
  const numericLike = unique.some((value) => /^-?\d+(\/\d+)?$/.test(String(value)));
  const fallbacks = numericLike ? ["0", "1", "1/2", "2/3"] : ["以上都不对", "无法判断", "不确定"];
  for (const fallback of fallbacks) {
    if (unique.length >= targetLength) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }
  const offset = seed % unique.length;
  return unique.slice(offset).concat(unique.slice(0, offset));
}

function pick(items, count, round, focusTags, offset) {
  const tags = new Set(focusTags || []);
  const focused = tags.size ? items.filter((item) => tags.has(item.tag)) : [];
  const rest = items.filter((item) => !focused.includes(item));
  const ordered = focused.concat(rest);
  const shift = ((round - 1) * 5 + offset) % ordered.length;
  const rotated = ordered.slice(shift).concat(ordered.slice(0, shift));
  return Array.from({ length: count }, (_, index) => rotated[index % rotated.length]);
}

function choice(prompt, options, answer, explanation, tag) {
  return { type: "choice", prompt, options, answer, explanation, tag };
}

function fill(prompt, answers, explanation, tag) {
  return { type: "fill", prompt, answers: Array.isArray(answers) ? answers : [answers], explanation, tag };
}

function judge(prompt, answer, explanation, tag, options) {
  if (options) {
    return { type: "judge", prompt, options, answers: [answer ? "正确" : "错误"], explanation, tag };
  }
  return { type: "judge", prompt, answer, explanation, tag };
}

// Builders
function buildDe(round, focusTags) {
  const countChoice = 20;
  const countJudge = 10;
  return {
    choice: pick(deItems, countChoice, round, focusTags, 0).map((item, index) =>
      choice(`“${item.text}”横线处应该填哪个字？`, rotateOptions(["的", "地", "得"], index + round, 4), item.answer, `${item.tag}。正确写法是“${item.text.replace("__", item.answer)}”。`, item.tag),
    ),
    fill: [],
    judge: pick(deItems, countJudge, round, focusTags, 10).map((item, index) => {
      const shown = index % 2 === 0 ? item.answer : ({ 的: "地", 地: "得", 得: "的" })[item.answer];
      const sentence = item.text.replace("__", shown);
      return judge(`判断下面的写法是否正确：${sentence}`, shown === item.answer, `正确写法：${item.text.replace("__", item.answer)}。${item.tag}。`, item.tag, ["正确", "错误", "不确定"]);
    }),
  };
}

function buildTypos(round, focusTags) {
  const countChoice = 20;
  const countJudge = 10;
  return {
    choice: pick(typoItems, countChoice, round, focusTags, 0).map((item, index) => {
      const options = rotateOptions([item.correct, item.wrong, item.correct === "已" ? "己" : "在"], index + round, 4);
      return choice(`${item.text.replace("__", "（ ）")}`, options, item.correct, `正确写法是“${item.text.replace("__", item.correct)}”。`, item.tag);
    }),
    fill: [],
    judge: pick(typoItems, countJudge, round, focusTags, 10).map((item, index) => {
      const shown = index % 2 === 0 ? item.correct : item.wrong;
      return judge(`判断句子中的字是否使用正确：${item.text.replace("__", shown)}`, shown === item.correct, `正确写法：${item.text.replace("__", item.correct)}。`, item.tag, ["正确", "错误", "不确定"]);
    }),
  };
}

function buildPunctuation(round, focusTags) {
  const countChoice = 20;
  const countJudge = 10;
  return {
    choice: pick(dialogueItems, countChoice, round, focusTags, 0).map((item, index) => {
      const wrongA = `${item.speaker}${item.verb}“${item.quote}${item.end}”`;
      const wrongB = `${item.speaker}${item.verb}：“${item.quote}”${item.end}`;
      return choice("选择标点完全正确的一项。", rotateOptions([item.correct, wrongA, wrongB], index + round, 4), item.correct, `人物说话前用冒号，引号内保留句末标点：${item.correct}`, item.tag);
    }),
    fill: [],
    judge: pick(dialogueItems, countJudge, round, focusTags, 10).map((item, index) => {
      const correct = index % 2 === 0;
      const shown = correct ? item.correct : `${item.speaker}${item.verb}“${item.quote}”${item.end}`;
      return judge(`判断标点是否正确：${shown}`, correct, `正确格式：${item.correct}`, item.tag, ["正确", "错误", "不确定"]);
    }),
  };
}

function buildDetails(round, focusTags) {
  const countChoice = 20;
  const countJudge = 10;
  return {
    choice: pick(detailItems, countChoice, round, focusTags, 0).map((item, index) =>
      choice("哪一句更有画面感、更适合作为作文细节描写？", rotateOptions([item.detail, item.general, "这件事真的非常特别。"], index + round, 4), item.detail, `${item.explanation}。`, item.tag),
    ),
    fill: [],
    judge: pick(detailItems, countJudge, round, focusTags, 10).map((item, index) => {
      const detailed = index % 2 === 0;
      const shown = detailed ? item.detail : item.general;
      return judge(`“${shown}”已经把感受写成了具体可见的细节。`, detailed, detailed ? item.explanation : `“${item.general}”仍然比较概括，可以改成：“${item.detail}”`, item.tag, ["正确", "错误", "不确定"]);
    }),
  };
}

function buildReading(round, focusTags) {
  const countChoice = 20;
  const countJudge = 10;
  return {
    choice: pick(readingItems, countChoice, round, focusTags, 0).map((item, index) =>
      choice(`阅读短文：${item.passage}\n问题：${item.question}\n哪一句最能支持答案？`, rotateOptions([item.evidence, item.distractor, "短文中没有相关内容。"], index + round, 4), item.evidence, `先抓题干关键词，再回原文找直接支撑句。证据是：“${item.evidence}”`, item.tag),
    ),
    fill: [],
    judge: pick(readingItems, countJudge, round, focusTags, 10).map((item, index) => {
      const valid = index % 2 === 0;
      const evidence = valid ? item.evidence : item.distractor;
      return judge(`针对问题“${item.question}”，句子“${evidence}”可以作为直接证据。`, valid, valid ? "这句话直接回答了题目中的关键词。" : `这句话不能支撑答案，应找：“${item.evidence}”`, item.tag, ["正确", "错误", "不确定"]);
    }),
  };
}

function buildUnitOne(round, focusTags) {
  const count = round === 1 ? 15 : 10;
  return {
    choice: pick(unitItems, count, round, focusTags, 0).map((item, index) =>
      choice(`${item.text}\n这句话中谁是单位1？`, rotateOptions([item.unit, ...item.distractors], index + round), item.unit, `“占谁的”或“比谁”中的“谁”通常就是单位1，本题是${item.unit}。`, item.tag),
    ),
    fill: pick(unitItems, count, round, focusTags, 5).map((item) =>
      fill(`${item.text}\n单位1是：____`, item.unit, `单位1是${item.unit}。`, item.tag),
    ),
    judge: pick(unitItems, count, round, focusTags, 10).map((item, index) => {
      const valid = index % 2 === 0;
      const shown = valid ? item.unit : item.distractors[0];
      return judge(`${item.text}\n把“${shown}”看作单位1。`, valid, `正确的单位1是${item.unit}。`, item.tag);
    }),
  };
}

function buildTargets(round, focusTags) {
  const count = round === 1 ? 15 : 10;
  const categories = ["剩余占比", "实际数量", "相差占比", "合计占比", "部分占比", "合计数量"];
  return {
    choice: pick(targetItems, count, round, focusTags, 0).map((item, index) =>
      choice(`${item.text}\n题目最后要求的是什么？`, rotateOptions([item.category, ...categories.filter((value) => value !== item.category).slice(0, 2)], index + round), item.category, `先翻译最后一句：本题要求的是“${item.category}”。`, item.tag),
    ),
    fill: pick(targetItems, count, round, focusTags, 5).map((item) =>
      fill(`${item.text}\n列式前先写：我应该怎样求？`, [item.method, item.method.replace("占比", "分数")], `正确关系：${item.method}。`, item.tag),
    ),
    judge: pick(targetItems, count, round, focusTags, 10).map((item, index) => {
      const valid = index % 2 === 0;
      const shown = valid ? item.method : item.method.includes("相加") ? "把两个量相减" : "把所有数字直接相加";
      return judge(`${item.text}\n应该“${shown}”。`, valid, `正确思路：${item.method}。`, item.tag);
    }),
  };
}

function buildFractions(round, focusTags) {
  const count = round === 1 ? 15 : 10;
  function optionsFor(item, index) {
    const result = calculateFraction(item.a, item.op, item.b);
    const [an, ad] = parseFraction(item.a);
    const [bn, bd] = parseFraction(item.b);
    const wrong1 = fraction(item.op === "+" ? an + bn : Math.abs(an - bn), ad + bd);
    const wrong2 = fraction(item.op === "+" ? an * bd + bn * ad : Math.abs(an * bd - bn * ad), ad * bd * 2);
    return rotateOptions([result, wrong1, wrong2], index + round);
  }
  return {
    choice: pick(fractionItems, count, round, focusTags, 0).map((item, index) => {
      const result = calculateFraction(item.a, item.op, item.b);
      return choice(`计算：${item.a} ${item.op} ${item.b}`, optionsFor(item, index), result, `先通分，再${item.op === "+" ? "相加" : "相减"}，最后约分，结果是${result}。`, item.tag);
    }),
    fill: pick(fractionItems, count, round, focusTags, 5).map((item) => {
      const result = calculateFraction(item.a, item.op, item.b);
      return fill(`计算并写最简结果：${item.a} ${item.op} ${item.b} = ____`, result, `正确结果是${result}，注意通分和约分。`, item.tag);
    }),
    judge: pick(fractionItems, count, round, focusTags, 10).map((item, index) => {
      const result = calculateFraction(item.a, item.op, item.b);
      const valid = index % 2 === 0;
      const shown = valid ? result : optionsFor(item, index).find((value) => value !== result);
      return judge(`${item.a} ${item.op} ${item.b} = ${shown}`, valid, `正确结果是${result}。`, item.tag);
    }),
  };
}

function buildStats(round, focusTags) {
  const count = round === 1 ? 15 : 10;
  function describe(item) {
    return item.parts.map(([name, value]) => `${name}${value}`).join("，");
  }
  return {
    choice: pick(statsItems, count, round, focusTags, 0).map((item, index) => {
      const total = item.parts.reduce((sum, [, value]) => sum + value, 0);
      const targetValue = item.parts.find(([name]) => name === item.target)[1];
      const ratio = fraction(targetValue, total);
      return choice(`${item.title}数据：${describe(item)}。\n${item.target}占总量的几分之几？`, rotateOptions([ratio, fraction(targetValue, 100), fraction(total - targetValue, total)], index + round), ratio, `先求总量${total}，再用${targetValue}÷${total}，得到${ratio}。`, item.tag);
    }),
    fill: pick(statsItems, count, round, focusTags, 5).map((item) => {
      const total = item.parts.reduce((sum, [, value]) => sum + value, 0);
      return fill(`${item.title}数据：${describe(item)}。\n总量是____。`, String(total), `把各部分相加：总量是${total}。`, "先求总量");
    }),
    judge: pick(statsItems, count, round, focusTags, 10).map((item, index) => {
      const total = item.parts.reduce((sum, [, value]) => sum + value, 0);
      const targetValue = item.parts.find(([name]) => name === item.target)[1];
      const correctRatio = fraction(targetValue, total);
      const valid = index % 2 === 0;
      const shown = valid ? correctRatio : fraction(targetValue, 100);
      return judge(`${item.title}数据：${describe(item)}。\n${item.target}占总量的${shown}。`, valid, `总量是${total}，正确占比是${targetValue}/${total}=${correctRatio}。`, item.tag);
    }),
  };
}

const pointBuilders = {
  "composition-de-di-de": buildDe,
  "composition-typo-check": buildTypos,
  "composition-punctuation-dialogue": buildPunctuation,
  "composition-detail-upgrade": buildDetails,
  "chinese-reading-three-questions": buildReading,
  "math-unit-one": buildUnitOne,
  "question-target": buildTargets,
  "fraction-calculation": buildFractions,
  "statistics-ratio": buildStats
};

async function ensureColumn(pool, table, column, definition) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (rows.length === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function ensureIndex(pool, table, indexName, columns) {
  const [rows] = await pool.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
  if (rows.length === 0) {
    await pool.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${columns})`);
  }
}

async function createPhase2Tables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      grade VARCHAR(100) NOT NULL,
      semester VARCHAR(100) NOT NULL,
      education_system VARCHAR(100) NOT NULL,
      textbook_version VARCHAR(100) NOT NULL,
      school_requirements TEXT,
      long_term_goal TEXT,
      daily_minutes INT NOT NULL DEFAULT 20,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_pages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      material_id VARCHAR(100) NOT NULL,
      page_number INT NOT NULL,
      source VARCHAR(500) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      source_hash VARCHAR(64),
      clarity_score DECIMAL(5,2),
      rotation INT NOT NULL DEFAULT 0,
      duplicate_of BIGINT,
      review_required TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_material_page (material_id, page_number)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_questions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      material_id VARCHAR(100) NOT NULL,
      page_number INT NOT NULL DEFAULT 1,
      question_number VARCHAR(50) NOT NULL,
      question_type VARCHAR(50),
      score DECIMAL(6,2),
      prompt TEXT,
      student_answer TEXT,
      correct_answer TEXT,
      teacher_mark TEXT,
      evidence_text TEXT,
      confidence DECIMAL(5,2) NOT NULL DEFAULT 0,
      review_required TINYINT(1) NOT NULL DEFAULT 0,
      review_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_findings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      material_id VARCHAR(100) NOT NULL,
      question_id BIGINT,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(30) NOT NULL,
      priority VARCHAR(10) NOT NULL,
      reason TEXT NOT NULL,
      knowledge_code VARCHAR(100),
      evidence_text TEXT,
      student_answer TEXT,
      expected_answer TEXT,
      confidence DECIMAL(5,2) NOT NULL DEFAULT 0,
      review_required TINYINT(1) NOT NULL DEFAULT 0,
      review_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      reviewer_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge_catalog (
      code VARCHAR(100) PRIMARY KEY,
      subject VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      grade VARCHAR(100) NOT NULL,
      semester VARCHAR(100) NOT NULL,
      textbook_version VARCHAR(100) NOT NULL,
      unit_name VARCHAR(255),
      parent_code VARCHAR(100),
      prerequisite_codes TEXT NOT NULL,
      mastery_standard TEXT NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mastery_snapshots (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      point_id VARCHAR(50) NOT NULL,
      mastery_score DECIMAL(5,2) NOT NULL,
      confidence_score DECIMAL(5,2) NOT NULL,
      status VARCHAR(30) NOT NULL,
      reason TEXT NOT NULL,
      source_type VARCHAR(50) NOT NULL,
      source_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS study_tasks (
      id VARCHAR(100) PRIMARY KEY,
      student_id VARCHAR(50) NOT NULL DEFAULT 'leo',
      subject VARCHAR(50) NOT NULL,
      point_id VARCHAR(50),
      material_id VARCHAR(100),
      title VARCHAR(255) NOT NULL,
      reason TEXT NOT NULL,
      task_type VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      priority VARCHAR(10) NOT NULL DEFAULT 'P1',
      estimated_minutes INT NOT NULL DEFAULT 10,
      mastery_goal VARCHAR(255),
      due_at DATETIME,
      completed_at DATETIME,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_plans (
      id VARCHAR(100) PRIMARY KEY,
      point_id VARCHAR(50) NOT NULL,
      round INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      goal TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      estimated_minutes INT NOT NULL DEFAULT 10,
      question_count INT NOT NULL DEFAULT 0,
      coverage TEXT NOT NULL,
      generation_source VARCHAR(50) NOT NULL DEFAULT 'ai',
      ai_run_id BIGINT,
      quality_score DECIMAL(5,2),
      quality_issues TEXT NOT NULL,
      published_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_point_round_plan (point_id, round)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_quality_reviews (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      plan_id VARCHAR(100) NOT NULL,
      passed TINYINT(1) NOT NULL,
      score DECIMAL(5,2) NOT NULL,
      issues TEXT NOT NULL,
      duplicate_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills (
      slug VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      subject VARCHAR(50) NOT NULL,
      material_types TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'enabled',
      active_version INT NOT NULL DEFAULT 1,
      file_path VARCHAR(500) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skill_versions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      skill_slug VARCHAR(100) NOT NULL,
      version INT NOT NULL,
      content LONGTEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      change_note VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_skill_version (skill_slug, version)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      slug VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      task_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'enabled',
      active_version INT NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      prompt_slug VARCHAR(100) NOT NULL,
      version INT NOT NULL,
      content LONGTEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      variables TEXT NOT NULL,
      test_score DECIMAL(5,2),
      test_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_prompt_version (prompt_slug, version)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS model_configs (
      model_key VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(100) NOT NULL,
      model_name VARCHAR(255) NOT NULL,
      purpose TEXT NOT NULL,
      key_ref VARCHAR(100) NOT NULL,
      temperature DECIMAL(4,2) NOT NULL DEFAULT 0.2,
      timeout_seconds INT NOT NULL DEFAULT 90,
      retry_count INT NOT NULL DEFAULT 1,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      last_status VARCHAR(30) NOT NULL DEFAULT 'unknown',
      last_error TEXT,
      last_checked_at DATETIME,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_routes (
      route_key VARCHAR(100) PRIMARY KEY,
      task_type VARCHAR(100) NOT NULL,
      subject VARCHAR(50) NOT NULL DEFAULT '*',
      material_type VARCHAR(100) NOT NULL DEFAULT '*',
      skill_slug VARCHAR(100) NOT NULL,
      prompt_slug VARCHAR(100) NOT NULL,
      model_key VARCHAR(100) NOT NULL,
      fallback_model_key VARCHAR(100),
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_runs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      task_type VARCHAR(100) NOT NULL,
      subject VARCHAR(50),
      material_id VARCHAR(100),
      point_id VARCHAR(50),
      skill_slug VARCHAR(100),
      skill_version INT,
      prompt_slug VARCHAR(100),
      prompt_version INT,
      model_key VARCHAR(100),
      status VARCHAR(30) NOT NULL,
      input_summary TEXT,
      output_summary TEXT,
      error_message TEXT,
      duration_ms INT,
      retry_of BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      detail TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const materialColumns = [
    ['status', "VARCHAR(30) NOT NULL DEFAULT 'pending_review'"],
    ['grade', "VARCHAR(100) NOT NULL DEFAULT '小学五年级'"],
    ['semester', "VARCHAR(100) NOT NULL DEFAULT '下学期'"],
    ['textbook_version', "VARCHAR(100) NOT NULL DEFAULT '待确认'"],
    ['unit_name', 'VARCHAR(255)'],
    ['has_answers', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['has_teacher_marks', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['analysis_status', "VARCHAR(30) NOT NULL DEFAULT 'not_started'"],
    ['analysis_confidence', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
    ['skill_slug', 'VARCHAR(100)'],
    ['skill_version', 'INT'],
    ['prompt_slug', 'VARCHAR(100)'],
    ['prompt_version', 'INT'],
    ['model_key', 'VARCHAR(100)'],
    ['ai_run_id', 'BIGINT'],
    ['processing_error', 'TEXT'],
    ['source_hash', 'VARCHAR(64)'],
    ['archived_at', 'DATETIME'],
    ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
  ];
  for (const [column, definition] of materialColumns) {
    await ensureColumn(pool, 'materials', column, definition);
  }

  const knowledgeColumns = [
    ['catalog_code', 'VARCHAR(100)'],
    ['status', "VARCHAR(30) NOT NULL DEFAULT 'new'"],
    ['mastery_score', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
    ['confidence_score', 'DECIMAL(5,2) NOT NULL DEFAULT 50'],
    ['occurrence_count', 'INT NOT NULL DEFAULT 1'],
    ['next_review_at', 'DATETIME'],
    ['last_evidence_at', 'DATETIME'],
    ['grade', "VARCHAR(100) NOT NULL DEFAULT '小学五年级'"],
    ['semester', "VARCHAR(100) NOT NULL DEFAULT '下学期'"],
    ['textbook_version', "VARCHAR(100) NOT NULL DEFAULT '待确认'"],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
  ];
  for (const [column, definition] of knowledgeColumns) {
    await ensureColumn(pool, 'knowledge_points', column, definition);
  }

  const quizColumns = [
    ['difficulty', 'INT NOT NULL DEFAULT 1'],
    ['source_basis', 'TEXT'],
    ['expected_error', 'TEXT'],
    ['semantic_hash', 'VARCHAR(64)'],
    ['quality_status', "VARCHAR(30) NOT NULL DEFAULT 'unchecked'"],
    ['is_locked', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['version', 'INT NOT NULL DEFAULT 1'],
    ['generation_id', 'VARCHAR(100)'],
    ['status', "VARCHAR(30) NOT NULL DEFAULT 'draft'"],
    ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
  ];
  for (const [column, definition] of quizColumns) {
    await ensureColumn(pool, 'quiz_questions', column, definition);
  }

  const resultColumns = [
    ['total_count', 'INT'],
    ['correct_count', 'INT'],
    ['duration_seconds', 'INT'],
    ['result_type', "VARCHAR(30) NOT NULL DEFAULT 'quiz'"]
  ];
  for (const [column, definition] of resultColumns) {
    await ensureColumn(pool, 'quiz_results', column, definition);
  }

  await ensureIndex(pool, 'materials', 'idx_material_status', '`status`, `analysis_status`');
  await ensureIndex(pool, 'material_findings', 'idx_finding_review', '`review_status`, `priority`');
  await ensureIndex(pool, 'study_tasks', 'idx_task_due', '`status`, `due_at`');
  await ensureIndex(pool, 'ai_runs', 'idx_ai_run_status', '`status`, `created_at`');
}

function skillSubject(slug) {
  if (slug.startsWith('chinese-')) return 'chinese';
  if (slug.startsWith('math-')) return 'math';
  if (slug.startsWith('english-')) return 'english';
  return 'all';
}

async function seedPhase2Data(pool) {
  const projectRoot = path.resolve(__dirname, '../..');
  const aiDefaults = JSON.parse(await fs.readFile(path.join(projectRoot, 'config/ai-defaults.json'), 'utf8'));
  const knowledgeCatalog = JSON.parse(await fs.readFile(path.join(projectRoot, 'config/knowledge-catalog.json'), 'utf8'));

  await pool.query(
    `INSERT INTO student_profiles
      (id, name, grade, semester, education_system, textbook_version, school_requirements, long_term_goal, daily_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    ['leo', 'Leo', '小学五年级', '下学期', '中国教育体系', '待确认', '', '建立可跨学段延续的个人知识画像和高效学习闭环', 20]
  );

  for (const item of knowledgeCatalog.items || []) {
    await pool.query(
      `INSERT INTO knowledge_catalog
        (code, subject, title, grade, semester, textbook_version, unit_name, parent_code, prerequisite_codes, mastery_standard, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
        title = VALUES(title), grade = VALUES(grade), semester = VALUES(semester),
        unit_name = VALUES(unit_name), parent_code = VALUES(parent_code),
        prerequisite_codes = VALUES(prerequisite_codes), mastery_standard = VALUES(mastery_standard)`,
      [
        item.code,
        item.subject,
        item.title,
        item.grade,
        item.semester,
        knowledgeCatalog.studentStage?.textbookVersion || '待确认',
        item.unit || '',
        item.parentCode || '',
        JSON.stringify(item.prerequisiteCodes || []),
        item.masteryStandard
      ]
    );
  }

  const skillsRoot = path.join(projectRoot, '技能');
  const skillDirectories = await fs.readdir(skillsRoot, { withFileTypes: true });
  for (const entry of skillDirectories) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsRoot, entry.name, 'SKILL.md');
    let content;
    try {
      content = await fs.readFile(skillPath, 'utf8');
    } catch {
      continue;
    }
    const description = content.match(/^description:\s*(.+)$/m)?.[1] || '';
    const title = content.match(/^#\s+(.+)$/m)?.[1] || entry.name;
    const [[existing]] = await pool.query('SELECT active_version FROM skills WHERE slug = ?', [entry.name]);
    if (!existing) {
      await pool.query(
        `INSERT INTO skills (slug, name, description, subject, material_types, status, active_version, file_path)
         VALUES (?, ?, ?, ?, ?, 'enabled', 1, ?)`,
        [entry.name, title, description, skillSubject(entry.name), JSON.stringify([]), path.relative(projectRoot, skillPath)]
      );
      await pool.query(
        `INSERT INTO skill_versions (skill_slug, version, content, status, change_note)
         VALUES (?, 1, ?, 'published', '从项目技能文件初始化')`,
        [entry.name, content]
      );
    }
  }

  for (const prompt of aiDefaults.prompts || []) {
    const [[existing]] = await pool.query('SELECT active_version FROM prompt_templates WHERE slug = ?', [prompt.slug]);
    if (!existing) {
      await pool.query(
        `INSERT INTO prompt_templates (slug, name, task_type, description, status, active_version)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [prompt.slug, prompt.name, prompt.taskType, prompt.description, prompt.enabled ? 'enabled' : 'disabled']
      );
      const variables = [...prompt.content.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((match) => match[1]);
      await pool.query(
        `INSERT INTO prompt_versions (prompt_slug, version, content, status, variables)
         VALUES (?, 1, ?, 'published', ?)`,
        [prompt.slug, prompt.content, JSON.stringify([...new Set(variables)])]
      );
    }
  }

  for (const slug of ['parent-report', 'leo-explanation']) {
    const prompt = (aiDefaults.prompts || []).find((item) => item.slug === slug);
    if (!prompt) continue;
    const [[active]] = await pool.query(
      `SELECT p.active_version, pv.content
       FROM prompt_templates p
       JOIN prompt_versions pv ON pv.prompt_slug = p.slug AND pv.version = p.active_version
       WHERE p.slug = ?`,
      [slug]
    );
    if (!active || Number(active.active_version) !== 1 || active.content === prompt.content) continue;
    const variables = [...prompt.content.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((match) => match[1]);
    await pool.query(
      `INSERT INTO prompt_versions
        (prompt_slug, version, content, status, variables, test_note)
       VALUES (?, 2, ?, 'published', ?, '补充稳定 JSON 输出结构')
       ON DUPLICATE KEY UPDATE content = VALUES(content), variables = VALUES(variables)`,
      [slug, prompt.content, JSON.stringify([...new Set(variables)])]
    );
    await pool.query(
      `UPDATE prompt_versions
       SET status = CASE WHEN version = 2 THEN 'published' ELSE 'archived' END
       WHERE prompt_slug = ? AND version IN (1, 2)`,
      [slug]
    );
    await pool.query('UPDATE prompt_templates SET active_version = 2 WHERE slug = ?', [slug]);
  }

  for (const model of aiDefaults.models || []) {
    await pool.query(
      `INSERT INTO model_configs
        (model_key, name, provider, model_name, purpose, key_ref, temperature, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name), purpose = VALUES(purpose), key_ref = VALUES(key_ref)`,
      [
        model.key,
        model.name,
        model.provider,
        model.model,
        model.purpose,
        model.keyRef,
        model.temperature ?? 0.2,
        model.enabled ? 1 : 0
      ]
    );
  }

  for (const route of aiDefaults.routes || []) {
    await pool.query(
      `INSERT INTO task_routes
        (route_key, task_type, subject, material_type, skill_slug, prompt_slug, model_key, fallback_model_key, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        task_type = VALUES(task_type), subject = VALUES(subject), material_type = VALUES(material_type),
        skill_slug = VALUES(skill_slug), prompt_slug = VALUES(prompt_slug), model_key = VALUES(model_key),
        fallback_model_key = VALUES(fallback_model_key)`,
      [
        route.key,
        route.taskType,
        route.subject,
        route.materialType,
        route.skillSlug,
        route.promptSlug,
        route.modelKey,
        route.fallbackModelKey || '',
        route.enabled ? 1 : 0
      ]
    );
  }

  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES ('data_source_policy', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [JSON.stringify({
      dynamicData: 'mysql',
      originalFiles: 'filesystem',
      staticBootstrap: 'json',
      updatedAt: '2026-06-07'
    })]
  );

  await pool.query(
    `UPDATE materials
     SET status = CASE
       WHEN analysis_summary IS NOT NULL AND analysis_summary <> '' THEN 'confirmed'
       ELSE 'pending_review'
     END,
     analysis_status = CASE
       WHEN analysis_summary IS NOT NULL AND analysis_summary <> '' THEN 'completed'
       ELSE 'not_started'
     END
     WHERE status = 'pending_review' OR analysis_status = 'not_started'`
  );

  const [legacyMaterials] = await pool.query(
    `SELECT m.id, m.raw_files
     FROM materials m
     LEFT JOIN material_pages mp ON mp.material_id = m.id
     GROUP BY m.id, m.raw_files
     HAVING COUNT(mp.id) = 0`
  );
  for (const material of legacyMaterials) {
    let rawFiles = [];
    try {
      rawFiles = typeof material.raw_files === 'string'
        ? JSON.parse(material.raw_files)
        : material.raw_files || [];
    } catch {
      rawFiles = [];
    }
    const pageFiles = rawFiles.filter((file) => /\.(png|jpe?g|webp|pdf)$/i.test(file.source || ''));
    for (const [index, file] of pageFiles.entries()) {
      await pool.query(
        `INSERT INTO material_pages
          (material_id, page_number, source, file_type, clarity_score, review_required)
         VALUES (?, ?, ?, ?, 100, 0)
         ON DUPLICATE KEY UPDATE source = VALUES(source), file_type = VALUES(file_type)`,
        [
          material.id,
          index + 1,
          file.source,
          /\.pdf$/i.test(file.source) ? 'application/pdf' : 'image'
        ]
      );
    }
  }

  await pool.query(
    `UPDATE knowledge_points
     SET mastery_score = COALESCE((
       SELECT qr.score FROM quiz_results qr
       WHERE qr.point_id = knowledge_points.id
       ORDER BY qr.completed_at DESC LIMIT 1
     ), mastery_score),
     next_review_at = COALESCE(next_review_at, DATE_ADD(NOW(), INTERVAL 3 DAY))`
  );

  const [points] = await pool.query('SELECT id, subject, priority, title, reason, goal, status, next_review_at FROM knowledge_points');
  for (const point of points) {
    const taskId = `review-${point.id}`;
    await pool.query(
      `INSERT INTO study_tasks
        (id, subject, point_id, title, reason, task_type, status, priority, estimated_minutes, mastery_goal, due_at)
       VALUES (?, ?, ?, ?, ?, 'review', 'pending', ?, 10, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), reason = VALUES(reason), priority = VALUES(priority)`,
      [
        taskId,
        point.subject,
        point.id,
        `复习：${point.title}`,
        point.reason,
        point.priority,
        point.goal,
        point.next_review_at || new Date(Date.now() + 3 * 86400000)
      ]
    );
  }

  const [legacyQuestionGroups] = await pool.query(
    `SELECT qq.point_id, qq.round, COUNT(*) question_count, kp.title, kp.goal
     FROM quiz_questions qq
     JOIN knowledge_points kp ON kp.id = qq.point_id
     LEFT JOIN training_plans tp ON tp.point_id = qq.point_id AND tp.round = qq.round
     WHERE tp.id IS NULL
     GROUP BY qq.point_id, qq.round, kp.title, kp.goal`
  );
  for (const group of legacyQuestionGroups) {
    const planId = `plan-${group.point_id}-${group.round}`;
    await pool.query(
      `INSERT INTO training_plans
        (id, point_id, round, title, goal, status, estimated_minutes, question_count,
         coverage, generation_source, quality_score, quality_issues)
       VALUES (?, ?, ?, ?, ?, 'draft', 10, ?, '[]', 'phase1_migration', 0, ?)
       ON DUPLICATE KEY UPDATE question_count = VALUES(question_count)`,
      [
        planId,
        group.point_id,
        group.round,
        `${group.title} - 第${group.round}轮`,
        group.goal,
        group.question_count,
        JSON.stringify([
          {
            code: 'phase1_migration_review',
            message: '该计划来自一阶段题库，需完成去重、选项和答案质量检查后再发布。'
          }
        ])
      ]
    );
  }
  await pool.query(
    `UPDATE quiz_questions
     SET source_basis = COALESCE(NULLIF(source_basis, ''), '一阶段题库迁移，需家长复核'),
         quality_status = CASE WHEN generation_id IS NULL THEN 'needs_review' ELSE quality_status END
     WHERE status = 'draft'`
  );
}

export async function initializeDatabase(dbConfig) {
  // 1. Ensure Database exists
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port || 3306,
    user: dbConfig.user,
    password: dbConfig.password,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  await connection.end();

  // 2. Connect to the database
  const pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port || 3306,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // 3. Create tables
  console.log('[MySQL] Creating tables if not exist...');
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge_points (
      id VARCHAR(50) PRIMARY KEY,
      subject VARCHAR(50) NOT NULL,
      priority VARCHAR(10) NOT NULL,
      title VARCHAR(255) NOT NULL,
      reason TEXT NOT NULL,
      goal TEXT NOT NULL,
      checkpoints TEXT NOT NULL,
      practice_files TEXT NOT NULL,
      evidence_material_ids TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id VARCHAR(100) PRIMARY KEY,
      point_id VARCHAR(50) NOT NULL,
      round INT NOT NULL,
      type VARCHAR(20) NOT NULL,
      prompt TEXT NOT NULL,
      options TEXT,
      answers TEXT NOT NULL,
      explanation TEXT NOT NULL,
      tag VARCHAR(100) NOT NULL,
      question_index INT NOT NULL,
      FOREIGN KEY (point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      subject VARCHAR(50) NOT NULL,
      point_id VARCHAR(50) NOT NULL,
      point_title VARCHAR(255) NOT NULL,
      round INT NOT NULL,
      score INT NOT NULL,
      wrong_tags TEXT NOT NULL,
      answers TEXT NOT NULL,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id VARCHAR(100) PRIMARY KEY,
      subject VARCHAR(50) NOT NULL,
      date VARCHAR(50) NOT NULL,
      type VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      priority VARCHAR(10) NOT NULL,
      score INT DEFAULT NULL,
      summary TEXT NOT NULL,
      raw_files TEXT NOT NULL,
      analysis_file VARCHAR(255),
      analysis_summary TEXT,
      analysis_strengths TEXT NOT NULL,
      analysis_needs_improvement TEXT NOT NULL,
      learning_links TEXT NOT NULL
    )
  `);

  await createPhase2Tables(pool);

  // 4. Seed users if empty
  const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
  if (userCount[0].count === 0) {
    await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', ['leo', 'leo2026']);
    console.log('[MySQL] Initialized default user (leo / leo2026)');
  }

  // 5. Seed knowledge points if empty
  const [kpCount] = await pool.query('SELECT COUNT(*) as count FROM knowledge_points');
  if (kpCount[0].count === 0) {
    console.log('[MySQL] Seeding knowledge points from content-index.json...');
    const indexPath = path.resolve(__dirname, '../../config/content-index.json');
    const indexData = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    
    for (const plan of indexData.knowledgePlans || []) {
      await pool.query(
        `INSERT INTO knowledge_points (id, subject, priority, title, reason, goal, checkpoints, practice_files, evidence_material_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id,
          plan.subject,
          plan.priority,
          plan.title,
          plan.reason,
          plan.goal,
          JSON.stringify(plan.checkpoints || []),
          JSON.stringify(plan.practiceFiles || []),
          JSON.stringify(plan.evidenceMaterialIds || [])
        ]
      );
    }
    console.log(`[MySQL] Seeded ${indexData.knowledgePlans.length} knowledge points.`);
  }

  // 5.5 Seed materials if empty
  const [matCount] = await pool.query('SELECT COUNT(*) as count FROM materials');
  if (matCount[0].count === 0) {
    console.log('[MySQL] Seeding materials from content-index.json...');
    const indexPath = path.resolve(__dirname, '../../config/content-index.json');
    const indexData = JSON.parse(await fs.readFile(indexPath, 'utf8'));

    for (const mat of indexData.materialGroups || []) {
      const analysis = mat.analysis || {
        file: '',
        summary: '',
        strengths: [],
        needsImprovement: []
      };
      await pool.query(
        `INSERT INTO materials (id, subject, date, type, title, priority, score, summary, raw_files, analysis_file, analysis_summary, analysis_strengths, analysis_needs_improvement, learning_links)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mat.id,
          mat.subject,
          mat.date || '2026-05-23',
          mat.type || '本周测试',
          mat.title,
          mat.priority || 'P0',
          mat.score !== undefined ? mat.score : null,
          mat.summary || '',
          JSON.stringify(mat.rawFiles || []),
          analysis.file || '',
          analysis.summary || '',
          JSON.stringify(analysis.strengths || []),
          JSON.stringify(analysis.needsImprovement || []),
          JSON.stringify(mat.learningLinks || [])
        ]
      );
    }
    console.log(`[MySQL] Seeded ${indexData.materialGroups.length} materials.`);
  }

  // 6. Seed quiz questions if empty
  const [qCount] = await pool.query('SELECT COUNT(*) as count FROM quiz_questions');
  if (qCount[0].count === 0) {
    console.log('[MySQL] Generating and seeding quiz questions (this might take a few seconds)...');
    let totalQuestions = 0;
    
    const [kpRows] = await pool.query('SELECT id FROM knowledge_points');
    const kpIds = kpRows.map(row => row.id);

    for (const pointId of kpIds) {
      const builder = pointBuilders[pointId];
      if (!builder) {
        console.warn(`[MySQL Warning] No question builder found for point: ${pointId}`);
        continue;
      }

      // Generate for Round 1 and Round 2
      for (const round of [1, 2]) {
        const groups = builder(round, []); // No focus tags during seeding
        
        for (const type of ["choice", "fill", "judge"]) {
          const questions = groups[type] || [];
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const qId = `${pointId}-${round}-${type}-${i + 1}`;
            
            await pool.query(
              `INSERT INTO quiz_questions (id, point_id, round, type, prompt, options, answers, explanation, tag, question_index)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                qId,
                pointId,
                round,
                type,
                q.prompt,
                q.options ? JSON.stringify(q.options) : null,
                JSON.stringify(q.answers || [q.answer]),
                q.explanation,
                q.tag,
                i + 1
              ]
            );
            totalQuestions++;
          }
        }
      }
    }
    console.log(`[MySQL] Seeded ${totalQuestions} questions into quiz_questions table.`);
  }

  await seedPhase2Data(pool);

  console.log('[MySQL] Database tables checked and seed data complete.');
  return pool;
}

// Support executing directly from command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configPath = path.resolve(__dirname, '../../config/auth.json');
  fs.readFile(configPath, 'utf8')
    .then(data => JSON.parse(data))
    .then(async authConfig => {
      if (authConfig && authConfig.mysql) {
        const pool = await initializeDatabase(authConfig.mysql);
        console.log('[MySQL] Seeding test run completed successfully.');
        await pool.end();
      } else {
        console.error('[MySQL] No mysql configuration found in auth.json');
      }
    })
    .catch(err => {
      console.error('[MySQL] Seeding test run failed:', err);
    });
}
