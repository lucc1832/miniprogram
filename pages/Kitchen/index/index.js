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

  onLoad(options) {
    if (options && options.from === 'orderFood') {
      this.setData({ currentTab: 1 }); // Switch to Menu tab
    }

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
  },

  // Event handler for children components
  handleSwitchTab(e) {
    const tabIndex = e.detail.tabIndex;
    if (tabIndex !== undefined && tabIndex >= 0 && tabIndex < this.data.tabs.length) {
      this.setData({ currentTab: tabIndex });
    }
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/pages/portal/portal'
      });
    }
  }
})