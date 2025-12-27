
const db = wx.cloud.database();
const _ = db.command;
const { todayStr, diffDays } = require('../../../utils/date');

Page({
  data: {
    mode: 'expire', // expire | roi
    keyword: '',
    today: '',
    categories: [],
    catCounts: { all: 0 },
    selectedCatId: '',
    statusFilter: 'all',
    sortOptions: ['到期日', '价格'],
    sortIndex: 0,
    goods: [],
    filtered: [],
    summary: {
      totalAsset: '0.00',
      totalCount: 0,
      expireSoonCount: 0,
      todayCost: '0.00',
      maxDailyCost: '0.00',
      maxDailyName: '-'
    }
  },

  onLoad() {
    this.setData({ today: todayStr() });
  },

  onShow() {
    this.loadCategories().then(() => this.loadGoods());
  },

  async loadCategories() {
    const res = await db.collection('categories').orderBy('sort','asc').get();
    this.setData({ categories: res.data || [] });
  },

  async loadGoods() {
    const res = await db.collection('goods').orderBy('updatedAt','desc').get();
    const goods = (res.data || []).map(g => ({...g}));
    const catMap = {};
    this.data.categories.forEach(c => { catMap[c._id]=c.name; });

    // counts
    const catCounts = { all: goods.length };
    goods.forEach(g => {
      const cid = g.categoryId || '';
      catCounts[cid] = (catCounts[cid] || 0) + 1;
      g.categoryName = catMap[cid] || '未分类';
    });

    // enrich for expire and roi display
    const today = this.data.today || todayStr();
    goods.forEach(g => {
      // expire
      if (g.expireEnabled && g.expireDate) {
        const d = diffDays(g.expireDate, today); // expire - today
        if (d < 0) {
          g._expireState = 'expired';
          g._expireText = '已过期';
        } else if (d <= 30) {
          g._expireState = 'soon';
          g._expireText = '即将到期';
        } else {
          g._expireState = 'ok';
          g._expireText = '未到期';
        }
      }

      // roi
      const P = (g.buyPrice === 0 || g.buyPrice) ? Number(g.buyPrice) : null;
      const V = Number(g.totalValue || 0);
      if (P != null) {
        const pct = Math.min(100, Math.floor((V / P) * 100));
        g._roiPct = isFinite(pct) ? pct : 0;
        const gap = Math.max(0, (P - V));
        g._roiGap = gap.toFixed(2);
      } else {
        g._roiPct = 0;
        g._roiGap = '0.00';
      }
      if (P != null && g.buyDate) {
        const days = Math.max(1, -diffDays(g.buyDate, today));
        g._useDays = days;
        g._dailyCost = P / days;
        g._dailyCostStr = (P / days).toFixed(2);
      } else {
        g._useDays = 0;
        g._dailyCost = 0;
        g._dailyCostStr = '0.00';
      }
    });

    this.setData({ goods, catCounts }, () => {
      this.recomputeSummary();
      this.applyFilters();
    });
  },

  recomputeSummary() {
    const goods = this.data.goods;
    let totalAsset = 0;
    let expireSoon = 0;
    let maxDaily = 0;
    let maxName = '-';

    goods.forEach(g => {
      if (g.buyPrice === 0 || g.buyPrice) totalAsset += Number(g.buyPrice);
      if (g.expireEnabled && g.expireDate && g._expireState === 'soon') expireSoon += 1;
      if (g._dailyCost > maxDaily) { maxDaily = g._dailyCost; maxName = g.name; }
    });

    // todayCost：用 maxDaily 近似（MVP），你也可以换成 “所有物品日均成本之和”
    let todayCost = 0;
    goods.forEach(g => { todayCost += (g._dailyCost || 0); });

    this.setData({
      summary: {
        totalAsset: totalAsset.toFixed(2),
        totalCount: goods.length,
        expireSoonCount: expireSoon,
        todayCost: todayCost.toFixed(2),
        maxDailyCost: maxDaily.toFixed(2),
        maxDailyName: maxName
      }
    });
  },

  applyFilters() {
    const { goods, keyword, selectedCatId, statusFilter, mode, sortIndex } = this.data;
    const today = this.data.today;

    let list = goods.filter(g => {
      if (selectedCatId !== '') {
        if ((g.categoryId || '') !== selectedCatId) return false;
      }
      if (keyword) {
        const kw = keyword.trim().toLowerCase();
        const inName = (g.name || '').toLowerCase().includes(kw);
        const inCat = (g.categoryName || '').toLowerCase().includes(kw);
        if (!inName && !inCat) return false;
      }

      if (mode === 'expire') {
        if (statusFilter === 'valid') {
          return !(g.expireEnabled && g._expireState === 'expired');
        }
        if (statusFilter === 'expired') {
          return (g.expireEnabled && g._expireState === 'expired');
        }
        return true;
      } else {
        if (statusFilter === 'using') return (g.status || 'using') === 'using';
        if (statusFilter === 'archived') return (g.status || 'using') === 'archived';
        return true;
      }
    });

    // sort
    if (mode === 'expire' && sortIndex === 0) {
      list.sort((a,b) => (a.expireDate||'9999-12-31').localeCompare(b.expireDate||'9999-12-31'));
    } else if (mode === 'roi' && sortIndex === 1) {
      list.sort((a,b) => (Number(a.buyPrice||0) - Number(b.buyPrice||0)));
    } else if (mode === 'roi' && sortIndex === 0) {
      list.sort((a,b) => (a._dailyCost||0) - (b._dailyCost||0));
    }

    this.setData({ filtered: list });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    const sortIndex = mode === 'expire' ? 0 : 1;
    const statusFilter = 'all';
    this.setData({ mode, sortIndex, statusFilter }, () => {
      this.recomputeSummary();
      this.applyFilters();
    });
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilters());
  },

  pickCat(e) {
    this.setData({ selectedCatId: e.currentTarget.dataset.id }, () => this.applyFilters());
  },

  pickStatus(e) {
    this.setData({ statusFilter: e.currentTarget.dataset.s }, () => this.applyFilters());
  },

  onSort(e) {
    this.setData({ sortIndex: Number(e.detail.value) }, () => this.applyFilters());
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/Breakeven/add/add' });
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/Breakeven/detail/detail?id=${id}` });
  },
  goCategories() {
    wx.navigateTo({ url: '/pages/Breakeven/categories/categories' });
  }
});
