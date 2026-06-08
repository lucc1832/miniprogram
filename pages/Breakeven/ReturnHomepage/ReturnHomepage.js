
const cloudStore = require('../../../utils/cloudStore.js');
let { todayStr, diffDays } = (() => {
  try {
    return require('../utils/date.js');
  } catch (err) {
    console.warn('date utils load failed, use fallback', err);
    return {
      todayStr() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      },
      diffDays(date, today) {
        const a = new Date(String(date).replace(/-/g, '/'));
        const b = new Date(String(today).replace(/-/g, '/'));
        a.setHours(0, 0, 0, 0);
        b.setHours(0, 0, 0, 0);
        return Math.ceil((a.getTime() - b.getTime()) / 86400000);
      }
    };
  }
})();

function getGoodsType(g) {
  return g.type || (g.buyPrice != null ? 'roi' : 'expire');
}

function getModeGoods(goods, mode) {
  return goods.filter(g => getGoodsType(g) === mode);
}

Page({
  data: {
    mode: 'expire', // expire | roi
    keyword: '',
    today: '',
    categories: [],
    categoryNames: ['全部分类'],
    categoryIds: [''],
    categoryIndex: 0,
    catCounts: { all: 0 },
    selectedCatId: '',
    statusFilter: 'all',
    statusNames: ['全部状态', '未过期', '临期', '已过期'],
    statusValues: ['all', 'valid', 'soon', 'expired'],
    statusIndex: 0,
    sortOptions: ['到期日', '购买日'],
    sortIndex: 0,
    goods: [],
    filtered: [],
    quickStats: [],
    summary: {
      totalAsset: '0.00',
      totalCount: 0,
      expireSoonCount: 0,
      expiredCount: 0,
      todayCost: '0.00',
      maxDailyCost: '0.00',
      maxDailyName: '-',
      focusTitle: '暂无重点',
      focusValue: '--',
      focusUnit: '',
      focusMeta: '添加物品后，这里会自动提示最需要关注的一项',
      focusTone: 'calm',
      guideText: '先添加几个物品，后续会自动帮你排序和提醒。'
    }
  },

  onLoad() {
    this.setData({ today: todayStr() });
  },

  onShow() {
    this.setData({ today: todayStr() });
    this.loadCategories()
      .then(() => this.loadGoods())
      .catch(err => {
        console.error('load breakeven page failed', err);
        this.setData({ categories: [], goods: [], filtered: [] });
        wx.showToast({ title: '数据加载失败', icon: 'none' });
      });
  },

  async loadCategories() {
    const categories = (await cloudStore.getUserRows('categories'))
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    this.setData({
      categories,
      categoryNames: ['全部分类', ...categories.map(item => item.name)],
      categoryIds: ['', ...categories.map(item => item._id)]
    });
  },

  async loadGoods() {
    const goods = (await cloudStore.getUserRows('goods'))
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .map(g => ({...g}));
    const catMap = {};
    this.data.categories.forEach(c => { catMap[c._id]=c.name; });

    // counts
    // Moved to recomputeSummary to support mode filtering
    goods.forEach(g => {
      const cid = g.categoryId || '';
      g.categoryName = catMap[cid] || '未分类';
      g.statusText = (g.status || 'using') === 'archived' ? '归档' : '使用中';
    });

    // enrich for expire and roi display
    const today = this.data.today || todayStr();
    goods.forEach(g => {
      // expire
      if (g.expireEnabled && g.expireDate) {
        const d = diffDays(g.expireDate, today); // expire - today
        g._daysDiff = d;
        g._daysDiffAbs = Math.abs(d);
        
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
      } else {
        // No expiration date set
        g._expireState = 'none';
        g._expireText = '长期';
        g._daysDiff = 9999;
      }

      const P = (g.buyPrice === 0 || g.buyPrice) ? Number(g.buyPrice) : null;
      let daysUsed = 0;
      if (g.buyDate) {
        daysUsed = Math.max(1, -diffDays(g.buyDate, today));
      }
      if (P != null) {
        g._useDays = daysUsed;
        g._dailyCost = P / daysUsed;
        g._dailyCostStr = (P / daysUsed).toFixed(2);
      } else {
        g._useDays = 0;
        g._dailyCost = 0;
        g._dailyCostStr = '0.00';
      }
      // 统一使用365天或用户设定作为回本周期，保证回本日和进度条有固定参照
      // 修改逻辑：周期 = 价格 (即每日成本平分为1元时回本)
      // P already declared above at line 84
      let cycleDays = 365;
      
      if (P != null) {
        cycleDays = Math.max(1, Math.round(P));
      }
      
      if (P != null) {
        const V = (P / cycleDays) * g._useDays;
        const pct = Math.min(100, Math.floor((g._useDays / cycleDays) * 100));
        g._roiPct = isFinite(pct) ? pct : 0;
        const gap = Math.max(0, P - V);
        g._roiGap = gap.toFixed(2);
      } else {
        g._roiPct = 0;
        g._roiGap = '0.00';
      }
      if (g.buyDate) {
        // 到期日固定为购买日 + 1年
        const d = new Date(g.buyDate + 'T00:00:00');
        d.setFullYear(d.getFullYear() + 1);
        
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        g._roiDeadline = `${y}-${m}-${da}`;

        // 预计回本时间 = 购买日 + cycleDays
        if (g.buyPrice === 0 || g.buyPrice) {
          const bd = new Date(g.buyDate + 'T00:00:00');
          bd.setDate(bd.getDate() + cycleDays);
          const by = bd.getFullYear();
          const bm = String(bd.getMonth() + 1).padStart(2, '0');
          const bda = String(bd.getDate()).padStart(2, '0');
          g._roiBreakevenAt = `${by}-${bm}-${bda}`;
        } else {
          g._roiBreakevenAt = '';
        }
      } else {
        g._roiDeadline = '';
        g._roiBreakevenAt = '';
      }
    });

    this.setData({ goods }, () => {
      this.recomputeSummary();
      this.applyFilters();
      this.writeBatchRoiLogs();
    });
  },

  async writeBatchRoiLogs() {
    try {
      const goods = this.data.goods || [];
      if (!goods.length) return;
      const today = this.data.today || todayStr();
      const ids = goods.filter(g => (g.buyPrice === 0 || g.buyPrice)).map(g => g._id);
      if (!ids.length) return;

      const existList = (await cloudStore.getUserRows('roi_logs'))
        .filter(item => ids.includes(item.goodsId) && item.date === today);
      const existMap = {};
      existList.forEach(it => { existMap[it.goodsId] = it; });

      const tasks = [];
      goods.forEach(g => {
        if (!(g.buyPrice === 0 || g.buyPrice)) return;
        const P = Number(g.buyPrice || 0);
        const usedDays = Math.max(1, Number(g._useDays || 0));
        const cycleDays = Number(g.roiCycleDays || 365);
        const recovered = (P / cycleDays) * usedDays;
        const pct = Math.min(100, Math.floor((usedDays / cycleDays) * 100));
        const gap = Math.max(0, P - recovered);

        const exist = existMap[g._id];
        if (!exist) {
          tasks.push(cloudStore.addUserDoc('roi_logs', {
              goodsId: g._id,
              date: today,
              pct,
              recovered: Number(recovered.toFixed(2)),
              gap: Number(gap.toFixed(2)),
              buyPrice: P,
              cycleDays: cycleDays,
              usedDays
          }));
        } else {
          if (Number(exist.pct || 0) !== pct || Number(exist.recovered || 0) !== Number(recovered.toFixed(2))) {
            tasks.push(cloudStore.updateUserDoc('roi_logs', exist._id, {
                pct,
                recovered: Number(recovered.toFixed(2)),
                gap: Number(gap.toFixed(2)),
                buyPrice: P,
                cycleDays: cycleDays,
                usedDays
            }));
          }
        }
      });

      if (tasks.length) await Promise.all(tasks);
    } catch (e) {
      console.error('writeBatchRoiLogs error', e);
      const msg = String(e && (e.errMsg || e.message || ''));
      const code = Number(e && e.errCode);
      const collectionMissing = code === -502005 || /DATABASE_COLLECTION_NOT_EXIST|Db or Table not exist/i.test(msg);
      if (collectionMissing) {
        const goods = this.data.goods || [];
        const today = this.data.today || todayStr();
        const logs = wx.getStorageSync('roi_logs_local') || [];
        const map = {};
        logs.forEach(it => { map[`${it.goodsId}_${it.date}`] = it; });
        goods.forEach(g => {
          if (!(g.buyPrice === 0 || g.buyPrice)) return;
          const P = Number(g.buyPrice || 0);
          const usedDays = Math.max(1, Number(g._useDays || 0));
          const cycleDays = Number(g.roiCycleDays || 365);
          const recovered = (P / cycleDays) * usedDays;
          const pct = Math.min(100, Math.floor((usedDays / cycleDays) * 100));
          const gap = Math.max(0, P - recovered);
          map[`${g._id}_${today}`] = {
            goodsId: g._id,
            date: today,
            pct,
            recovered: Number(recovered.toFixed(2)),
            gap: Number(gap.toFixed(2)),
            buyPrice: P,
            cycleDays: cycleDays,
            usedDays
          };
        });
        const deduped = Object.values(map);
        wx.setStorageSync('roi_logs_local', deduped);
      }
    }
  },

  recomputeSummary() {
    const { goods, mode, categories } = this.data;
    const modeGoods = getModeGoods(goods, mode);

    let totalAsset = 0;
    let expireSoon = 0;
    let expiredCount = 0;
    let validCount = 0;
    let archivedCount = 0;
    let maxDaily = 0;
    let maxName = '-';

    modeGoods.forEach(g => {
      if (g.buyPrice === 0 || g.buyPrice) totalAsset += Number(g.buyPrice);
      if (g.expireEnabled && g.expireDate && g._expireState === 'soon') expireSoon += 1;
      if (g.expireEnabled && g.expireDate && g._expireState === 'expired') expiredCount += 1;
      if (mode === 'expire' && g._expireState !== 'expired') validCount += 1;
      if (mode === 'roi' && (g.status || 'using') === 'archived') archivedCount += 1;
      if ((g._dailyCost||0) > maxDaily) { maxDaily = g._dailyCost; maxName = g.name; }
    });

    // todayCost
    let todayCost = 0;
    modeGoods.forEach(g => { todayCost += (g._dailyCost || 0); });

    // Category Counts (based on modeGoods)
    const catCounts = { all: modeGoods.length };
    // Initialize all categories to 0
    categories.forEach(c => { catCounts[c._id] = 0; });
    
    modeGoods.forEach(g => {
        const cid = g.categoryId || '';
        if (cid) {
             catCounts[cid] = (catCounts[cid] || 0) + 1;
        }
    });

    let focusTitle = '暂无重点';
    let focusValue = '--';
    let focusUnit = '';
    let focusMeta = '添加物品后，这里会自动提示最需要关注的一项';
    let focusTone = 'calm';
    let guideText = '先添加几个物品，后续会自动帮你排序和提醒。';
    let quickStats = [];

    if (mode === 'expire') {
      const datedGoods = modeGoods
        .filter(g => g.expireEnabled && g.expireDate)
        .slice()
        .sort((a, b) => {
          const scoreA = a._expireState === 'expired' ? -10000 - a._daysDiffAbs : a._daysDiff;
          const scoreB = b._expireState === 'expired' ? -10000 - b._daysDiffAbs : b._daysDiff;
          return scoreA - scoreB;
        });
      const focusItem = datedGoods[0];

      if (focusItem) {
        focusTitle = focusItem.name || '未命名物品';
        focusValue = String(focusItem._daysDiffAbs || 0);
        focusUnit = '天';
        if (focusItem._expireState === 'expired') {
          focusTone = 'danger';
          focusMeta = `已过期 ${focusItem._daysDiffAbs} 天，建议尽快处理`;
        } else if (focusItem._expireState === 'soon') {
          focusTone = 'warn';
          focusMeta = `还有 ${focusItem._daysDiffAbs} 天到期 · ${focusItem.categoryName || '未分类'}`;
        } else {
          focusTone = 'calm';
          focusMeta = `下一件到期物 · ${focusItem.expireDate}`;
        }
      }

      if (expiredCount > 0) {
        guideText = `有 ${expiredCount} 件已过期，建议先清理或更新有效期。`;
      } else if (expireSoon > 0) {
        guideText = `${expireSoon} 件物品 30 天内到期，可以提前补货或处理。`;
      } else if (modeGoods.length > 0) {
        guideText = '最近没有紧急到期项，状态不错。';
      }

      quickStats = [
        { label: '全部', value: modeGoods.length, suffix: '件', status: 'all' },
        { label: '临期', value: expireSoon, suffix: '件', status: 'soon' },
        { label: '已过期', value: expiredCount, suffix: '件', status: 'expired' },
        { label: '正常', value: validCount, suffix: '件', status: 'valid' }
      ];
    } else {
      const activeGoods = modeGoods.filter(g => (g.status || 'using') === 'using');
      const costGoods = activeGoods
        .filter(g => g.buyPrice === 0 || g.buyPrice)
        .slice()
        .sort((a, b) => (b._dailyCost || 0) - (a._dailyCost || 0));
      const focusItem = costGoods[0];

      if (focusItem) {
        focusTitle = focusItem.name || '未命名物品';
        focusValue = Number(focusItem._dailyCost || 0).toFixed(2);
        focusUnit = '元/天';
        focusTone = Number(focusItem._dailyCost || 0) > 10 ? 'warn' : 'calm';
        focusMeta = `已用 ${focusItem._useDays || 0} 天 · 回本进度 ${focusItem._roiPct || 0}%`;
      }

      if (maxDaily > 0) {
        guideText = `今天总摊销约 ¥${todayCost.toFixed(2)}，最高日成本是「${maxName}」。`;
      } else {
        guideText = '填写购买价后，可以自动看到日均成本和回本进度。';
      }

      quickStats = [
        { label: '投入', value: totalAsset.toFixed(0), suffix: '元', status: 'all' },
        { label: '今日摊销', value: todayCost.toFixed(2), suffix: '元', status: 'all' },
        { label: '使用中', value: activeGoods.length, suffix: '件', status: 'using' },
        { label: '已归档', value: archivedCount, suffix: '件', status: 'archived' }
      ];
    }

    this.setData({
      summary: {
        totalAsset: totalAsset.toFixed(2),
        totalCount: modeGoods.length,
        expireSoonCount: expireSoon,
        expiredCount,
        todayCost: todayCost.toFixed(2),
        maxDailyCost: maxDaily.toFixed(2),
        maxDailyName: maxName,
        focusTitle,
        focusValue,
        focusUnit,
        focusMeta,
        focusTone,
        guideText
      },
      catCounts: catCounts,
      quickStats
    });
  },

  applyFilters() {
    const { goods, keyword, selectedCatId, statusFilter, mode, sortIndex } = this.data;
    const today = this.data.today;

    let list = goods.filter(g => {
      // 1. 根据 mode 过滤 type
      // 如果 mode 是 expire，只显示 type='expire' (或者兼容旧数据没有type的)
      // 如果 mode 是 roi，只显示 type='roi'
      // 注意：为了兼容旧数据，这里需要小心处理。假设旧数据如果没有 type，暂时两边都显示？或者根据是否有价格来分？
      // 现在的策略：
      // - mode=expire: type='expire' OR (!type AND price is null)
      // - mode=roi: type='roi' OR (!type AND price > 0)
      
      const gType = getGoodsType(g);
      if (mode === 'expire' && gType !== 'expire') return false;
      if (mode === 'roi' && gType !== 'roi') return false;

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
        if (statusFilter === 'soon') {
          return (g.expireEnabled && g._expireState === 'soon');
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
    } else if (mode === 'expire' && sortIndex === 1) {
      list.sort((a,b) => (b.buyDate||'').localeCompare(a.buyDate||''));
    } else if (mode === 'roi' && sortIndex === 0) {
      list.sort((a,b) => (b._dailyCost||0) - (a._dailyCost||0));
    } else if (mode === 'roi' && sortIndex === 1) {
      list.sort((a,b) => (Number(b.buyPrice||0) - Number(a.buyPrice||0)));
    }

    this.setData({ filtered: list });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    const sortOptions = mode === 'expire' ? ['到期日', '购买日'] : ['日成本', '价格'];
    const sortIndex = 0;
    const statusFilter = 'all';
    const statusNames = mode === 'expire'
      ? ['全部状态', '未过期', '临期', '已过期']
      : ['全部状态', '使用中', '已归档'];
    const statusValues = mode === 'expire'
      ? ['all', 'valid', 'soon', 'expired']
      : ['all', 'using', 'archived'];
    this.setData({ mode, sortOptions, sortIndex, statusFilter, statusNames, statusValues, statusIndex: 0 }, () => {
      this.recomputeSummary();
      this.applyFilters();
    });
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilters());
  },

  clearKeyword() {
    this.setData({ keyword: '' }, () => this.applyFilters());
  },

  onCategoryFilter(e) {
    const categoryIndex = Number(e.detail.value);
    const selectedCatId = this.data.categoryIds[categoryIndex] || '';
    this.setData({ categoryIndex, selectedCatId }, () => this.applyFilters());
  },

  onStatusFilter(e) {
    const statusIndex = Number(e.detail.value);
    const statusFilter = this.data.statusValues[statusIndex] || 'all';
    this.setData({ statusIndex, statusFilter }, () => this.applyFilters());
  },

  pickCat(e) {
    this.setData({ selectedCatId: e.currentTarget.dataset.id }, () => this.applyFilters());
  },

  pickStatus(e) {
    this.setData({ statusFilter: e.currentTarget.dataset.s }, () => this.applyFilters());
  },

  onStatTap(e) {
    const status = e.currentTarget.dataset.status;
    if (!status) return;
    const statusIndex = Math.max(0, this.data.statusValues.indexOf(status));
    this.setData({ statusFilter: status, statusIndex }, () => this.applyFilters());
  },

  onSort(e) {
    this.setData({ sortIndex: Number(e.detail.value) }, () => this.applyFilters());
  },

  goAdd() {
    // 传递当前模式作为默认类型
    const mode = this.data.mode; 
    wx.navigateTo({ url: `/pages/Breakeven/add/add?type=${mode}` });
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/Breakeven/detail/detail?id=${id}` });
  },
  goCategories() {
    wx.navigateTo({ url: '/pages/Breakeven/categories/categories' });
  }
});
