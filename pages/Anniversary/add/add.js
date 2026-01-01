Page({
  data: {
    title: '',
    date: '',
    type: 'anniversary', // anniversary | countdown
    repeat: 'none', // none | year
    note: '',
    isTop: false,
    types: [
      { name: '纪念日', value: 'anniversary', desc: '累计天数 (如: 在一起)' },
      { name: '倒数日', value: 'countdown', desc: '剩余天数 (如: 生日/考试)' }
    ],
    repeats: [
      { name: '不重复', value: 'none' },
      { name: '每年', value: 'year' },
      { name: '每月', value: 'month' }
    ]
  },

  onLoad(options) {
    const today = new Date();
    const dateStr = this.formatDate(today);
    
    // 如果是编辑模式
    if (options.id) {
      const events = wx.getStorageSync('anniversary_events') || [];
      const event = events.find(e => e.id === options.id);
      if (event) {
        this.setData({ ...event, id: options.id });
        return;
      }
    }

    this.setData({ date: dateStr });
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },
  
  onTypeChange(e) { 
    const type = e.currentTarget.dataset.value;
    this.setData({ type }); 
  },
  
  onRepeatChange(e) { 
    this.setData({ repeat: this.data.repeats[e.detail.value].value }); 
  },

  onTopChange(e) { this.setData({ isTop: e.detail.value }); },

  addToCalendar() {
    const { title, date, note } = this.data;
    if (!title || !date) return wx.showToast({ title: '请先填写信息', icon: 'none' });

    // 计算开始时间 (秒)
    const startTime = new Date(date.replace(/-/g, '/')).getTime() / 1000;
    
    wx.addPhoneCalendar({
      title: title,
      startTime: startTime,
      allDay: true,
      description: note || '来自纪念日小程序的提醒',
      alarm: true, // 提醒
      alarmOffset: 0, // 准时提醒
      success: (res) => {
        wx.showToast({ title: '已添加到日历', icon: 'success' });
      },
      fail: (err) => {
        console.error(err);
        // wx.showToast({ title: '添加失败', icon: 'none' });
        // 模拟器可能不支持，真机通常支持
        if (err.errMsg.indexOf('cancel') < 0) {
            wx.showModal({ title: '提示', content: '添加日历需要授权或真机支持' });
        }
      }
    });
  },

  save() {
    const { title, date, type, repeat, note, isTop, id } = this.data;
    if (!title) return wx.showToast({ title: '请输入标题', icon: 'none' });
    if (!date) return wx.showToast({ title: '请选择日期', icon: 'none' });

    const events = wx.getStorageSync('anniversary_events') || [];
    const newEvent = {
      id: id || Date.now().toString(),
      title,
      date,
      type,
      repeat,
      note,
      isTop,
      updatedAt: Date.now()
    };

    if (id) {
      const idx = events.findIndex(e => e.id === id);
      if (idx > -1) events[idx] = newEvent;
    } else {
      events.push(newEvent);
    }

    wx.setStorageSync('anniversary_events', events);
    wx.navigateBack();
  },

  deleteEvent() {
    if (!this.data.id) return;
    const that = this;
    wx.showModal({
      title: '提示',
      content: '确定要删除吗？',
      success(res) {
        if (res.confirm) {
          const events = wx.getStorageSync('anniversary_events') || [];
          const newEvents = events.filter(e => e.id !== that.data.id);
          wx.setStorageSync('anniversary_events', newEvents);
          wx.navigateBack();
        }
      }
    });
  }
});
