
const db = wx.cloud.database();

Page({
  data: { exportText:'', importText:'' },

  setImport(e){ this.setData({ importText: e.detail.value }); },

  async exportJson(){
    const [goods, categories, logs] = await Promise.all([
      db.collection('goods').get(),
      db.collection('categories').get(),
      db.collection('use_logs').get()
    ]);
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      categories: categories.data || [],
      goods: goods.data || [],
      use_logs: logs.data || []
    };
    const text = JSON.stringify(payload);
    this.setData({ exportText: text });
    wx.setClipboardData({ data: text });
    wx.showToast({ title:'已复制' });
  },

  async importJson(){
    try{
      const payload = JSON.parse(this.data.importText || '{}');
      const cats = payload.categories || [];
      const goods = payload.goods || [];
      const logs = payload.use_logs || [];
      // 简化导入：直接 add；不做去重。正式版可按 _id 去重/映射
      for (const c of cats) {
        delete c._id;
        await db.collection('categories').add({ data: c });
      }
      for (const g of goods) {
        delete g._id;
        await db.collection('goods').add({ data: g });
      }
      for (const l of logs) {
        delete l._id;
        await db.collection('use_logs').add({ data: l });
      }
      wx.showToast({ title:'导入完成' });
    }catch(e){
      wx.showToast({ title:'JSON格式错误', icon:'none' });
    }
  }
});
