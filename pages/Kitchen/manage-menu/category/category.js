Page({
  data: {
    categories: []
  },
  onLoad() {
    // Mock data for now, should sync with global/storage
    const categories = [
      { id: 'hot', name: '热菜' },
      { id: 'cold', name: '凉菜' },
      { id: 'soup', name: '汤羹' },
      { id: 'staple', name: '主食' },
      { id: 'hotpot', name: '火锅' },
      { id: 'bbq', name: '烧烤' },
      { id: 'veg', name: '素菜' },
      { id: 'sweet', name: '甜品' }
    ];
    this.setData({ categories });
  },

  onAddCategory() {
    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '请输入分类名称',
      success: (res) => {
        if (res.confirm && res.content) {
          const newCat = {
            id: 'cat_' + Date.now(),
            name: res.content
          };
          const categories = [...this.data.categories, newCat];
          this.setData({ categories });
        }
      }
    });
  },

  onEditCategory(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '编辑分类',
      editable: true,
      content: name,
      success: (res) => {
        if (res.confirm && res.content) {
          const categories = this.data.categories.map(c => 
            c.id === id ? { ...c, name: res.content } : c
          );
          this.setData({ categories });
        }
      }
    });
  },

  onDeleteCategory(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该分类吗？',
      success: (res) => {
        if (res.confirm) {
          const categories = this.data.categories.filter(c => c.id !== id);
          this.setData({ categories });
        }
      }
    });
  },

  onMoveUp(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) return;
    const categories = [...this.data.categories];
    [categories[index], categories[index - 1]] = [categories[index - 1], categories[index]];
    this.setData({ categories });
  },

  onMoveDown(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.categories.length - 1) return;
    const categories = [...this.data.categories];
    [categories[index], categories[index + 1]] = [categories[index + 1], categories[index]];
    this.setData({ categories });
  }
});