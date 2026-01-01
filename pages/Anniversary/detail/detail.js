const app = getApp();
const { getEventEmotion } = require('../../../utils/emotion.js');

Page({
  data: {
    event: null,
    days: 0,
    label: '',
    emotion: '',
    id: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadEvent(options.id);
    }
  },

  loadEvent(id) {
    const events = wx.getStorageSync('anniversary_events_v2') || [];
    const event = events.find(e => e.id === id);
    if (!event) return;

    // 复用 Home 的计算逻辑
    // 实际项目中应抽取到 Service 层
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let targetDate = new Date(event.date.replace(/-/g, '/'));
    targetDate.setHours(0,0,0,0);
    
    if (event.type === 'countdown' && targetDate < today) {
        const nextYear = new Date(targetDate);
        nextYear.setFullYear(today.getFullYear());
        if (nextYear < today) {
            nextYear.setFullYear(today.getFullYear() + 1);
        }
        targetDate = nextYear;
    }

    const diff = targetDate - today;
    const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
    
    let label = '';
    if (event.type === 'anniversary') {
        const pastDiff = today - new Date(event.date.replace(/-/g, '/'));
        const pastDays = Math.floor(pastDiff / (1000 * 60 * 60 * 24));
        label = '已经';
        this.setData({ days: Math.abs(pastDays), label, event, emotion: getEventEmotion(event, Math.abs(pastDays)) });
    } else {
        label = diff >= 0 ? '还有' : '已过';
        this.setData({ days, label, event, emotion: getEventEmotion(event, days) });
    }
  },

  toggleRemind(e) {
    const val = e.detail.value;
    const { event } = this.data;
    if (!event) return;

    event.remind.enable = val;
    this.setData({ 'event.remind.enable': val });

    // Update storage
    const events = wx.getStorageSync('anniversary_events_v2') || [];
    const idx = events.findIndex(e => e.id === event.id);
    if (idx > -1) {
      events[idx] = event;
      wx.setStorageSync('anniversary_events_v2', events);
    }

    if (val) {
      wx.showToast({ title: '已开启提醒', icon: 'none' });
      // 这里可以再次调用添加到日历逻辑
    }
  },

  onShareAppMessage() {
    const { event, days, label } = this.data;
    return {
      title: `${event.title} ${label} ${days} 天`,
      path: `/pages/Anniversary/detail/detail?id=${event.id}`
    };
  },

  deleteEvent() {
    wx.showModal({
      title: '删除',
      content: '确定要忘记这个日子吗？',
      success: (res) => {
        if (res.confirm) {
          const events = wx.getStorageSync('anniversary_events_v2') || [];
          const newEvents = events.filter(e => e.id !== this.data.id);
          wx.setStorageSync('anniversary_events_v2', newEvents);
          wx.navigateBack();
        }
      }
    });
  },
  
  generateCard() {
    wx.showToast({ title: '生成卡片功能开发中', icon: 'none' });
    // TODO: Navigate to card page with data
    // wx.navigateTo({ url: `/pages/Anniversary/card/card?id=${this.data.id}` });
  }
});
