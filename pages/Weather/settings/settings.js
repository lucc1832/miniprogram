const iconManager = require('../../../utils/iconManager');

Page({
  data: {
    themes: [],
    currentTheme: 'emoji'
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    const themes = iconManager.getThemes();
    const currentTheme = wx.getStorageSync('weather_theme') || 'emoji';
    
    this.setData({
      themes,
      currentTheme
    });
  },

  onSelectTheme(e) {
    const themeId = e.currentTarget.dataset.id;
    this.setData({ currentTheme: themeId });
    wx.setStorageSync('weather_theme', themeId);
    
    wx.showToast({
      title: '已应用主题',
      icon: 'success'
    });
  },
  
  onUploadIcon() {
      wx.showToast({
          title: '演示功能：图标上传',
          icon: 'none'
      });
  }
});
