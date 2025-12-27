const db = wx.cloud.database();
const { todayStr } = require('../../../utils/date');

Page({
  data: {
    // ✅ 新增：编辑模式
    isEdit: false,
    goodsId: '',

    categories: [],
    catNames: [],
    catIndex: 0,

    modeNames: ['不计算回本', '按单次价值回本', '按替代成本回本'],
    modeIndex: 0,

    priceEnabled: false,

    form: {
      name: '',
      categoryId: '',

      expireEnabled: true,
      expireDate: '',

      buyPrice: '',
      buyDate: todayStr(),

      // 回本模式
      breakevenMode: 'none', // none / per_use_value / compare_cost
      perUseValue: '',
      compareCost: '',

      status: 'using', // using / archived
      channel: '',
      note: ''
    }
  },

  async onLoad(options) {
    // 1) 先加载分类
    await this.loadCategories();

    // 2) 判断是否编辑
    if (options && options.id) {
      this.setData({ isEdit: true, goodsId: options.id });
      await this.loadGoods(options.id);
      wx.setNavigationBarTitle({ title: '编辑物品' });
    } else {
      wx.setNavigationBarTitle({ title: '添加物品' });
      // 新增时默认购买日期=今天（你也可改）
      this.setData({ 'form.buyDate': todayStr() });
    }
  },

  async loadCategories() {
    const res = await db.collection('categories').orderBy('sort', 'asc').get();
    const categories = res.data || [];
    const catNames = ['未分类', ...categories.map(c => c.name)];
    this.setData({ categories, catNames });
  },

  async loadGoods(id) {
    const res = await db.collection('goods').doc(id).get();
    const g = res.data;

    // priceEnabled：是否填写购买价（你现在用开关控制，这里做回填）
    const priceEnabled = g.buyPrice != null;

    // modeIndex 回填
    const modeMap = { none: 0, per_use_value: 1, compare_cost: 2 };
    const modeIndex = modeMap[g.breakevenMode || 'none'] ?? 0;

    // catIndex 回填
    let catIndex = 0;
    if (g.categoryId) {
      const idx = this.data.categories.findIndex(c => c._id === g.categoryId);
      catIndex = idx >= 0 ? idx + 1 : 0;
    }

    this.setData({
      priceEnabled,
      modeIndex,
      catIndex,
      form: {
        name: g.name || '',
        categoryId: g.categoryId || '',
        expireEnabled: !!g.expireEnabled,
        expireDate: g.expireDate || '',
        buyPrice: g.buyPrice != null ? String(g.buyPrice) : '',
        buyDate: g.buyDate || todayStr(),
        breakevenMode: g.breakevenMode || 'none',
        perUseValue: g.perUseValue != null ? String(g.perUseValue) : '',
        compareCost: g.compareCost != null ? String(g.compareCost) : '',
        status: g.status || 'using',
        channel: g.channel || '',
        note: g.note || ''
      }
    });
  },

  // ---- 表单绑定 ----
  setName(e) { this.setData({ 'form.name': e.detail.value }); },
  setPrice(e) { this.setData({ 'form.buyPrice': e.detail.value }); },
  setPerUse(e) { this.setData({ 'form.perUseValue': e.detail.value }); },
  setCompare(e) { this.setData({ 'form.compareCost': e.detail.value }); },
  setChannel(e) { this.setData({ 'form.channel': e.detail.value }); },
  setNote(e) { this.setData({ 'form.note': e.detail.value }); },

  onCatPick(e) {
    const idx = Number(e.detail.value);
    let cid = '';
    if (idx > 0) cid = this.data.categories[idx - 1]._id;
    this.setData({ catIndex: idx, 'form.categoryId': cid });
  },

  toggleExpire(e) { this.setData({ 'form.expireEnabled': e.detail.value }); },
  pickExpire(e) { this.setData({ 'form.expireDate': e.detail.value }); },

  togglePrice(e) {
    const enabled = e.detail.value;
    this.setData({ priceEnabled: enabled });

    // 关掉购买价：清空回本相关
    if (!enabled) {
      this.setData({
        modeIndex: 0,
        'form.breakevenMode': 'none',
        'form.buyPrice': '',
        'form.perUseValue': '',
        'form.compareCost': ''
      });
    }
  },

  onModePick(e) {
    const idx = Number(e.detail.value);
    const mode = idx === 1 ? 'per_use_value' : idx === 2 ? 'compare_cost' : 'none';
    this.setData({ modeIndex: idx, 'form.breakevenMode': mode });
  },

  pickBuyDate(e) { this.setData({ 'form.buyDate': e.detail.value }); },
  onStatus(e) { this.setData({ 'form.status': e.detail.value }); },

  // ---- 保存：新增 or 更新 ----
  async save() {
    const f = this.data.form;

    if (!f.name || !f.name.trim()) {
      wx.showToast({ title: '请填写物品名称', icon: 'none' }); return;
    }
    if (!f.buyDate) {
      wx.showToast({ title: '请选择购买日期', icon: 'none' }); return;
    }

    // 统一拼 doc
    const doc = {
      name: f.name.trim(),
      categoryId: f.categoryId || '',
      expireEnabled: !!f.expireEnabled,
      expireDate: f.expireEnabled ? (f.expireDate || '') : '',
      buyDate: f.buyDate,
      status: f.status || 'using',
      channel: f.channel || '',
      note: f.note || '',
      updatedAt: Date.now()
    };

    if (this.data.priceEnabled) {
      // buyPrice 必须是数字
      const priceNum = Number(f.buyPrice);
      if (!isFinite(priceNum) || priceNum <= 0) {
        wx.showToast({ title: '购买价格不正确', icon: 'none' }); return;
      }

      doc.buyPrice = priceNum;
      doc.breakevenMode = f.breakevenMode || 'none';
      doc.perUseValue = f.perUseValue !== '' ? Number(f.perUseValue) : null;
      doc.compareCost = f.compareCost !== '' ? Number(f.compareCost) : null;
    } else {
      doc.buyPrice = null;
      doc.breakevenMode = 'none';
      doc.perUseValue = null;
      doc.compareCost = null;
    }

    try {
      if (this.data.isEdit) {
        await db.collection('goods').doc(this.data.goodsId).update({ data: doc });
        wx.showToast({ title: '已更新' });
      } else {
        // 新增时才补 createdAt/累计字段
        await db.collection('goods').add({
          data: {
            ...doc,
            createdAt: Date.now(),
            totalUseCount: 0,
            totalValue: 0,
            breakevenAt: ''
          }
        });
        wx.showToast({ title: '已保存' });
      }

      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error(e);
    }
  },

  // ---- 删除（仅编辑模式）----
  async remove() {
    if (!this.data.isEdit) return;

    const ok = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除？',
        content: '删除后不可恢复',
        confirmText: '删除',
        confirmColor: '#d93026',
        success: (r) => resolve(r.confirm)
      });
    });

    if (!ok) return;

    try {
      await db.collection('goods').doc(this.data.goodsId).remove();

      wx.showToast({ title: '已删除' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' });
      console.error(e);
    }
  }
});
