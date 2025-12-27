// Orderfood 首页逻辑：左侧分类 + 右侧菜单列表 + 购物车抽屉
Page({
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

    // 菜品数据（演示用，可替换为云数据库）
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
      },
      
    ],

    // 渲染用列表
    filteredFoods: [],

    // 底部合计
    totalCount: 0,
    totalPrice: '0.00',
    amountFontSize: 36,
  },

  // 初始化：应用筛选与统计
  onLoad() {
    this.applyFilterAndCalc();
    // wx.onWindowResize(() => {
    //   this.fitAmountFont();
    // });
  },

  // 搜索框输入回调：更新关键字并重新筛选
  onKeywordInput(e) {
    this.setData({
      keyword: e.detail.value || ''
    });
    this.applyFilterAndCalc();
  },

  // 左侧分类点击：切换分类并重新筛选
  pickCat(e) {
    const cat = e.currentTarget.dataset.cat || 'all';
    this.setData({
      activeCat: cat
    });
    this.applyFilterAndCalc();
  },

  // 空操作用于阻止冒泡（WXML 中 catchtap="noop"）
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

  // 菜品 -1（不低于 0）
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
  // 删除某个已选：数量清零
removeFood(e) {
  const id = e.currentTarget.dataset.id;
  const foods = this.data.foods.map(it => {
    if (it.id === id) return { ...it, count: 0 };
    return it;
  });
  this.setData({ foods });
  this.applyFilterAndCalc();
},

  // 跳转结算页：写入本地存储并导航
  goCheckout() {
    const list = this.data.foods
      .filter(it => Number(it.count || 0) > 0)
      .map(it => ({
        id: it.id,
        name: it.name,
        price: Number(it.price || 0) * Number(it.count || 0)
      }));
    wx.setStorageSync('of_cart_v1', list);
    wx.navigateTo({ url: '/pages/Orderfood/checkout/checkout' });
  },

  // 应用筛选并计算总数与总价，同时生成已选列表
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

    // 合计（基于全量 foods，不是 filteredFoods）
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

    // 如果购物车为空，自动关闭抽屉
    if (totalCount === 0) {
      updates.cartVisible = false;
    }

    this.setData(updates);
    // setTimeout(() => this.fitAmountFont(), 0);
  },

  // 展开/收起购物车抽屉，并根据已选数量设定列表显示高度
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
    // setTimeout(() => this.fitAmountFont(), 0);
  },

  // 抽屉内 +1（保持抽屉布局刷新）
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

  // 页面底部“去结算”与抽屉一致：写入后跳转
  checkout() {
    const list = this.data.foods
      .filter(it => Number(it.count || 0) > 0)
      .map(it => ({
        id: it.id,
        name: it.name,
        price: Number(it.price || 0) * Number(it.count || 0)
      }));
    wx.setStorageSync('of_cart_v1', list);
    wx.navigateTo({ url: '/pages/Orderfood/checkout/checkout' });
  },
  openRemark() {
    wx.navigateTo({ url: '/pages/Orderfood/checkout/checkout' });
  },
  fitAmountFont(retry = 0) {
    if (retry > 5) return; // 防止无限递归
    const q = wx.createSelectorQuery();
    q.select('.bb-total').boundingClientRect();
    q.select('.bb-total-label').boundingClientRect();
    q.select('.bb-price').boundingClientRect();
    q.exec(res => {
      const totalRect = res && res[0];
      const labelRect = res && res[1];
      const priceRect = res && res[2];
      if (!totalRect || !priceRect) return;

      // 动态获取“合计：”标签宽度，更精准的自适应
      const labelWidth = labelRect ? labelRect.width : 45;
      const available = Math.max(0, totalRect.width - labelWidth - 4); // 预留少量间隙
      const current = priceRect.width;
      let size = this.data.amountFontSize || 36;
      let newSize = size;

      if (current > available) {
        // 宽度溢出：按比例缩小
        const ratio = available / current;
        newSize = Math.max(22, Math.floor(size * ratio * 0.95)); 
      } else if (available > current * 1.2 && size < 36) {
        // 空间充裕：尝试放大
        newSize = Math.min(36, size + 2);
      }

      if (newSize !== size) {
        this.setData({ amountFontSize: newSize }, () => {
          this.fitAmountFont(retry + 1);
        });
      }
    });
  },
});