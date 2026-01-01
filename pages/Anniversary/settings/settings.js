Page({
  clearData() {
    wx.showModal({
      title: '警告',
      content: '确定要清空所有纪念日数据吗？此操作不可恢复。',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('anniversary_events_v2');
          wx.showToast({ title: '已清空', icon: 'success' });
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        }
      }
    });
  }
});
