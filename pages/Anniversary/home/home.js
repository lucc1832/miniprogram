const app = getApp();
const emotionUtils = (() => {
  try {
    return require('../utils/emotion.js');
  } catch (err) {
    console.warn('emotion utils load failed, use fallback', err);
    return {
      getDailyEmotion: () => '把重要的日子认真收好。',
      getEventEmotion: () => '时间正在慢慢靠近。'
    };
  }
})();
const lunarUtils = (() => {
  try {
    return require('../utils/lunar.js');
  } catch (err) {
    console.warn('lunar utils load failed, use fallback', err);
    return { supportsLunar: () => false };
  }
})();
const dateUtils = (() => {
  try {
    return require('../utils/date.js');
  } catch (err) {
    console.warn('date utils load failed, use fallback', err);
    return {
      calcEventDays(event, today = new Date()) {
        const target = new Date(String(event.date).replace(/-/g, '/'));
        target.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const days = Math.ceil((target.getTime() - today.getTime()) / 86400000);
        return { days: Math.abs(days), label: days >= 0 ? '还有' : '已过' };
      }
    };
  }
})();
const { getDailyEmotion, getEventEmotion } = emotionUtils;
const { supportsLunar } = lunarUtils;
const { calcEventDays } = dateUtils;

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
    wx.getStorage({
      key: 'anniversary_events_v2',
      success: (res) => {
        const events = res.data || [];
        this.processEvents(events);
      },
      fail: () => {
        this.processEvents([]);
      }
    });
  },

  processEvents(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 计算逻辑
    const processed = events.map(e => {
      const calc = calcEventDays(e, today);
      return { 
        ...e, 
        ...calc,
        emotion: getEventEmotion(e, calc.days)
      };
    });

    // 排序逻辑
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

  goCreate() {
    wx.navigateTo({ url: '/pages/Anniversary/create/create' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/Anniversary/detail/detail?id=${id}` });
  }
});
