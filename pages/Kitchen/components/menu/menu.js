// Kitchen 点餐组件
Component({
  properties: {
    statusBarHeight: {
      type: Number,
      value: 20
    },
    navBarHeight: {
      type: Number,
      value: 44
    }
  },

  data: {
    // 搜索关键字
    keyword: '',
    // 当前激活分类
    activeCat: 'all',
    // 左侧分类列表
    catsData: [
      { key: 'all', name: '全部' },
      { key: 'drink', name: '饮品' },
      { key: 'main', name: '主食' },
      { key: 'snack', name: '小吃' }
    ],
    // 是否显示购物车抽屉
    selectedFoods: [],
    showSelected: true,
    cartVisible: false,
    // 抽屉内已选列表及统计
    selectedList: [],
    selectedCount: 0,
    cartListMaxH: '60vh',
    // 顶部次级菜单（预留）
    deliveryMode: 'waisong',
    activeMenu: 'menu',

    // 菜品数据
    foods: [{
        id: 'f1',
        name: '珍珠奶茶',
        price: 18,
        cat: 'drink',
        count: 0,
        img: 'https://img.yzcdn.cn/upload_files/2020/06/15/FmYH5S0ZPp7QzZfrgK8p0sG_C5kZ.png'
      },
      {
        id: 'f2',
        name: '美式咖啡',
        price: 15,
        cat: 'drink',
        count: 0,
        img: 'https://img.yzcdn.cn/upload_files/2020/06/15/FmYH5S0ZPp7QzZfrgK8p0sG_C5kZ.png'
      },
      {
        id: 'f3',
        name: '牛肉饭',
        price: 28,
        cat: 'main',
        count: 0,
        img: 'https://img.yzcdn.cn/upload_files/2020/06/15/FmYH5S0ZPp7QzZfrgK8p0sG_C5kZ.png'
      },
      {
        id: 'f4',
        name: '炸鸡',
        price: 22,
        cat: 'snack',
        count: 0,
        img: 'https://img.yzcdn.cn/upload_files/2020/06/15/FmYH5S0ZPp7QzZfrgK8p0sG_C5kZ.png'
      }
    ],

    // 渲染用列表
    filteredFoods: [],

    // 底部合计
    totalCount: 0,
    totalPrice: '0.00',
    amountFontSize: 36,
  },

  lifetimes: {
    attached() {
      this.applyFilterAndCalc();
    }
  },

  methods: {
    // 搜索框输入回调
    onKeywordInput(e) {
      this.setData({
        keyword: e.detail.value || ''
      });
      this.applyFilterAndCalc();
    },

    // 左侧分类点击
    pickCat(e) {
      const cat = e.currentTarget.dataset.cat || 'all';
      this.setData({
        activeCat: cat
      });
      this.applyFilterAndCalc();
    },

    // 空操作
    noop() {},

    // 外送/自取（占位）
    switchDelivery(e) {
      const mode = e.currentTarget.dataset.mode || 'waisong';
      this.setData({ deliveryMode: mode });
    },

    // 次级菜单切换（占位）
    switchMenu(e) {
      const menu = e.currentTarget.dataset.menu || 'menu';
      this.setData({ activeMenu: menu });
    },

    // 菜品 +1
    addOne(e) {
      const id = e.currentTarget.dataset.id;
      const foods = this.data.foods.map(it => {
        if (it.id === id) return {
          ...it,
          count: (it.count || 0) + 1
        };
        return it;
      });
      this.setData({
        foods
      });
      this.applyFilterAndCalc();
    },

    // 菜品 -1
    minusOne(e) {
      const id = e.currentTarget.dataset.id;
      const foods = this.data.foods.map(it => {
        if (it.id === id) return {
          ...it,
          count: Math.max((it.count || 0) - 1, 0)
        };
        return it;
      });
      this.setData({
        foods
      });
      this.applyFilterAndCalc();
    },

    // 删除某个已选
    removeFood(e) {
      const id = e.currentTarget.dataset.id;
      const foods = this.data.foods.map(it => {
        if (it.id === id) return { ...it, count: 0 };
        return it;
      });
      this.setData({ foods });
      this.applyFilterAndCalc();
    },

    // 跳转结算页
    goCheckout() {
      const list = this.data.foods
        .filter(it => Number(it.count || 0) > 0)
        .map(it => ({
          id: it.id,
          name: it.name,
          price: Number(it.price || 0) * Number(it.count || 0)
        }));
      wx.setStorageSync('of_cart_v1', list);
      wx.navigateTo({ url: '/pages/Kitchen/checkout/checkout' });
    },

    // 应用筛选并计算
    applyFilterAndCalc() {
      const {
        foods,
        keyword,
        activeCat
      } = this.data;
      const kw = (keyword || '').trim().toLowerCase();

      const filteredFoods = foods.filter(it => {
        const hitKw = !kw || (it.name || '').toLowerCase().includes(kw);
        const hitCat = activeCat === 'all' || it.cat === activeCat;
        return hitKw && hitCat;
      });

      let totalCount = 0;
      let totalPriceNum = 0;

      foods.forEach(it => {
        const c = Number(it.count || 0);
        totalCount += c;
        totalPriceNum += c * Number(it.price || 0);
      }); 

      const selectedList = foods.filter(it => Number(it.count || 0) > 0);
      const selectedCount = selectedList.length;

      const updates = {
        filteredFoods,
        totalCount,
        totalPrice: totalPriceNum.toFixed(2),
        selectedList,
        selectedCount,
      };

      if (totalCount === 0) {
        updates.cartVisible = false;
      }

      this.setData(updates);
    },

    // 展开/收起购物车抽屉
    toggleCart() {
      const visible = !this.data.cartVisible;
      this.setData({ cartVisible: visible });
      if (visible) {
        const selectedList = this.data.foods.filter(it => Number(it.count || 0) > 0);
        const count = selectedList.length;
        let cartListMaxH = '60vh';
        if (count <= 1) {
          const h = Math.max(200, count * 132);
          cartListMaxH = h + 'rpx';
        }
        this.setData({ selectedList, selectedCount: count, cartListMaxH });
      }
    },

    // 抽屉内 +1
    inc(e) {
      const id = e.currentTarget.dataset.id;
      const foods = this.data.foods.map(it => {
        if (it.id === id) return { ...it, count: Number(it.count || 0) + 1 };
        return it;
      });
      this.setData({ foods });
      this.applyFilterAndCalc();
    },

    // 抽屉内 -1
    dec(e) {
      const id = e.currentTarget.dataset.id;
      const foods = this.data.foods.map(it => {
        if (it.id === id) return { ...it, count: Math.max(Number(it.count || 0) - 1, 0) };
        return it;
      });
      this.setData({ foods });
      this.applyFilterAndCalc();
    },

    // 抽屉内删除条目
    removeItem(e) {
      const id = e.currentTarget.dataset.id;
      const foods = this.data.foods.map(it => {
        if (it.id === id) return { ...it, count: 0 };
        return it;
      });
      this.setData({ foods });
      this.applyFilterAndCalc();
    },

    openRemark() {
      wx.navigateTo({ url: '/pages/Kitchen/checkout/checkout' });
    }
  }
});
