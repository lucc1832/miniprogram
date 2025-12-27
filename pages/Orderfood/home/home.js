Page({
  data: {
    
  },

  onLoad() {
    
  },

  onInvite() {
    wx.showToast({ title: '邀请功能开发中', icon: 'none' });
  },

  onManageMenu() {
    wx.navigateTo({
      url: '/pages/Orderfood/menu/menu'
    });
  },

  onGoOrder() {
    wx.navigateTo({
      url: '/pages/Orderfood/ordering/ordering'
    });
  },

  onRandomFood() {
    wx.showToast({ title: '吃啥呢功能开发中', icon: 'none' });
  },

  onKitchen() {
    wx.showToast({ title: '我的厨房开发中', icon: 'none' });
  },

  onChangeBg() {
    wx.showToast({ title: '换背景功能开发中', icon: 'none' });
  },

  onIngredients() {
    wx.showToast({ title: '食材用料开发中', icon: 'none' });
  },

  onBasket() {
    wx.showToast({ title: '购菜篮开发中', icon: 'none' });
  }
});