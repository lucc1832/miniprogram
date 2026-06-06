Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number,
    isActive: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        if (newVal) {
          this.checkTodayStatus();
        }
      }
    }
  },

  data: {
    todayStatus: 'empty', // 'empty' | 'planned' | 'completed'
    todayMenu: null,
    heatData: [], // For mini heatmap logic if needed, or full heatmap
    
    // UI Restoration Data
    weekDays: [],
    activeView: 'cart', // Default to cart to show actions
    currentYear: new Date().getFullYear(),
    heatmapGrid: [] // For the big heatmap
  },

  lifetimes: {
    attached() {
      this.initDateData();
      this.checkTodayStatus();
    }
  },

  pageLifetimes: {
    show() {
      this.checkTodayStatus();
    }
  },

  methods: {
    formatDateKey(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    normalizeDateKey(value) {
      if (!value) return '';
      const str = String(value).trim();
      const datePart = str.split(' ')[0].replace(/\//g, '-');
      const parts = datePart.split('-');

      if (parts.length >= 3) {
        const y = parts[0];
        const m = String(parseInt(parts[1], 10)).padStart(2, '0');
        const d = String(parseInt(parts[2], 10)).padStart(2, '0');
        if (y && m !== 'NaN' && d !== 'NaN') return `${y}-${m}-${d}`;
      }

      return datePart;
    },

    initDateData() {
      const now = new Date();
      const days = [];
      // Generate current week (Mon-Sun) or just surrounding days
      // Let's do a simple 7-day strip ending today or centered?
      // Old UI had "Mon 29", "Tue 30"...
      // Let's generate a static week for now or dynamic
      for (let i = -3; i <= 3; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        days.push({
          week: weeks[d.getDay()],
          date: d.getDate().toString().padStart(2, '0'),
          active: i === 0
        });
      }
      this.setData({ weekDays: days });

      this.loadHeatmapData();
    },

    loadHeatmapData() {
      const orders = wx.getStorageSync('kitchen_orders') || [];
      const orderMap = {};
      
      orders.forEach(o => {
        const dateStr = this.normalizeDateKey(o.dateKey || o.date);
        if (dateStr) {
          orderMap[dateStr] = (orderMap[dateStr] || 0) + 1;
        }
      });

      const grid = [];
      const year = this.data.currentYear;

      for (let m = 0; m < 12; m++) {
        const squares = [];
        // Get days in month
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        
        for (let d = 1; d <= daysInMonth; d++) {
          const dateKey = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const count = orderMap[dateKey] || 0;
          let color = '#f0f0f0'; // Default empty
          
          if (count > 0) {
            // Simple logic: Green if cooked/ordered
            // Could be dynamic based on count or flavor in future
            color = '#4CAF50'; 
          }

          squares.push({ color });
        }
        grid.push({ month: m + 1, squares });
      }
      this.setData({ heatmapGrid: grid });
    },

    checkTodayStatus() {
      const now = new Date();
      const todayStr = this.formatDateKey(now);
      const legacyTodayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const status = wx.getStorageSync('daily_status_' + todayStr)
        || wx.getStorageSync('daily_status_' + legacyTodayStr)
        || 'empty';
      
      this.setData({ todayStatus: status });
      
      // Reload heatmap data to ensure realtime update
      this.loadHeatmapData();

      if (status === 'planned') {
        const menu = wx.getStorageSync('today_menu');
        if (menu) {
          this.setData({ todayMenu: menu });
        }
      }
      // If completed, we don't necessarily need to force view switch, but we could
    },

    switchView(e) {
      this.setData({
        activeView: e.currentTarget.dataset.view
      });
    },

    goToMenu() {
      this.triggerEvent('switchTab', { tabIndex: 1 });
    },

    completeCooking() {
      wx.showLoading({ title: '记录中...' });
      
      const now = new Date();
      const todayStr = this.formatDateKey(now);
      const menu = this.data.todayMenu;

      // 1. Update Status
      wx.setStorageSync('daily_status_' + todayStr, 'completed');

      // 2. Create Diary Entry (History)
      if (menu) {
        const order = {
          id: Date.now(),
          dateKey: todayStr,
          date: now.toLocaleString(),
          items: menu.items,
          status: '已完成'
        };
        let orders = wx.getStorageSync('kitchen_orders') || [];
        orders.unshift(order);
        wx.setStorageSync('kitchen_orders', orders);
      }

      // 3. Update UI
      this.setData({ 
        todayStatus: 'completed',
        activeView: 'heat' // Switch to heatmap to show result? Or stay in cart?
        // Let's switch to heat as a reward? Or stay in cart and show "Done". 
        // User asked to restore UI, old UI had separate views. 
        // Let's stay in cart but show "Done" state.
      });

      wx.hideLoading();
      wx.showToast({ title: '打卡成功', icon: 'success' });
    },

    goToDiary() {
      this.triggerEvent('switchTab', { tabIndex: 2 });
    }
  }
})
