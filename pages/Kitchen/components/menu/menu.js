Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number
  },

  data: {
    activeCat: 'all',
    foods: [
      { name: '蒸鸡蛋', img: 'https://img.yzcdn.cn/vant/cat.jpeg', desc: '嫩滑可口，营养丰富' },
      { name: '辣椒炒牛肉', img: 'https://img.yzcdn.cn/vant/cat.jpeg', desc: '香辣下饭，肉质鲜嫩' },
      { name: '土豆炖牛腩', img: 'https://img.yzcdn.cn/vant/cat.jpeg', desc: '软烂入味，汤汁浓郁' },
      { name: '辣椒炒牛肚', img: 'https://img.yzcdn.cn/vant/cat.jpeg', desc: '口感爽脆，香辣过瘾' },
      { name: '黄瓜炒火腿', img: 'https://img.yzcdn.cn/vant/cat.jpeg', desc: '清淡爽口，简单快手' },
      { name: '清炒上海青', img: 'https://img.yzcdn.cn/vant/cat.jpeg', desc: '清脆爽口，解腻佳品' }
    ],
    cart: [],
    showDetail: false,
    selectedFood: null,
    showCartModal: false
  },

  methods: {
    switchCat(e) {
      this.setData({ activeCat: e.currentTarget.dataset.cat });
    },

    // 显示菜品详情
    onShowDetail(e) {
      const food = e.currentTarget.dataset.food;
      this.setData({
        selectedFood: food,
        showDetail: true
      });
    },

    closeDetail() {
      this.setData({ showDetail: false });
    },

    toggleFav() {
      // 模拟收藏/取消收藏
      const food = this.data.selectedFood;
      if (food) {
        wx.showToast({ title: '操作成功', icon: 'success' });
      }
    },

    // 加入购物车（首次不提示，重复点击同一商品才提示）
    addToCart(e) {
      const food = e.currentTarget.dataset.food;
      const cart = this.data.cart.slice();
      const exists = cart.findIndex(item => item && item.name === food.name) !== -1;
      cart.push(food);
      this.setData({ cart });
      if (exists) {
        wx.showToast({ title: '已加入清单', icon: 'none', duration: 2500 });
      }
    },

    // 显示购物车详情
    showCart() {
      if (this.data.cart.length > 0) {
        this.setData({ showCartModal: true });
      }
    },

    closeCart() {
      this.setData({ showCartModal: false });
    },

    clearCart() {
      this.setData({ cart: [], showCartModal: false });
    },

    // 提交今日菜单 (Plan)
    submitOrder() {
      if (this.data.cart.length === 0) return;
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      
      const todayMenu = {
        date: todayStr,
        items: this.data.cart,
        createTime: Date.now()
      };

      // 1. 保存今日菜单
      wx.setStorageSync('today_menu', todayMenu);
      
      // 2. 更新今日状态为 "planned"
      wx.setStorageSync('daily_status_' + todayStr, 'planned');

      this.setData({
        cart: [],
        showCartModal: false
      });

      // 3. 引导回首页
      wx.showToast({
        title: '已安排！准备做饭',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => {
            this.triggerEvent('switchTab', { tabIndex: 0 });
          }, 1500);
        }
      });
    }
  }
})
