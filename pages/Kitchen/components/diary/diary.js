Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number,
    isActive: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        if (newVal) {
          this.loadData();
        }
      }
    }
  },

  data: {
    orders: [],
    selectedOrder: null,
    showDetail: false,
    todayStatus: 'empty'
  },

  lifetimes: {
    attached() {
      this.loadData();
    }
  },

  pageLifetimes: {
    show() {
      this.loadData();
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
      const datePart = String(value).trim().split(' ')[0].replace(/\//g, '-');
      const parts = datePart.split('-');
      if (parts.length < 3) return datePart;

      const y = parts[0];
      const m = String(parseInt(parts[1], 10)).padStart(2, '0');
      const d = String(parseInt(parts[2], 10)).padStart(2, '0');
      return y && m !== 'NaN' && d !== 'NaN' ? `${y}-${m}-${d}` : '';
    },

    loadData() {
      const orders = wx.getStorageSync('kitchen_orders') || [];
      
      const now = new Date();
      const todayStr = this.formatDateKey(now);
      const legacyTodayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const status = wx.getStorageSync('daily_status_' + todayStr)
        || wx.getStorageSync('daily_status_' + legacyTodayStr)
        || 'empty';

      this.setData({ 
        orders,
        todayStatus: status
      });
    },

    goToHome() {
      this.triggerEvent('switchTab', { tabIndex: 0 });
    },

    showOrderDetail(e) {
      const order = e.currentTarget.dataset.order;
      this.setData({
        selectedOrder: order,
        showDetail: true
      });
    },

    closeDetail() {
      this.setData({ showDetail: false });
    },

    completeOrder(e) {
      // This is a fallback for old orders
      const index = e.currentTarget.dataset.index;
      const orders = this.data.orders;
      orders[index].status = '已完成';
      orders[index].dateKey = this.normalizeDateKey(orders[index].dateKey || orders[index].date)
        || this.formatDateKey(new Date());
      this.setData({ orders });
      wx.setStorageSync('kitchen_orders', orders);
      wx.setStorageSync('daily_status_' + orders[index].dateKey, 'completed');
      wx.showToast({ title: '订单已完成', icon: 'success' });
      this.closeDetail();
    }
  }
})
