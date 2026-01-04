Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number
  },

  data: {
    todayStatus: 'empty', // 'empty' | 'planned' | 'completed'
    todayMenu: null,
    heatData: [] // For mini heatmap
  },

  lifetimes: {
    attached() {
      this.checkTodayStatus();
    }
  },

  pageLifetimes: {
    show() {
      this.checkTodayStatus();
    }
  },

  methods: {
    checkTodayStatus() {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const status = wx.getStorageSync('daily_status_' + todayStr) || 'empty';
      
      this.setData({ todayStatus: status });

      if (status === 'planned') {
        const menu = wx.getStorageSync('today_menu');
        if (menu) {
          this.setData({ todayMenu: menu });
        }
      } else if (status === 'completed') {
        // Load recent history for heatmap
        this.loadHeatData();
      }
    },

    loadHeatData() {
      // Simple mock for now or read from kitchen_orders
      // We can check last 7 days status
      const days = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const status = wx.getStorageSync('daily_status_' + dStr);
        days.push({
          date: d.getDate(),
          active: status === 'completed',
          isToday: i === 0
        });
      }
      this.setData({ heatData: days });
    },

    goToMenu() {
      this.triggerEvent('switchTab', { tabIndex: 1 });
    },

    completeCooking() {
      wx.showLoading({ title: '记录中...' });
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const menu = this.data.todayMenu;

      // 1. Update Status
      wx.setStorageSync('daily_status_' + todayStr, 'completed');

      // 2. Create Diary Entry (History)
      if (menu) {
        const order = {
          id: Date.now(),
          date: now.toLocaleString(),
          items: menu.items,
          status: '已完成'
        };
        let orders = wx.getStorageSync('kitchen_orders') || [];
        orders.unshift(order);
        wx.setStorageSync('kitchen_orders', orders);
      }

      // 3. Update UI
      this.setData({ todayStatus: 'completed' });
      this.loadHeatData();

      wx.hideLoading();
      wx.showToast({ title: '打卡成功', icon: 'success' });
    },

    goToDiary() {
      this.triggerEvent('switchTab', { tabIndex: 2 });
    }
  }
})