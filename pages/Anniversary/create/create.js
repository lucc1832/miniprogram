const app = getApp();

Page({
  data: {
    title: '',
    type: 'anniversary', // anniversary | countdown
    date: '',
    isLunar: false,
    tag: 'me',
    note: '',
    remind: {
      enable: true,
      times: ['0'] // 默认当天提醒
    },
    
    // UI Helpers
    types: [
      { label: '纪念日', value: 'anniversary', desc: '已发生' },
      { label: '倒数日', value: 'countdown', desc: '未发生' }
    ],
    tags: [
      { label: '自己', value: 'me' },
      { label: '我们', value: 'us' },
      { label: '家人', value: 'family' },
      { label: '未来', value: 'future' },
      { label: '其他', value: 'custom' }
    ]
  },

  onLoad() {
    const today = new Date();
    const dateStr = this.formatDate(today);
    this.setData({ date: dateStr });
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.detail.value });
  },

  onTypeChange(e) {
    this.setData({ type: e.currentTarget.dataset.value });
  },

  onLunarChange(e) {
    this.setData({ isLunar: e.detail.value });
  },

  onTagChange(e) {
    this.setData({ tag: e.currentTarget.dataset.value });
  },

  onRemindChange(e) {
    const enable = e.detail.value;
    this.setData({
      'remind.enable': enable
    });
  },

  save() {
    const { title, type, date, isLunar, tag, note, remind, isEdit, editId } = this.data;
    
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    if (!date) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    wx.getStorage({
      key: 'anniversary_events_v2',
      success: (res) => {
        const events = res.data || [];
        
        if (isEdit) {
          const idx = events.findIndex(e => e.id === editId);
          if (idx > -1) {
            events[idx] = {
              ...events[idx],
              title, type, date, isLunar, tag, note, remind
            };
            this.saveEvents(events, '已更新');
          }
        } else {
          const event = {
            id: Date.now().toString(),
            title,
            type,
            date,
            isLunar,
            tag,
            note,
            isImportant: false, // 默认不重要，详情页或首页可设
            remind,
            createdAt: Date.now()
          };
          events.push(event);
          this.saveEvents(events, '已创建');
        }
      },
      fail: () => {
         // Handle init case
         if (!isEdit) {
            const event = {
              id: Date.now().toString(),
              title,
              type,
              date,
              isLunar,
              tag,
              note,
              isImportant: false, 
              remind,
              createdAt: Date.now()
            };
            this.saveEvents([event], '已创建');
         }
      }
    });
  },

  saveEvents(events, msg) {
    wx.setStorage({
      key: 'anniversary_events_v2',
      data: events,
      success: () => {
        wx.showToast({ title: msg, icon: 'success' });
        // 如果开启提醒，且支持日历，尝试加入日历（简化实现，不阻塞）
        if (this.data.remind.enable) {
            // this.addToCalendar(event); // 暂时先不实现复杂日历更新逻辑
        }
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  },

  addToCalendar(event) {

    wx.navigateBack();
  },

  addToCalendar(event) {
    const startTime = new Date(event.date.replace(/-/g, '/')).getTime() / 1000;
    wx.addPhoneCalendar({
        title: event.title,
        startTime: startTime,
        allDay: true,
        description: event.note || '纪念日提醒',
        alarm: true,
        success: () => {},
        fail: () => {} // 静默失败
    });
  }
});
