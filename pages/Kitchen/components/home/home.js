Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number
  },

  data: {
    weekDays: [
      { week: '周一', date: '29', active: false },
      { week: '周二', date: '30', active: false },
      { week: '周三', date: '31', active: true },
      { week: '周四', date: '01', active: false },
      { week: '周五', date: '02', active: false },
      { week: '周六', date: '03', active: false },
      { week: '周日', date: '04', active: false }
    ],
    activeView: 'heat'
  },

  methods: {
    switchView(e) {
      this.setData({
        activeView: e.currentTarget.dataset.view
      });
    }
  }
})