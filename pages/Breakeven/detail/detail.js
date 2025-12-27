const db = wx.cloud.database();

Page({
  data: {
    id: '',
    good: null,
    usedDays: 0,
    dailyCostStr: '0.00'
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.load();
  },

  onShow() {
    // 从编辑页返回后刷新
    this.load();
  },

  async load() {
    const id = this.data.id;
    if (!id) return;

    const gRes = await db.collection('goods').doc(id).get();
    const good = gRes.data;

    // category name（可选）
    let categoryName = '未分类';
    if (good.categoryId) {
      try {
        const cRes = await db.collection('categories').doc(good.categoryId).get();
        categoryName = cRes.data?.name || categoryName;
      } catch (e) {}
    }
    good.categoryName = categoryName;

    // 使用天数（按购买日到今天）
    let usedDays = 0;
    if (good.buyDate) {
      const buy = new Date(good.buyDate + 'T00:00:00');
      const now = new Date();
      const diff = Math.floor((now - buy) / 86400000);
      usedDays = diff > 0 ? diff : 0;
    }

    // 日均成本 = buyPrice / usedDays
    let dailyCostStr = '0.00';
    if (good.buyPrice != null && usedDays > 0) {
      dailyCostStr = (Number(good.buyPrice) / usedDays).toFixed(2);
    }

    this.setData({ good, usedDays, dailyCostStr });
  },

  goEdit() {
    wx.navigateTo({
      url: `/pages/Breakeven/add/add?id=${this.data.id}`
    });
  },

  async toggleArchive() {
    const g = this.data.good;
    if (!g) return;

    const nextStatus = g.status === 'archived' ? 'using' : 'archived';
    await db.collection('goods').doc(this.data.id).update({
      data: { status: nextStatus, updatedAt: Date.now() }
    });

    this.load();
  }
});
