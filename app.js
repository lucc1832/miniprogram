const cloudStore = require('./utils/cloudStore.js');

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

    cloudStore.enableAutoSync();
    const account = cloudStore.getAccountInfo();
    if (account.accountId) {
      cloudStore.restoreAllToLocal({
        overwrite: false,
        includeDeletedFallback: false,
        excludeKeys: ['user_info', 'member_info']
      }).catch(err => {
        console.warn('云端数据补回本机失败', err);
      });
    }
  },
});
