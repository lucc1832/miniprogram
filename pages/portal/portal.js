Page({
  go(e) {
    const url = e.currentTarget.dataset.url;
    console.log("tap url =", url); // ✅ 用来确认点击是否触发
    if (!url) {
      wx.showToast({ title: "缺少 data-url", icon: "none" });
      return;
    }
    wx.navigateTo({
      url,
      fail(err) {
        console.log("navigateTo fail:", err);
        wx.showToast({ title: "跳转失败，看控制台", icon: "none" });
      }
    });
  },

  toast() {
    wx.showToast({ title: "这个入口预留给下个模块", icon: "none" });
  }
});
