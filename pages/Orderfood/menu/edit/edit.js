Page({
  data: {
    isEdit: false,
    id: '',
    name: '',
    price: '',
    description: '',
    categoryId: '',
    categoryIndex: 0,
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
    image: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        isEdit: true,
        id: options.id
      });
      this.loadDishData(options.id);
    }
  },

  loadDishData(id) {
    // Mock data loading
    // In real app, fetch from DB or previous page
    const mockDish = {
      id: id,
      name: '示例菜品',
      price: '29.90',
      description: '这是一个示例描述',
      catId: 'hot',
      image: 'https://picsum.photos/200/200'
    };
    
    const catIndex = this.data.categories.findIndex(c => c.id === mockDish.catId);
    
    this.setData({
      name: mockDish.name,
      price: mockDish.price,
      description: mockDish.description,
      categoryId: mockDish.catId,
      categoryIndex: catIndex >= 0 ? catIndex : 0,
      image: mockDish.image
    });
    
    wx.setNavigationBarTitle({ title: '编辑菜品' });
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPriceInput(e) { this.setData({ price: e.detail.value }); },
  onDescInput(e) { this.setData({ description: e.detail.value }); },
  onRecommendChange(e) { this.setData({ isRecommend: e.detail.value }); },
  
  onCategoryChange(e) {
    const index = e.detail.value;
    this.setData({
      categoryIndex: index,
      categoryId: this.data.categories[index].id
    });
  },

  onChooseImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({ image: res.tempFilePaths[0] });
      }
    });
  },

  onSave() {
    const { name, price, categoryId } = this.data;
    if (!name || !price) {
      wx.showToast({ title: '请填写名称和价格', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '保存中' });
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 1500);
    }, 1000);
  }
});