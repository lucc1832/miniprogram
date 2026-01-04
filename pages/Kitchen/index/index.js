Page({
  data: {
    currentTab: 0,
    statusBarHeight: 20,
    navBarHeight: 44,
    tabs: [
      { id: 0, name: '今日', icon: '📅' },
      { id: 1, name: '点菜', icon: '🍴' },
      { id: 2, name: '食记', icon: '🕓' },
      { id: 3, name: '厨房', icon: '👨‍🍳' }
    ]
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - sysInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    
    this.setData({ 
      statusBarHeight: sysInfo.statusBarHeight,
      navBarHeight: navBarHeight
    });
  },

  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentTab: index });
  }
})