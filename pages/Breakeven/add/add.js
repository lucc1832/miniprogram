const db = wx.cloud.database();
const { todayStr } = require('../../../utils/date');

Page({
  data: {
    // ✅ 新增：编辑模式
    isEdit: false,
    goodsId: '',

    // 物品类型：expire=到期便签, roi=使用成本
    // 默认是 expire，或者根据入口传入
    type: 'expire',

    categories: [],
    catNames: [],
    catIndex: 0,

    priceEnabled: false,

    form: {
      name: '',
      categoryId: '',

      expireEnabled: false,
      expireDate: '',

      buyPrice: '',
      buyDate: todayStr(),

      status: 'using', // using / archived
      channel: '',
      note: ''
    }
  },

  async onLoad(options) {
    // 1) 先加载分类
    await this.loadCategories();

    // 0) 处理 type 参数 (如果有)
    if (options && options.type) {
      this.setData({ type: options.type });
    }

    // 2) 判断是否编辑
    if (options && options.id) {
      this.setData({ isEdit: true, goodsId: options.id });
      await this.loadGoods(options.id);
      wx.setNavigationBarTitle({ title: '编辑物品' });
    } else {
      wx.setNavigationBarTitle({ title: '添加物品' });
      // 新增时默认购买日期=今天（你也可改）
      this.setData({ 'form.buyDate': todayStr() });
      
      // 如果是新增，根据 type 初始化一些默认开关
      if (this.data.type === 'expire') {
        this.setData({ 'form.expireEnabled': true, priceEnabled: false });
      } else if (this.data.type === 'roi') {
        this.setData({ 'form.expireEnabled': false, priceEnabled: true });
      }
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

    // 兼容旧数据：如果没有 type，根据是否有价格来推测，或者默认为 expire
    // 但既然用户要区分，这里最好显示出来。
    let type = g.type || 'expire';
    // 如果没有 type 字段，可以根据业务逻辑补充：比如有价格就是 roi，否则是 expire?
    // 暂时先信赖 g.type，如果是旧数据可能为空，默认 expire
    
    // 如果是从列表页传了 type 进来（新增），保持 onLoad 里的设置
    // 如果是编辑，使用数据库里的 type
    if (this.data.isEdit && g.type) {
      this.setData({ type: g.type });
    }

    // catIndex 回填
    let catIndex = 0;
    if (g.categoryId) {
      const idx = this.data.categories.findIndex(c => c._id === g.categoryId);
      catIndex = idx >= 0 ? idx + 1 : 0;
    }

    this.setData({
      priceEnabled,
      catIndex,
      form: {
        name: g.name || '',
        categoryId: g.categoryId || '',
        expireEnabled: !!g.expireEnabled,
        expireDate: g.expireDate || '',
        buyPrice: g.buyPrice != null ? String(g.buyPrice) : '',
        roiCycleDays: g.roiCycleDays != null ? String(g.roiCycleDays) : '365',
        buyDate: g.buyDate || todayStr(),
        status: g.status || 'using',
        channel: g.channel || '',
        note: g.note || ''
      }
    });
  },

  onTypeChange(e) {
    const type = e.detail.value;
    this.setData({ type });
    // 切换类型时，可以自动调整一些默认开关，提升体验
    if (type === 'expire') {
      this.setData({ 'form.expireEnabled': true });
      // 这里的 priceEnabled 是否要自动关？看需求。暂时不强制关，用户可能想记账但不算ROI
    } else {
      this.setData({ priceEnabled: true });
    }
  },

  // ---- 表单绑定 ----
  setName(e) { this.setData({ 'form.name': e.detail.value }); },
  setPrice(e) { this.setData({ 'form.buyPrice': e.detail.value }); },
  setCycle(e) { this.setData({ 'form.roiCycleDays': e.detail.value }); },

  calcCycle() {
    const p = Number(this.data.form.buyPrice);
    if (!p || p <= 0) {
      wx.showToast({ title: '请先填写有效价格', icon: 'none' });
      return;
    }
    // 价格 / 365
    let days = Math.round(p / 365);
    if (days < 1) days = 1;
    this.setData({ 'form.roiCycleDays': String(days) });
    wx.showToast({ title: `已设为${days}天`, icon: 'none' });
  },

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
        'form.buyPrice': '',
      });
    }
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
      type: this.data.type, // 保存类型
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
    } else {
      doc.buyPrice = null;
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
