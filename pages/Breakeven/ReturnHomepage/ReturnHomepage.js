
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
    this.setData({ today: todayStr() });
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

      const existingRes = await db.collection('roi_logs')
        .where({ goodsId: _.in(ids), date: today })
        .get();
      const existList = existingRes.data || [];
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
          tasks.push(db.collection('roi_logs').add({
            data: {
              goodsId: g._id,
              date: today,
              pct,
              recovered: Number(recovered.toFixed(2)),
              gap: Number(gap.toFixed(2)),
              buyPrice: P,
              cycleDays: cycleDays,
              usedDays
            }
          }));
        } else {
          if (Number(exist.pct || 0) !== pct || Number(exist.recovered || 0) !== Number(recovered.toFixed(2))) {
            tasks.push(db.collection('roi_logs').doc(exist._id).update({
              data: {
                pct,
                recovered: Number(recovered.toFixed(2)),
                gap: Number(gap.toFixed(2)),
                buyPrice: P,
                cycleDays: cycleDays,
                usedDays
              }
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
    
    // Filter goods based on current mode
    const modeGoods = goods.filter(g => {
      const gType = g.type || (g.buyPrice != null ? 'roi' : 'expire'); 
      if (mode === 'expire' && gType !== 'expire') return false;
      if (mode === 'roi' && gType !== 'roi') return false;
      return true;
    });

    let totalAsset = 0;
    let expireSoon = 0;
    let maxDaily = 0;
    let maxName = '-';

    modeGoods.forEach(g => {
      if (g.buyPrice === 0 || g.buyPrice) totalAsset += Number(g.buyPrice);
      if (g.expireEnabled && g.expireDate && g._expireState === 'soon') expireSoon += 1;
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

    this.setData({
      summary: {
        totalAsset: totalAsset.toFixed(2),
        totalCount: modeGoods.length,
        expireSoonCount: expireSoon,
        todayCost: todayCost.toFixed(2),
        maxDailyCost: maxDaily.toFixed(2),
        maxDailyName: maxName
      },
      catCounts: catCounts
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
      
      const gType = g.type || (g.buyPrice != null ? 'roi' : 'expire'); 
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
