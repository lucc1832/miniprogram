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
    const { calcEventDays } = require('../../../utils/date.js');
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
