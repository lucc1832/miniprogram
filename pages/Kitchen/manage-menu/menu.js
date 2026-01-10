Page({
  data: {
    categories: [
      { id: 'hot', name: '热菜' },
      { id: 'cold', name: '凉菜' },
      { id: 'soup', name: '汤羹' },
      { id: 'staple', name: '主食' },
      { id: 'hotpot', name: '火锅' },
      { id: 'bbq', name: '烧烤' },
      { id: 'veg', name: '素菜' },
      { id: 'sweet', name: '甜品' }
    ],
    activeCategoryId: 'hot',
    activeCategoryName: '热菜',
    allDishes: [], // 所有菜品
    currentDishes: [] // 当前分类下的菜品
  },

  onLoad() {
    this.initMockData();
    this.filterDishes();
  },

  goToCategoryManage() {
    wx.navigateTo({
      url: '/pages/Kitchen/manage-menu/category/category'
    });
  },

  initMockData() {
    const dishes = [
      { id: '1', catId: 'hot', name: '清炒南瓜', description: '甜糯南瓜，清淡爽口', price: '29.90', image: 'https://picsum.photos/200/200?1' },
      { id: '2', catId: 'hot', name: '白菜炒肉', description: '家常味道，下饭神器', price: '29.90', image: 'https://picsum.photos/200/200?2' },
      { id: '3', catId: 'hot', name: '清炒土豆丝', description: '酸辣开胃', price: '0.00', image: 'https://picsum.photos/200/200?3' },
      { id: '4', catId: 'hot', name: '蒜香鸡翅', description: '蒜香浓郁，外焦里嫩', price: '0.00', image: 'https://picsum.photos/200/200?4' },
      { id: '5', catId: 'cold', name: '拍黄瓜', description: '', price: '12.00', image: 'https://picsum.photos/200/200?5' },
      { id: '6', catId: 'staple', name: '米饭', description: '', price: '2.00', image: 'https://picsum.photos/200/200?6' }
    ];
    this.setData({ allDishes: dishes });
  },

  switchCategory(e) {
    const id = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === id);
    this.setData({ 
      activeCategoryId: id,
      activeCategoryName: cat ? cat.name : ''
    });
    this.filterDishes();
  },

  filterDishes() {
    const { allDishes, activeCategoryId } = this.data;
    const currentDishes = allDishes.filter(d => d.catId === activeCategoryId);
    this.setData({ currentDishes });
  },

  // ---------------- 功能操作 ----------------

  onDeleteDish(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个菜品吗？此操作不可恢复。',
      confirmColor: '#e60012',
      success: (res) => {
        if (res.confirm) {
          const newAll = this.data.allDishes.filter(d => d.id !== id);
          this.setData({ allDishes: newAll });
          this.filterDishes();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  onMoveUp(e) {
    const id = e.currentTarget.dataset.id;
    const { allDishes, activeCategoryId } = this.data;
    
    // 找到当前分类下的所有菜品索引
    const currentCatDishes = allDishes.filter(d => d.catId === activeCategoryId);
    const indexInCat = currentCatDishes.findIndex(d => d.id === id);
    
    if (indexInCat <= 0) return; // 已经是第一个

    // 交换位置逻辑（稍微复杂，因为是在全量数组中交换）
    // 简单做法：只在当前展示列表中交换，然后同步回全量？
    // 或者：找到这两个元素在 allDishes 中的真实索引并交换
    const currentItem = currentCatDishes[indexInCat];
    const prevItem = currentCatDishes[indexInCat - 1];

    const realIndexCurr = allDishes.findIndex(d => d.id === currentItem.id);
    const realIndexPrev = allDishes.findIndex(d => d.id === prevItem.id);

    // Swap
    [allDishes[realIndexCurr], allDishes[realIndexPrev]] = [allDishes[realIndexPrev], allDishes[realIndexCurr]];
    
    this.setData({ allDishes });
    this.filterDishes();
  },

  onMoveDown(e) {
    const id = e.currentTarget.dataset.id;
    const { allDishes, activeCategoryId } = this.data;
    
    const currentCatDishes = allDishes.filter(d => d.catId === activeCategoryId);
    const indexInCat = currentCatDishes.findIndex(d => d.id === id);
    
    if (indexInCat === -1 || indexInCat >= currentCatDishes.length - 1) return; // 已经是最后一个

    const currentItem = currentCatDishes[indexInCat];
    const nextItem = currentCatDishes[indexInCat + 1];

    const realIndexCurr = allDishes.findIndex(d => d.id === currentItem.id);
    const realIndexNext = allDishes.findIndex(d => d.id === nextItem.id);

    // Swap
    [allDishes[realIndexCurr], allDishes[realIndexNext]] = [allDishes[realIndexNext], allDishes[realIndexCurr]];
    
    this.setData({ allDishes });
    this.filterDishes();
  },

  onEditDish(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/Kitchen/manage-menu/edit/edit?id=${id}`
    });
  },

  onManageGroups() {
    wx.showToast({ title: '管理分组功能待开发', icon: 'none' });
  },

  onImportDishes() {
    wx.showToast({ title: '导入菜品功能待开发', icon: 'none' });
  },

  onAddDish() {
    wx.navigateTo({
      url: '/pages/Kitchen/manage-menu/edit/edit'
    });
  }
});
