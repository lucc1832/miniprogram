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

const tagTextMap = {
  me: '自己',
  us: '我们',
  family: '家人',
  future: '未来',
  custom: '其他'
};

function formatShortDate(dateStr) {
  const parts = String(dateStr || '').split('-');
  if (parts.length < 3) return dateStr || '';
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function getEventTone(event, calc) {
  if (calc.days === 0) return 'today';
  if (event.isImportant) return 'important';
  return event.type === 'countdown' ? 'countdown' : 'memory';
}

Page({
  data: {
    dailyEmotion: '',
    mainEvent: null,
    subEvents: [],
    todayEvents: [],
    upcomingEvents: [],
    memoryEvents: [],
    stats: {
      totalCount: 0,
      countdownCount: 0,
      anniversaryCount: 0,
      todayCount: 0,
      importantCount: 0
    },
    activeFilter: 'all',
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
    this.rawEvents = Array.isArray(events) ? events : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const safeEvents = Array.isArray(events) ? events : [];

    // 计算逻辑
    const allProcessed = safeEvents.filter(e => e && e.date).map(e => {
      const calc = calcEventDays(e, today);
      return { 
        ...e, 
        ...calc,
        id: e.id || e._id || `${e.title}_${e.date}`,
        typeText: e.type === 'countdown' ? '倒数日' : '纪念日',
        tagText: tagTextMap[e.tag] || '其他',
        shortDate: formatShortDate(e.date),
        calendarText: e.isLunar && supportsLunar() ? '农历' : '公历',
        tone: getEventTone(e, calc),
        emotion: getEventEmotion(e, calc.days)
      };
    });
    const activeFilter = this.data.activeFilter || 'all';
    const processed = allProcessed.filter(item => {
      if (activeFilter === 'countdown') return item.type === 'countdown';
      if (activeFilter === 'today') return item.days === 0;
      if (activeFilter === 'important') return !!item.isImportant;
      return true;
    });

    const focusSorted = processed.slice().sort((a, b) => {
      if ((a.days === 0) !== (b.days === 0)) return a.days === 0 ? -1 : 1;
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      if (a.type !== b.type) return a.type === 'countdown' ? -1 : 1;
      return a.days - b.days;
    });

    let mainEvent = null;
    let subEvents = [];

    if (focusSorted.length > 0) {
      mainEvent = focusSorted[0];
      subEvents = focusSorted.filter(item => item.id !== mainEvent.id).slice(0, 4);
    }

    const todayEvents = processed
      .filter(item => item.days === 0)
      .sort((a, b) => Number(!!b.isImportant) - Number(!!a.isImportant))
      .slice(0, 4);

    const upcomingEvents = processed
      .filter(item => item.type === 'countdown' && item.days > 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);

    const memoryEvents = processed
      .filter(item => item.type !== 'countdown' && item.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 6);

    const stats = {
      totalCount: allProcessed.length,
      countdownCount: allProcessed.filter(item => item.type === 'countdown').length,
      anniversaryCount: allProcessed.filter(item => item.type !== 'countdown').length,
      todayCount: allProcessed.filter(item => item.days === 0).length,
      importantCount: allProcessed.filter(item => item.isImportant).length
    };

    this.setData({
      mainEvent,
      subEvents,
      todayEvents,
      upcomingEvents,
      memoryEvents,
      stats,
      loading: false
    });
  },

  setFilter(e) {
    const activeFilter = e.currentTarget.dataset.filter || 'all';
    this.setData({ activeFilter }, () => this.processEvents(this.rawEvents || []));
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/Anniversary/create/create' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/Anniversary/detail/detail?id=${id}` });
  }
});
