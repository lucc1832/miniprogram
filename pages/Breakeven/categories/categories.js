
const db = wx.cloud.database();

Page({
  data: {
    categories: [],
    sorting: false,
    showAdd: false,
    newName: ''
  },

  onShow(){ this.load(); },

  async load(){
    const res = await db.collection('categories').orderBy('sort','asc').get();
    this.setData({ categories: res.data || [] });
  },

  toggleSort(){ this.setData({ sorting: !this.data.sorting }); },

  openAdd(){ this.setData({ showAdd:true, newName:'' }); },
  closeAdd(){ this.setData({ showAdd:false }); },
  noop(){},
  setNewName(e){ this.setData({ newName: e.detail.value }); },

  async addCat(){
    const name = (this.data.newName||'').trim();
    if (!name) { wx.showToast({ title:'请输入分类名', icon:'none' }); return; }
    const maxSort = this.data.categories.length ? this.data.categories[this.data.categories.length-1].sort : 0;
    await db.collection('categories').add({ data: { name, sort: (maxSort||0)+10, createdAt: Date.now() } });
    wx.showToast({ title:'已新增' });
    this.closeAdd();
    this.load();
  },

  async delCat(e){
    const id = e.currentTarget.dataset.id;
    // 简化：直接删除；若分类下有物品，建议你后续加校验
    await db.collection('categories').doc(id).remove();
    wx.showToast({ title:'已删除' });
    this.load();
  },

  async moveUp(e){
    const idx = Number(e.currentTarget.dataset.idx);
    if (idx<=0) return;
    const list = this.data.categories.slice();
    const a=list[idx-1], b=list[idx];
    const tmp=a.sort; a.sort=b.sort; b.sort=tmp;
    await Promise.all([
      db.collection('categories').doc(a._id).update({ data: { sort: a.sort }}),
      db.collection('categories').doc(b._id).update({ data: { sort: b.sort }})
    ]);
    this.load();
  },

  async moveDown(e){
    const idx = Number(e.currentTarget.dataset.idx);
    const list = this.data.categories.slice();
    if (idx>=list.length-1) return;
    const a=list[idx], b=list[idx+1];
    const tmp=a.sort; a.sort=b.sort; b.sort=tmp;
    await Promise.all([
      db.collection('categories').doc(a._id).update({ data: { sort: a.sort }}),
      db.collection('categories').doc(b._id).update({ data: { sort: b.sort }})
    ]);
    this.load();
  }
});
