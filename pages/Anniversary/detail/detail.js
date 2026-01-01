const app = getApp();
const { getEventEmotion } = require('../../../utils/emotion.js');

Page({
  data: {
    event: null,
    days: 0,
    label: '',
    emotion: '',
    id: '',
    isEditingTitle: false,
    isEditingNote: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadEvent(options.id);
    }
  },

  onShow() {
    // onShow refresh is good, but we handle updates locally too.
    // We only reload if we suspect external changes, but detail page is the editor now.
    // So we can keep it simple or just reload to be safe.
    if (this.data.id) {
      this.loadEvent(this.data.id);
    }
  },

  loadEvent(id) {
    const events = wx.getStorageSync('anniversary_events_v2') || [];
    const event = events.find(e => e.id === id);
    if (!event) return;

    this.renderEvent(event);
  },

  renderEvent(event) {
    const { calcEventDays } = require('../../../utils/date.js');
    const calc = calcEventDays(event);
    
    // 优化 label 逻辑
    let label = calc.label;
    if (event.type === 'anniversary') {
        if (event.tag === 'us') label = '已相爱';
        else if (event.tag === 'me') label = '已坚持';
        else if (event.tag === 'family') label = '已陪伴';
        else if (event.tag === 'future') label = '已过去';
        else label = '已过去';
    } else {
        label = calc.days === 0 ? '就是' : '还有';
    }

    this.setData({ 
      days: calc.days, 
      label: label, 
      event, 
      emotion: getEventEmotion(event, calc.days) 
    });
  },

  updateEvent(updates) {
    const { event } = this.data;
    const newEvent = { ...event, ...updates };
    
    // 1. Update local render immediately
    this.renderEvent(newEvent);

    // 2. Async update storage
    wx.getStorage({
        key: 'anniversary_events_v2',
        success: (res) => {
            const events = res.data || [];
            const idx = events.findIndex(e => e.id === event.id);
            if (idx > -1) {
                events[idx] = newEvent;
                wx.setStorage({
                    key: 'anniversary_events_v2',
                    data: events
                });
            }
        }
    });
  },

  // Title Edit Logic
  startEditTitle() {
    this.setData({ isEditingTitle: true });
  },
  
  saveTitle(e) {
    const title = e.detail.value.trim();
    if (title) {
        this.updateEvent({ title });
    }
    this.setData({ isEditingTitle: false });
  },

  // Note Edit Logic
  startEditNote() {
    this.setData({ isEditingNote: true });
  },

  saveNote(e) {
    const note = e.detail.value.trim();
    this.updateEvent({ note });
    this.setData({ isEditingNote: false });
  },

  // Date Edit Logic
  bindDateChange(e) {
    const date = e.detail.value;
    this.updateEvent({ date });
  },

  toggleRemind(e) {
    const val = e.detail.value;
    this.updateEvent({ remind: { ...this.data.event.remind, enable: val } });
    
    if (val) {
      wx.showToast({ title: '已开启提醒', icon: 'none' });
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
          wx.getStorage({
            key: 'anniversary_events_v2',
            success: (res) => {
              const events = res.data || [];
              const newEvents = events.filter(e => e.id !== this.data.id);
              wx.setStorage({
                key: 'anniversary_events_v2',
                data: newEvents,
                success: () => {
                   wx.navigateBack();
                }
              });
            }
          });
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
