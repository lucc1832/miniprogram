const { getNavigationLayout } = require('../../../utils/layout.js');

Page({
  data: {
    currentTab: 0,
    statusBarHeight: 20,
    navBarHeight: 44,
    homeReady: true,
    menuReady: false,
    diaryReady: false,
    profileReady: false,
    tabs: [
      { id: 0, name: '今日', icon: '📅' },
      { id: 1, name: '点菜', icon: '🍴' },
      { id: 2, name: '食记', icon: '🕓' },
      { id: 3, name: '厨房', icon: '👨‍🍳' }
    ]
  },

  onLoad(options) {
    if (options && options.from === 'orderFood') {
      this.setData({ currentTab: 1, menuReady: true }); // Switch to Menu tab
    }

    const layout = getNavigationLayout();
    
    this.setData({ 
      statusBarHeight: layout.statusBarHeight,
      navBarHeight: layout.navBarHeight
    });
  },

  switchTab(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.activateTab(index);
  },

  // Event handler for children components
  handleSwitchTab(e) {
    const tabIndex = e.detail.tabIndex;
    if (tabIndex !== undefined && tabIndex >= 0 && tabIndex < this.data.tabs.length) {
      this.activateTab(Number(tabIndex));
    }
  },

  activateTab(index) {
    if (index < 0 || index >= this.data.tabs.length) return;

    const readyKeys = ['homeReady', 'menuReady', 'diaryReady', 'profileReady'];
    const readyKey = readyKeys[index];
    const updates = { currentTab: index };

    if (readyKey && !this.data[readyKey]) {
      updates[readyKey] = true;
    }

    if (index !== this.data.currentTab || updates[readyKey]) {
      this.setData(updates);
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
