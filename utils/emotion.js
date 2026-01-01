const EMOTIONS = [
  "今天没有纪念日，但你依然值得被记住。",
  "每一个平淡的日子，都是未来的回忆。",
  "时间不会说话，但它会证明一切。",
  "无论过去如何，未来总是崭新的。",
  "即使世界匆忙，也要记得照顾好自己。",
  "有些事，因为相信才看见。",
  "保持热爱，奔赴山海。",
  "温柔是世间最强大的力量。",
  "记得给生活留一点缝隙，让阳光照进来。",
  "凡是过往，皆为序章。",
  "不管走了多远，别忘了为什么出发。",
  "生活明朗，万物可爱。",
  "与其追赶时间，不如享受此刻。",
  "愿你眼中总有光芒，活成你想要的模样。",
  "今天的你，比昨天更好了吗？",
  "不要忘记，你也是别人的风景。",
  "慢慢来，比较快。",
  "在这个快节奏的时代，慢下来也是一种能力。",
  "心存感激，所遇即温柔。",
  "愿你的每一天，都值得被记录。"
];

const getDailyEmotion = () => {
  const idx = Math.floor(Math.random() * EMOTIONS.length);
  return EMOTIONS[idx];
};

const getEventEmotion = (event, days) => {
  if (event.type === 'anniversary') {
    if (days % 365 === 0) return `第 ${days / 365} 周年，岁月静好。`;
    if (days % 100 === 0) return `第 ${days} 天，百日纪念。`;
    if (days === 1) return "开始的第一天，未来可期。";
    return "每一个日子都值得铭记。";
  } else {
    if (days === 0) return "就是今天，去拥抱它吧。";
    if (days === 1) return "明天就要到了，准备好了吗？";
    if (days <= 7) return "倒计时最后一周，加油。";
    if (days <= 30) return "还有不到一个月，期待在生长。";
    return "为了那一天的到来，现在的努力都有意义。";
  }
};

module.exports = {
  getDailyEmotion,
  getEventEmotion
};
