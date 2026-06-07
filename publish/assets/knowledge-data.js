(function () {
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
    ["他很生气。", "他皱紧眉头，猛地把书合上，脸涨得通红。", "神态和动作", "用神态和动作表现生气"],
    ["我很感动。", "看到那把一直向我倾斜的雨伞，我的鼻子一酸。", "细节和感受", "用雨伞倾斜这一细节表达感动"],
    ["小狗很兴奋。", "小狗摇着尾巴绕着我转圈，前爪不停地往我腿上扑。", "动作描写", "连续动作让画面更鲜活"],
    ["操场很热闹。", "加油声、哨声和脚步声混在一起，跑道边挤满了挥手的同学。", "环境描写", "从声音和人群写热闹"],
    ["老师很耐心。", "老师俯下身，指着算式一步一步问我：“这里为什么用减法？”", "动作和语言", "具体写出耐心指导的过程"],
    ["我很害怕。", "门外一响，我立刻屏住呼吸，背紧紧贴住墙。", "动作描写", "动作表现害怕"],
    ["爸爸很惊讶。", "爸爸睁大眼睛，愣了两秒，随后又看了一遍成绩单。", "神态和动作", "神态变化表现惊讶"],
    ["风很大。", "树枝被吹得左右摇晃，路边的塑料袋一下子卷上了半空。", "环境描写", "用物体变化表现风大"],
    ["她写字很认真。", "她一笔一画地写着，每写完一行都停下来检查。", "动作描写", "写出了认真完成和检查的过程"],
    ["我很着急。", "我不停地看钟，脚尖在地上轻轻点着。", "动作描写", "用连续小动作表现着急"],
    ["饭菜很香。", "锅盖一掀开，热气裹着香味扑过来，我忍不住咽了咽口水。", "感官描写", "调动嗅觉和动作写香味"],
    ["他很失望。", "他盯着落空的球门，肩膀慢慢垂了下来。", "神态和动作", "用姿态变化表现失望"],
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
    ["甲数是3/5，乙数是1/4。问两数相差多少。", "相差数量", "用较大数减较小数", "比较减法"],
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

  function rotateOptions(options, seed) {
    const unique = [...new Set(options)];
    const numericLike = unique.some((value) => /^-?\d+(\/\d+)?$/.test(String(value)));
    const fallbacks = numericLike ? ["0", "1", "1/2", "2/3"] : ["以上都不对", "无法判断"];
    for (const fallback of fallbacks) {
      if (unique.length >= 3) break;
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

  function judge(prompt, answer, explanation, tag) {
    return { type: "judge", prompt, answer, explanation, tag };
  }

  function buildDe(round, focusTags) {
    const count = round === 1 ? 15 : 10;
    return {
      choice: pick(deItems, count, round, focusTags, 0).map((item, index) =>
        choice(`“${item.text}”横线处应该填哪个字？`, rotateOptions(["的", "地", "得"], index + round), item.answer, `${item.tag}。正确写法是“${item.text.replace("__", item.answer)}”。`, item.tag),
      ),
      fill: pick(deItems, count, round, focusTags, 5).map((item) =>
        fill(`请在横线上填写“的、地、得”：${item.text}`, item.answer, `${item.tag}。`, item.tag),
      ),
      judge: pick(deItems, count, round, focusTags, 10).map((item, index) => {
        const shown = index % 2 === 0 ? item.answer : ({ 的: "地", 地: "得", 得: "的" })[item.answer];
        const sentence = item.text.replace("__", shown);
        return judge(`判断下面的写法是否正确：${sentence}`, shown === item.answer, `正确写法：${item.text.replace("__", item.answer)}。${item.tag}。`, item.tag);
      }),
    };
  }

  function buildTypos(round, focusTags) {
    const count = round === 1 ? 15 : 10;
    return {
      choice: pick(typoItems, count, round, focusTags, 0).map((item, index) => {
        const options = rotateOptions([item.correct, item.wrong, item.correct === "已" ? "己" : "在"], index + round);
        return choice(`${item.text.replace("__", "（ ）")}`, options, item.correct, `正确写法是“${item.text.replace("__", item.correct)}”。`, item.tag);
      }),
      fill: pick(typoItems, count, round, focusTags, 5).map((item) =>
        fill(`填写正确的字：${item.text}`, item.correct, `应写“${item.correct}”，完整句子是“${item.text.replace("__", item.correct)}”。`, item.tag),
      ),
      judge: pick(typoItems, count, round, focusTags, 10).map((item, index) => {
        const shown = index % 2 === 0 ? item.correct : item.wrong;
        return judge(`判断句子中的字是否使用正确：${item.text.replace("__", shown)}`, shown === item.correct, `正确写法：${item.text.replace("__", item.correct)}。`, item.tag);
      }),
    };
  }

  function buildPunctuation(round, focusTags) {
    const count = round === 1 ? 15 : 10;
    return {
      choice: pick(dialogueItems, count, round, focusTags, 0).map((item, index) => {
        const wrongA = `${item.speaker}${item.verb}“${item.quote}${item.end}”`;
        const wrongB = `${item.speaker}${item.verb}：“${item.quote}”${item.end}`;
        return choice("选择标点完全正确的一项。", rotateOptions([item.correct, wrongA, wrongB], index + round), item.correct, `人物说话前用冒号，引号内保留句末标点：${item.correct}`, item.tag);
      }),
      fill: pick(dialogueItems, count, round, focusTags, 5).map((item) =>
        fill(`${item.speaker}${item.verb}__${item.quote}__\n请依次填写两处标点组合。`, [`：“${item.end}”`, `:“${item.end}”`], `完整句子：${item.correct}`, item.tag),
      ),
      judge: pick(dialogueItems, count, round, focusTags, 10).map((item, index) => {
        const correct = index % 2 === 0;
        const shown = correct ? item.correct : `${item.speaker}${item.verb}“${item.quote}”${item.end}`;
        return judge(`判断标点是否正确：${shown}`, correct, `正确格式：${item.correct}`, item.tag);
      }),
    };
  }

  function buildDetails(round, focusTags) {
    const count = round === 1 ? 15 : 10;
    return {
      choice: pick(detailItems, count, round, focusTags, 0).map((item, index) =>
        choice("哪一句更有画面感、更适合作为作文细节描写？", rotateOptions([item.detail, item.general, "这件事真的非常特别。"], index + round), item.detail, `${item.explanation}。`, item.tag),
      ),
      fill: pick(detailItems, count, round, focusTags, 5).map((item) =>
        fill(`“${item.detail}”主要运用了哪一类描写？`, [item.type, item.type.replace("描写", "")], `${item.explanation}，主要是${item.type}。`, item.tag),
      ),
      judge: pick(detailItems, count, round, focusTags, 10).map((item, index) => {
        const detailed = index % 2 === 0;
        const shown = detailed ? item.detail : item.general;
        return judge(`“${shown}”已经把感受写成了具体可见的细节。`, detailed, detailed ? item.explanation : `“${item.general}”仍然比较概括，可以改成：“${item.detail}”`, item.tag);
      }),
    };
  }

  function buildReading(round, focusTags) {
    const count = round === 1 ? 15 : 10;
    return {
      choice: pick(readingItems, count, round, focusTags, 0).map((item, index) =>
        choice(`阅读短文：${item.passage}\n问题：${item.question}\n哪一句最能支持答案？`, rotateOptions([item.evidence, item.distractor, "短文中没有相关内容。"], index + round), item.evidence, `先抓题干关键词，再回原文找直接支撑句。证据是：“${item.evidence}”`, item.tag),
      ),
      fill: pick(readingItems, count, round, focusTags, 5).map((item) =>
        fill(`这是一道${item.points}分的阅读简答题：“${item.question}”\n至少建议写几点？`, [String(item.expectedParts), `${item.expectedParts}点`], `${item.points}分题不能只写一个模糊词语，建议至少写${item.expectedParts}点，并引用原文证据。`, "分值与分点"),
      ),
      judge: pick(readingItems, count, round, focusTags, 10).map((item, index) => {
        const valid = index % 2 === 0;
        const evidence = valid ? item.evidence : item.distractor;
        return judge(`针对问题“${item.question}”，句子“${evidence}”可以作为直接证据。`, valid, valid ? "这句话直接回答了题目中的关键词。" : `这句话不能支撑答案，应找：“${item.evidence}”`, item.tag);
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

  const subjects = {
    chinese: {
      name: "语文",
      path: "./语文/index.html",
      points: [
        {
          id: "de-di-de",
          title: "作文中的“的、地、得”",
          priority: "P0",
          reason: "这个问题在多篇作文中反复出现，而且改进后能直接减少基础表达失分。",
          evidence: "原文出现“懒的动了、飞快的跑、做的一丝不苟、面带笑容的给”等。",
          goal: "能根据后面接名词、动作还是程度，主动检查并改对80%以上。",
          builder: buildDe,
        },
        {
          id: "common-typos",
          title: "作文常用易错字",
          priority: "P0",
          reason: "多数是五年级已经学过的常用字，属于写完后可以通过复查拿回的分数。",
          evidence: "多篇作文出现“小数/小树、以经/已经、开使/开始、一变/一遍”等。",
          goal: "建立个人易错字清单，写完作文能主动复查同音字和形近字。",
          builder: buildTypos,
        },
        {
          id: "dialogue-punctuation",
          title: "人物对话与句末标点",
          priority: "P0",
          reason: "对话中的冒号、引号、问号和句号位置不稳，影响句子清楚度和卷面规范。",
          evidence: "原文出现“你干什么了”缺问号、人物说话前缺冒号、引号位置错误等。",
          goal: "稳定掌握“某某说：‘……。’”“某某问：‘……？’”的格式。",
          builder: buildPunctuation,
        },
        {
          id: "detail-writing",
          title: "把感受写成具体细节",
          priority: "P1",
          reason: "Leo已经能把事情写完整，下一步提分关键是增加动作、语言、神态和环境细节。",
          evidence: "作文中有“很开心、很紧张”等概括表达，但可见、可听的细节还不够稳定。",
          goal: "能把一个概括感受改写成至少两个可观察到的细节。",
          builder: buildDetails,
        },
        {
          id: "reading-three-questions",
          title: "阅读理解三问法",
          priority: "P0",
          reason: "阅读简答题扣分较多，容易凭印象回答，缺少找证据和按分值分点的固定流程。",
          evidence: "第三单元试卷显示阅读信息定位和答案完整度是当前最主要失分点。",
          goal: "每题先说清问什么、证据在哪、几分题写几点，再组织答案。",
          builder: buildReading,
        },
      ],
    },
    math: {
      name: "数学",
      path: "./数学/index.html",
      points: [
        {
          id: "unit-one",
          title: "分数应用题中的单位1",
          priority: "P0",
          reason: "单位1判断不稳会让后面的数量关系全部偏离，是本次数学试卷最优先的问题。",
          evidence: "花圃题中把实际面积5/6公顷与2/5、1/3占比直接相减。",
          goal: "列式前能先写出单位1是谁，并区分占比和实际数量。",
          builder: buildUnitOne,
        },
        {
          id: "question-target",
          title: "看懂最后一句到底问什么",
          priority: "P0",
          reason: "“剩下、共用、占几分之几、比谁多”混淆，会导致运算方法选择错误。",
          evidence: "蔬菜面积、布料、修路等题都出现目标量判断不够稳的问题。",
          goal: "先把问题翻译成“要求的是比例、数量、差还是剩余”，再列式。",
          builder: buildTargets,
        },
        {
          id: "fraction-calculation",
          title: "异分母分数加减与检查",
          priority: "P1",
          reason: "Leo基本会通分，但过程有改动和扣分，说明检查与约分还没有形成习惯。",
          evidence: "试卷中部分异分母加减存在通分、计算或结果检查问题。",
          goal: "通分准确、计算正确、结果化成最简分数，并能估计答案是否合理。",
          builder: buildFractions,
        },
        {
          id: "statistics-ratio",
          title: "统计图中的总量与占比",
          priority: "P1",
          reason: "能读出单项数据，但把多个部分合成总量后再求占比的步骤还需巩固。",
          evidence: "统计图题需要先读数、求总量，再计算某部分占总量的几分之几。",
          goal: "形成“读数—求总—部分除以总量”的固定三步。",
          builder: buildStats,
        },
      ],
    },
    english: {
      name: "英文",
      path: "./英文/index.html",
      points: [],
    },
  };

  function findPoint(subjectKey, pointId) {
    const subject = subjects[subjectKey];
    return subject ? subject.points.find((point) => point.id === pointId) : null;
  }

  function buildQuiz(subjectKey, pointId, round, focusTags) {
    const point = findPoint(subjectKey, pointId);
    if (!point) return null;
    const groups = point.builder(round, focusTags || []);
    const questions = [];
    ["choice", "fill", "judge"].forEach((type) => {
      groups[type].forEach((question, index) => {
        questions.push({
          ...question,
          id: `${pointId}-${round}-${type}-${index + 1}`,
          index: index + 1,
        });
      });
    });
    return { point, questions };
  }

  window.LEO_KNOWLEDGE = {
    subjects,
    findPoint,
    buildQuiz,
  };
})();
