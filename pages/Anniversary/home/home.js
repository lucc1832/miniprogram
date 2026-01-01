const app = getApp();
const { getDailyEmotion, getEventEmotion } = require('../../../utils/emotion.js');
const { supportsLunar } = require('../../../utils/lunar.js');

Page({
  data: {
    dailyEmotion: '',
    mainEvent: null,
    subEvents: [],
    loading: true
  },

  onShow() {
    this.setData({
      dailyEmotion: getDailyEmotion()
    });
    this.loadData();
  },

  loadData() {
    const events = wx.getStorageSync('anniversary_events_v2') || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 计算逻辑
    const processed = events.map(e => {
      const calc = this.calcDays(e, today);
      return { 
        ...e, 
        ...calc,
        emotion: getEventEmotion(e, calc.days)
      };
    });

    // 排序逻辑
    // 1. 区分未来和过去？
    // 用户规则：
    // 1) 最近日期 (Abs diff small -> large)
    // 2) isImportant = true
    // 3) 其他

    // V1 简化：先计算绝对天数差，越小越重要
    processed.sort((a, b) => {
      // isImportant 优先
      if (a.isImportant !== b.isImportant) {
        return a.isImportant ? -1 : 1;
      }
      return a.days - b.days;
    });

    let mainEvent = null;
    let subEvents = [];

    if (processed.length > 0) {
      mainEvent = processed[0];
      subEvents = processed.slice(1, 4); // Next 2-3
    }

    this.setData({ mainEvent, subEvents, loading: false });
  },

  calcDays(event, today) {
    // 简单版：不处理重复，仅计算 diff
    // 实际应根据 type 处理
    // anniversary: today - date
    // countdown: date - today (if date < today ???)

    // 为了“倒数日”好用，假设用户输入的是目标日期（比如生日2024-11-11）
    // 如果今天已经 2025，则应该计算下一个周期？
    // V1 严格遵守：countdown = date - today. 
    // 如果 date < today 且是 countdown，显示“已过期 X 天” 或 自动切到下一年？
    // 用户说：countdown = 未发生。
    
    // 这里做一个简单的自动周期处理（增强体验）：
    // 如果是 countdown 且 date < today，尝试 +1 year 看看是不是 birthday 逻辑
    // 但为了严谨，先只做绝对值。

    let targetDate = new Date(event.date.replace(/-/g, '/'));
    targetDate.setHours(0,0,0,0);
    
    // 自动周期判断 (简单策略)
    if (event.type === 'countdown' && targetDate < today) {
        // 假设是每年的事件，自动加一年
        const nextYear = new Date(targetDate);
        nextYear.setFullYear(today.getFullYear());
        if (nextYear < today) {
            nextYear.setFullYear(today.getFullYear() + 1);
        }
        targetDate = nextYear;
    }

    const diff = targetDate - today;
    const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
    
    // 确定展示状态
    let statusLabel = '';
    if (event.type === 'anniversary') {
        // 纪念日：计算过去多久
        // 如果 targetDate 在未来？那就变成 0 或者 负数？
        // 假设纪念日都是过去的。
        const pastDiff = today - new Date(event.date.replace(/-/g, '/'));
        const pastDays = Math.floor(pastDiff / (1000 * 60 * 60 * 24));
        return { days: Math.abs(pastDays), label: '已经' };
    } else {
        return { days: days, label: diff >= 0 ? '还有' : '已过' };
    }
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/Anniversary/create/create' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/Anniversary/detail/detail?id=${id}` });
  }
});
