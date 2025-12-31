const db = wx.cloud.database();

const { todayStr } = require('../../../utils/date');

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

    // 固定回本日计算
    // 逻辑变更：周期 = 价格 (Days)
    let breakevenAt = '';
    let cycleDays = 365;
    
    if (good.buyPrice != null) {
        cycleDays = Math.max(1, Math.round(Number(good.buyPrice)));
    }

    if (good.buyPrice != null && good.buyDate) {
      const base = new Date(good.buyDate + 'T00:00:00');
      base.setDate(base.getDate() + cycleDays);
      const yy = base.getFullYear();
      const mm = String(base.getMonth() + 1).padStart(2, '0');
      const dd = String(base.getDate()).padStart(2, '0');
      breakevenAt = `${yy}-${mm}-${dd}`;
      good.breakevenAt = breakevenAt;
    }
    
    // 到期日：购买日 + 1年
    let deadline = '';
    if (good.buyDate) {
      const d = new Date(good.buyDate + 'T00:00:00');
      d.setFullYear(d.getFullYear() + 1);
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      deadline = `${yy}-${mm}-${dd}`;
    }
    // 详情页如果有显示 deadline，可以赋值给 good (目前似乎没用到，但保持逻辑一致)
    good.deadline = deadline;

    // 进度百分比计算 (usedDays / cycleDays)
    const pct = Math.min(100, Math.floor((usedDays / Math.max(1, cycleDays)) * 100));
    const roiPct = isFinite(pct) ? pct : 0;

    // ROI Gap
    const P = Number(good.buyPrice || 0);
    const recovered = (P / cycleDays) * usedDays;
    const gap = Math.max(0, P - recovered);
    const roiGap = gap.toFixed(2);
    const totalValueStr = recovered.toFixed(2);

    this.setData({ good, usedDays, dailyCostStr, totalValueStr, roiGap, roiPct });

    try {
      const today = todayStr();
      const id = this.data.id;
      const latest = await db.collection('roi_logs')
        .where({ goodsId: id })
        .orderBy('date','desc')
        .limit(1)
        .get();
      const last = latest.data && latest.data[0];
      if (!last || last.date !== today || Number(last.pct || 0) !== roiPct) {
        await db.collection('roi_logs').add({
          data: {
            goodsId: id,
            date: today,
            pct: roiPct,
            recovered: Number(totalValueStr),
            gap: Number(roiGap),
            buyPrice: good.buyPrice || 0,
            cycleDays: Math.max(1, usedDays),
            usedDays
          }
        });
      }
    } catch (e) {
      const msg = String(e && (e.errMsg || e.message || ''));
      const code = Number(e && e.errCode);
      const collectionMissing = code === -502005 || /DATABASE_COLLECTION_NOT_EXIST|Db or Table not exist/i.test(msg);
      if (collectionMissing) {
        const today = todayStr();
        const id = this.data.id;
        const logs = wx.getStorageSync('roi_logs_local') || [];
        const map = {};
        logs.forEach(it => { map[`${it.goodsId}_${it.date}`] = it; });
        map[`${id}_${today}`] = {
          goodsId: id,
          date: today,
          pct: roiPct,
          recovered: Number(totalValueStr),
          gap: Number(roiGap),
          buyPrice: good.buyPrice || 0,
          cycleDays: Math.max(1, usedDays),
          usedDays
        };
        wx.setStorageSync('roi_logs_local', Object.values(map));
      }
    }
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
