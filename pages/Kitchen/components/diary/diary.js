Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number
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
    loadData() {
      const orders = wx.getStorageSync('kitchen_orders') || [];
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const status = wx.getStorageSync('daily_status_' + todayStr) || 'empty';

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
      this.setData({ orders });
      wx.setStorageSync('kitchen_orders', orders);
      wx.showToast({ title: '订单已完成', icon: 'success' });
      this.closeDetail();
    }
  }
})