
const cloudStore = require('../../../utils/cloudStore.js');

Page({
  data: { exportText:'', importText:'' },

  setImport(e){ this.setData({ importText: e.detail.value }); },

  async readCollection(name){
    try {
      return await cloudStore.getUserRows(name);
    } catch (e) {
      console.warn(`export collection ${name} failed`, e);
      return [];
    }
  },

  async exportJson(){
    const [goods, categories, roiLogs, useLogs] = await Promise.all([
      this.readCollection('goods'),
      this.readCollection('categories'),
      this.readCollection('roi_logs'),
      this.readCollection('use_logs')
    ]);
    const payload = {
      version: 2,
      exportedAt: Date.now(),
      categories,
      goods,
      roi_logs: roiLogs,
      use_logs: useLogs
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
      const roiLogs = payload.roi_logs || [];
      // 简化导入：直接 add；不做去重。正式版可按 _id 去重/映射
      for (const c of cats) {
        delete c._id;
        await cloudStore.addUserDoc('categories', c);
      }
      for (const g of goods) {
        delete g._id;
        await cloudStore.addUserDoc('goods', g);
      }
      for (const l of logs) {
        delete l._id;
        await cloudStore.addUserDoc('use_logs', l);
      }
      for (const l of roiLogs) {
        delete l._id;
        await cloudStore.addUserDoc('roi_logs', l);
      }
      wx.showToast({ title:'导入完成' });
    }catch(e){
      wx.showToast({ title:'JSON格式错误', icon:'none' });
    }
  }
});
