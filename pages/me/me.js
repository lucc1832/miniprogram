Page({
  data: {
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSIjZGVkZWRlIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIvPjxwYXRoIGQ9Ik0yNSA4MCBRNTAgNTAgNzUgODAiIGZpbGw9IiM5OTkiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjQwIiByPSIyMCIgZmlsbD0iIzk5OSIvPjwvc3ZnPg==',
    userInfo: null,
    hasUserInfo: false,
    memberInfo: { isMember: false, name: '普通用户', expireDate: '' },
    stats: { daysJoined: 0, totalRecords: 0, streakDays: 0 },
    settings: { reminder: false, reminderTime: '17:00' },
    menuGroups: [
      { title: '会员权益', items: [
        { name: '会员状态', desc: '未开通', action: 'checkMember' },
        { name: '查看权益', icon: '👑', action: 'showBenefits' }
      ]},
      { title: '数据管理', items: [
        { name: '数据同步', desc: '未同步', action: 'syncData' },
        { name: '导出数据', icon: '📤', action: 'exportData' },
        { name: '重置数据', icon: '🗑️', action: 'resetData', danger: true }
      ]},
      { title: '偏好设置', items: [
        { name: '每日提醒', type: 'switch', key: 'reminder' },
        { name: '通知时间', type: 'time', key: 'reminderTime' },
        { name: '主题设置', desc: '默认', action: 'changeTheme' }
      ]},
      { title: '支持与反馈', items: [
        { name: '新手教程', icon: '📖', action: 'showTutorial' },
        { name: '意见反馈', icon: '📝', action: 'feedback' },
        { name: '联系客服', icon: '🎧', action: 'contactService' },
        { name: '关于我们', icon: 'ℹ️', action: 'aboutUs' }
      ]}
    ]
  },
  onLoad() {
    this.loadUserData();
    this.calculateStats();
    this.checkCloudMemberStatus();
  },
  
  checkCloudMemberStatus() {
    if (!wx.cloud) return;
    const db = wx.cloud.database();
    
    // 查询 users 集合（假设你将创建这个集合）
    db.collection('users').where({
      _openid: '{openid}' // 自动匹配当前用户
    }).get().then(res => {
      if (res.data.length > 0) {
        const userData = res.data[0];
        const memberInfo = {
          isMember: userData.isMember || false,
          name: userData.memberName || '普通用户',
          expireDate: userData.expireDate || ''
        };
        
        // 更新本地状态
        this.setData({ memberInfo });
        wx.setStorageSync('member_info', memberInfo);
        this.updateMenuDesc('会员状态', memberInfo.isMember ? memberInfo.name : '未开通');
        
        // 如果云端有头像/昵称且本地没有，也可以同步
        if (!this.data.hasUserInfo && userData.avatarUrl) {
           const userInfo = {
             avatarUrl: userData.avatarUrl,
             nickName: userData.nickName
           };
           this.setData({ userInfo, hasUserInfo: true });
           wx.setStorageSync('user_info', userInfo);
        }
      }
    }).catch(err => {
      console.error('获取云端会员信息失败', err);
      // 可以在这里处理集合不存在的情况，或者网络错误
    });
  },
  onShow() {
    this.calculateStats();
  },
  loadUserData() {
    const userInfo = wx.getStorageSync('user_info');
    if (userInfo) this.setData({ userInfo, hasUserInfo: true });
    const memberInfo = wx.getStorageSync('member_info') || this.data.memberInfo;
    this.setData({ memberInfo });
    this.updateMenuDesc('会员状态', memberInfo.isMember ? memberInfo.name : '未开通');
    const settings = wx.getStorageSync('user_settings') || this.data.settings;
    this.setData({ settings });
  },
  calculateStats() {
    const joinDate = wx.getStorageSync('join_date') || Date.now();
    wx.setStorageSync('join_date', joinDate);
    const daysJoined = Math.floor((Date.now() - joinDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalRecords = 12;
    const streakDays = 3;
    this.setData({ stats: { daysJoined, totalRecords, streakDays } });
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const userInfo = this.data.userInfo || {};
    userInfo.avatarUrl = avatarUrl;
    this.setData({ userInfo, hasUserInfo: true });
    wx.setStorageSync('user_info', userInfo);
  },
  onNicknameInput(e) {
    const nickName = e.detail.value;
    const userInfo = this.data.userInfo || {};
    userInfo.nickName = nickName;
    this.setData({ userInfo, hasUserInfo: true });
    wx.setStorageSync('user_info', userInfo);
  },
  handleMenuClick(e) {
    const { action, type } = e.currentTarget.dataset.item;
    if (type) return;
    if (this[action]) this[action](); else wx.showToast({ title: '功能开发中', icon: 'none' });
  },
  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    const val = e.detail.value;
    const settings = this.data.settings;
    settings[key] = val;
    this.setData({ settings });
    wx.setStorageSync('user_settings', settings);
  },
  onTimeChange(e) {
    const key = e.currentTarget.dataset.key;
    const val = e.detail.value;
    const settings = this.data.settings;
    settings[key] = val;
    this.setData({ settings });
    wx.setStorageSync('user_settings', settings);
  },
  updateMenuDesc(name, desc) {
    const groups = this.data.menuGroups;
    for (let g of groups) {
      for (let item of g.items) {
        if (item.name === name) {
          item.desc = desc;
          this.setData({ menuGroups: groups });
          return;
        }
      }
    }
  },
  checkMember() {
    wx.showModal({
      title: '会员状态',
      content: this.data.memberInfo.isMember ? 
        `当前为 ${this.data.memberInfo.name}\n到期时间：${this.data.memberInfo.expireDate}` : 
        '您当前未开通会员',
      confirmText: '去开通',
      success: (res) => { if (res.confirm) this.showBenefits(); }
    });
  },
  showBenefits() { wx.showToast({ title: '展示会员权益页', icon: 'none' }); },
  syncData() {
    wx.showLoading({ title: '同步中...' });
    setTimeout(() => {
      wx.hideLoading();
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      this.updateMenuDesc('数据同步', '今日 ' + timeStr);
      wx.showToast({ title: '同步成功' });
    }, 1500);
  },
  exportData() {
    if (!this.data.memberInfo.isMember) { wx.showToast({ title: '会员专享功能', icon: 'none' }); return; }
    wx.showToast({ title: '正在导出...', icon: 'loading' });
  },
  resetData() {
    wx.showModal({
      title: '危险操作',
      content: '确定要清空所有数据吗？此操作不可恢复！',
      confirmColor: '#FF0000',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '数据已重置', icon: 'success' });
          this.calculateStats();
        }
      }
    });
  },
  changeTheme() {
    if (!this.data.memberInfo.isMember) { wx.showToast({ title: '会员专享功能', icon: 'none' }); return; }
    wx.showActionSheet({
      itemList: ['默认', '暗黑模式', '粉色回忆'],
      success: (res) => { this.updateMenuDesc('主题设置', ['默认', '暗黑模式', '粉色回忆'][res.tapIndex]); }
    });
  },
  showTutorial() { wx.showToast({ title: '打开教程', icon: 'none' }); },
  feedback() { wx.showToast({ title: '打开反馈页', icon: 'none' }); },
  contactService() { wx.showToast({ title: '联系客服', icon: 'none' }); },
  aboutUs() { wx.showModal({ title: '关于我们', content: '我的厨房 v1.0.0\n让做饭变得更简单有趣。', showCancel: false }); }
});
