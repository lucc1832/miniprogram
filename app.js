App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库');
      return;
    }
    wx.cloud.init({
      env: "cloud1-8ggiqvtaa1c63dca", 
      traceUser: true,
    });
  },
});