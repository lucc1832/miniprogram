const cloudStore = require('../../../utils/cloudStore.js');
let { todayStr } = (() => {
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
      }
    };
  }
})();

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
    showCategoryCreator: false,
    newCategoryName: '',
    creatingCategory: false,

    priceEnabled: false,
    recognizing: false,
    ocrSummary: '',

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
    const categories = (await cloudStore.getUserRows('categories'))
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const catNames = ['未分类', ...categories.map(c => c.name), '+ 新增分类'];
    this.setData({ categories, catNames });
  },

  async loadGoods(id) {
    const res = await cloudStore.getUserDoc('goods', id);
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
      this.setData({
        'form.expireEnabled': true,
        priceEnabled: false,
        'form.buyPrice': '',
        'form.status': 'using'
      });
    } else {
      this.setData({
        'form.expireEnabled': false,
        'form.expireDate': '',
        priceEnabled: true,
        'form.status': this.data.form.status || 'using'
      });
    }
  },

  selectType(e) {
    const type = e.currentTarget.dataset.value;
    this.onTypeChange({ detail: { value: type } });
  },

  selectStatus(e) {
    this.setData({ 'form.status': e.currentTarget.dataset.value });
  },

  async chooseReceiptImage() {
    if (this.data.recognizing) return;

    try {
      const filePath = await this.pickReceiptImage();
      if (!filePath) return;

      this.setData({
        recognizing: true,
        ocrSummary: '正在识别截图...'
      });

      const ext = (filePath.match(/\.(\w+)$/) || [])[1] || 'jpg';
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `breakeven_receipts/${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`,
        filePath
      });

      const ocrRes = await this.callOcrFunction(uploadRes.fileID);

      const result = ocrRes.result || {};
      if (!result.ok) {
        const stage = result.stage ? `${result.stage}：` : '';
        throw new Error(stage + (result.message || '截图识别失败'));
      }

      this.applyOcrResult(result.parsed || {});
    } catch (err) {
      console.error('chooseReceiptImage error', err);
      const message = this.getReadableOcrError(err);
      this.setData({
        ocrSummary: message
      });
      wx.showModal({
        title: '无法识别该截图',
        content: `已为您切换为手动填写。\n${message}`,
        showCancel: false,
        confirmText: '继续填写'
      });
    } finally {
      this.setData({ recognizing: false });
    }
  },

  async callOcrFunction(fileID, extraData = {}) {
    const payload = Object.assign({}, extraData, fileID ? { fileID } : {});
    try {
      return await wx.cloud.callFunction({
        name: 'ocrReceipt',
        data: payload
      });
    } catch (err) {
      const message = String(err && (err.errMsg || err.message || ''));
      if (/ocrReceipt|not exist|not found|不存在|找不到/i.test(message)) {
        console.warn('ocrReceipt failed, retry ocrReceip', err);
        return wx.cloud.callFunction({
          name: 'ocrReceip',
          data: payload
        });
      }
      throw err;
    }
  },

  getReadableOcrError(err) {
    const raw = String(err && (err.errMsg || err.message || err) || '');
    console.error('OCR readable error raw:', raw);

    if (/ocrReceip|ocrReceipt|not exist|not found|不存在|找不到/i.test(raw)) {
      return '云函数名称不一致，请检查 ocrReceipt';
    }
    if (/无返回|返回异常|不是最新版本|重新部署/i.test(raw)) {
      return raw.slice(0, 40);
    }
    if (/BAIDU_OCR_API_KEY|BAIDU_OCR_SECRET_KEY|环境变量/i.test(raw)) {
      return '缺少百度OCR环境变量';
    }
    if (/access_token|invalid client|client_id|client_secret/i.test(raw)) {
      return '百度Key配置不正确';
    }
    if (/download|uploadFile|fileID|上传|下载|图片下载/i.test(raw)) {
      return '图片上传或下载失败';
    }
    if (/timeout|ETIMEDOUT|超时/i.test(raw)) {
      return 'OCR请求超时，请重试';
    }
    if (/image size|image format|image/i.test(raw)) {
      return '图片格式或大小不支持';
    }

    return raw ? raw.slice(0, 40) : '识别失败，可以手动填写';
  },

  pickReceiptImage() {
    return new Promise(resolve => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: res => {
            const file = res.tempFiles && res.tempFiles[0];
            resolve(file && file.tempFilePath);
          },
          fail: () => resolve('')
        });
        return;
      }

      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success: res => resolve(res.tempFilePaths && res.tempFilePaths[0]),
        fail: () => resolve('')
      });
    });
  },

  applyOcrResult(parsed) {
    const patch = {};
    const pieces = [];

    if (parsed.name) {
      patch['form.name'] = parsed.name;
      pieces.push('商品名');
    }
    if (parsed.buyDate) {
      patch['form.buyDate'] = parsed.buyDate;
      pieces.push('购买日期');
    }
    if (parsed.buyPrice) {
      patch['form.buyPrice'] = String(parsed.buyPrice);
      patch.priceEnabled = true;
      pieces.push('价格');
    }

    if (this.data.type === 'expire') {
      patch['form.expireEnabled'] = true;
    }

    patch.ocrSummary = pieces.length ? `已识别：${pieces.join('、')}` : '未识别到明确字段，请手动补充';
    this.setData(patch);

    wx.showToast({
      title: pieces.length ? '已自动填入' : '请手动补充',
      icon: 'none'
    });
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
    if (idx === this.data.catNames.length - 1) {
      this.openCategoryCreator();
      return;
    }
    let cid = '';
    if (idx > 0) cid = this.data.categories[idx - 1]._id;
    this.setData({ catIndex: idx, 'form.categoryId': cid });
  },

  openCategoryCreator() {
    this.setData({ showCategoryCreator: true, newCategoryName: '' });
  },

  closeCategoryCreator() {
    this.setData({ showCategoryCreator: false, newCategoryName: '' });
  },

  setNewCategoryName(e) {
    this.setData({ newCategoryName: e.detail.value });
  },

  async createCategory() {
    const name = (this.data.newCategoryName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名', icon: 'none' });
      return;
    }

    const exists = this.data.categories.some(item => item.name === name);
    if (exists) {
      wx.showToast({ title: '分类已存在', icon: 'none' });
      return;
    }

    if (this.data.creatingCategory) return;
    this.setData({ creatingCategory: true });

    try {
      const list = this.data.categories || [];
      const last = list.length ? list[list.length - 1] : null;
      const sort = Number(last && last.sort || 0) + 10;
      const res = await cloudStore.addUserDoc('categories', {
        name,
        sort,
        createdAt: Date.now()
      });

      const category = {
        _id: res._id,
        name,
        sort,
        createdAt: Date.now()
      };
      const categories = [...list, category];
      const catNames = ['未分类', ...categories.map(c => c.name), '+ 新增分类'];

      this.setData({
        categories,
        catNames,
        catIndex: categories.length,
        'form.categoryId': category._id,
        showCategoryCreator: false,
        newCategoryName: ''
      });
      wx.showToast({ title: '已新增' });
    } catch (err) {
      console.error('createCategory error', err);
      wx.showToast({ title: '新增失败', icon: 'none' });
    } finally {
      this.setData({ creatingCategory: false });
    }
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
    if (this.data.type === 'expire' && !f.expireDate) {
      wx.showToast({ title: '请选择到期日期', icon: 'none' }); return;
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

    if (this.data.type === 'roi' && !f.buyPrice) {
      wx.showToast({ title: '请输入购买价格', icon: 'none' }); return;
    }

    if (f.buyPrice) {
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
        await cloudStore.updateUserDoc('goods', this.data.goodsId, doc);
        wx.showToast({ title: '已更新' });
      } else {
        // 新增时才补 createdAt/累计字段
        await cloudStore.addUserDoc('goods', {
          ...doc,
          createdAt: Date.now(),
          totalUseCount: 0,
          totalValue: 0,
          breakevenAt: ''
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
      await cloudStore.removeUserDoc('goods', this.data.goodsId);

      wx.showToast({ title: '已删除' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' });
      console.error(e);
    }
  }
});
