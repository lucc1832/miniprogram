const APP_VERSION = '小小工具箱 v1.1.0';

const EXPORT_KEYS = [
  'user_info',
  'member_info',
  'user_settings',
  'last_sync_time',
  'join_date',
  'anniversary_events_v2',
  'weather_cities',
  'weather_theme',
  'kitchen_orders',
  'today_menu',
  'weight_enabled',
  'weight_hide',
  'weight_current_user',
  'weight_is_bound',
  'weight_partner_name',
  'weight_invite_code',
  'weight_user_profiles',
  'weight_records_enc',
  'weight_key',
  'roi_logs_local',
  'portal_recent_module'
];

const RESET_KEYS = [
  'anniversary_events_v2',
  'anniversary_events',
  'weather_cities',
  'weather_theme',
  'kitchen_orders',
  'today_menu',
  'of_cart_v1',
  'weight_enabled',
  'weight_hide',
  'weight_current_user',
  'weight_is_bound',
  'weight_partner_name',
  'weight_invite_code',
  'weight_last_like_date',
  'weight_received_like_date',
  'weight_user_profiles',
  'weight_records_enc',
  'weight_key',
  'roi_logs_local',
  'portal_recent_module',
  'last_sync_time'
];

Page({
  data: {
    appVersion: APP_VERSION,
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSIjZGVkZWRlIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIvPjxwYXRoIGQ9Ik0yNSA4MCBRNTAgNTAgNzUgODAiIGZpbGw9IiM5OTkiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjQwIiByPSIyMCIgZmlsbD0iIzk5OSIvPjwvc3ZnPg==',
    userInfo: {},
    hasUserInfo: false,
    memberInfo: { isMember: false, name: '普通用户', expireDate: '' },
    stats: { daysJoined: 0, totalRecords: 0, streakDays: 0 },
    settings: { reminder: false, reminderTime: '17:00', theme: '默认' },
    menuGroups: [
      { title: '账号与权益', items: [
        { name: '会员状态', icon: '👑', desc: '未开通', action: 'checkMember' },
        { name: '查看权益', icon: '✨', action: 'showBenefits' }
      ]},
      { title: '数据管理', items: [
        { name: '数据同步', icon: '🔄', desc: '未同步', action: 'syncData' },
        { name: '导出数据', icon: '📤', action: 'exportData' },
        { name: '重置数据', icon: '🗑️', action: 'resetData', danger: true }
      ]},
      { title: '偏好设置', items: [
        { name: '每日提醒', icon: '⏰', type: 'switch', key: 'reminder' },
        { name: '通知时间', icon: '🕔', type: 'time', key: 'reminderTime' },
        { name: '主题偏好', icon: '🎨', desc: '默认', action: 'changeTheme' }
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

  onShow() {
    this.loadUserData();
    this.calculateStats();
  },

  checkCloudMemberStatus() {
    if (!wx.cloud) return;
    const db = wx.cloud.database();

    db.collection('users').where({}).limit(1).get().then(res => {
      if (!res.data || res.data.length === 0) return;

      const userData = res.data[0];
      const memberInfo = {
        isMember: !!userData.isMember,
        name: userData.memberName || '普通用户',
        expireDate: userData.expireDate || ''
      };

      this.setData({ memberInfo });
      wx.setStorageSync('member_info', memberInfo);
      this.updateMenuDesc('会员状态', memberInfo.isMember ? memberInfo.name : '未开通');

      if (!this.data.hasUserInfo && userData.avatarUrl) {
        const userInfo = {
          avatarUrl: userData.avatarUrl,
          nickName: userData.nickName || ''
        };
        this.setData({ userInfo, hasUserInfo: true });
        wx.setStorageSync('user_info', userInfo);
      }
    }).catch(err => {
      console.warn('获取云端会员信息失败', err);
    });
  },

  loadUserData() {
    const userInfo = wx.getStorageSync('user_info');
    const memberInfo = wx.getStorageSync('member_info') || this.data.memberInfo;
    const settings = {
      ...this.data.settings,
      ...(wx.getStorageSync('user_settings') || {})
    };
    const lastSync = wx.getStorageSync('last_sync_time');

    this.setData({
      userInfo: userInfo || {},
      hasUserInfo: !!userInfo,
      memberInfo,
      settings
    });

    this.updateMenuDesc('会员状态', memberInfo.isMember ? memberInfo.name : '未开通');
    this.updateMenuDesc('主题偏好', settings.theme || '默认');
    this.updateMenuDesc('数据同步', lastSync ? `上次 ${lastSync}` : '未同步');
  },

  calculateStats() {
    const joinDate = wx.getStorageSync('join_date') || Date.now();
    wx.setStorageSync('join_date', joinDate);

    const daysJoined = Math.floor((Date.now() - Number(joinDate)) / (1000 * 60 * 60 * 24)) + 1;
    const anniversaryCount = this.getStorageArray('anniversary_events_v2').length;
    const kitchenOrders = this.getStorageArray('kitchen_orders');
    const weightRecords = this.getWeightRecords();
    const weightCount = Object.keys(weightRecords).reduce((sum, key) => {
      return sum + (Array.isArray(weightRecords[key]) ? weightRecords[key].length : 0);
    }, 0);
    const roiLogs = this.getStorageArray('roi_logs_local').length;
    const totalRecords = anniversaryCount + kitchenOrders.length + weightCount + roiLogs;
    const streakDays = Math.max(
      this.calculateWeightStreak(weightRecords),
      this.calculateKitchenStreak()
    );

    this.setData({ stats: { daysJoined, totalRecords, streakDays } });
  },

  getStorageArray(key) {
    const value = wx.getStorageSync(key);
    return Array.isArray(value) ? value : [];
  },

  getWeightRecords() {
    const enc = wx.getStorageSync('weight_records_enc') || '';
    const key = wx.getStorageSync('weight_key') || '';
    if (!enc || !key) return { user1: [], user2: [] };

    try {
      const parsed = JSON.parse(this.xorHexDecode(enc, key));
      if (Array.isArray(parsed)) return { user1: parsed, user2: [] };
      return {
        user1: Array.isArray(parsed.user1) ? parsed.user1 : [],
        user2: Array.isArray(parsed.user2) ? parsed.user2 : []
      };
    } catch (e) {
      console.warn('体重记录解析失败', e);
      return { user1: [], user2: [] };
    }
  },

  xorHexDecode(hex, key) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }

    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
    }
    return str;
  },

  calculateWeightStreak(recordsMap) {
    const allDates = new Set();
    Object.keys(recordsMap).forEach(key => {
      (recordsMap[key] || []).forEach(item => {
        if (item.date) allDates.add(item.date);
      });
    });
    return this.countBackwardStreak(allDates);
  },

  calculateKitchenStreak() {
    const info = wx.getStorageInfoSync();
    const dates = new Set();
    info.keys.forEach(key => {
      if (!key.startsWith('daily_status_')) return;
      const status = wx.getStorageSync(key);
      if (status === 'ordered' || status === 'completed') {
        const dateKey = this.normalizeDateKey(key.replace('daily_status_', ''));
        if (dateKey) dates.add(dateKey);
      }
    });
    return this.countBackwardStreak(dates);
  },

  normalizeDateKey(value) {
    if (!value) return '';
    const datePart = String(value).trim().split(' ')[0].replace(/\//g, '-');
    const parts = datePart.split('-');
    if (parts.length < 3) return datePart;

    const y = parts[0];
    const m = String(parseInt(parts[1], 10)).padStart(2, '0');
    const d = String(parseInt(parts[2], 10)).padStart(2, '0');
    return y && m !== 'NaN' && d !== 'NaN' ? `${y}-${m}-${d}` : '';
  },

  countBackwardStreak(dateSet) {
    let count = 0;
    const current = new Date();

    while (dateSet.has(this.formatDate(current))) {
      count += 1;
      current.setDate(current.getDate() - 1);
    }

    return count;
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  onChooseAvatar(e) {
    const avatarUrl = e && e.detail && e.detail.avatarUrl;
    if (!avatarUrl) {
      wx.showToast({ title: '已取消选择头像', icon: 'none' });
      return;
    }
    const userInfo = { ...(this.data.userInfo || {}), avatarUrl };
    this.setData({ userInfo, hasUserInfo: true });
    wx.setStorageSync('user_info', userInfo);
  },

  onNicknameInput(e) {
    const nickName = e.detail.value;
    const userInfo = { ...(this.data.userInfo || {}), nickName };
    this.setData({ userInfo, hasUserInfo: true });
    wx.setStorageSync('user_info', userInfo);
  },

  handleMenuClick(e) {
    const { action, type } = e.currentTarget.dataset.item;
    if (type) return;
    if (this[action]) this[action]();
    else wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    const settings = { ...this.data.settings, [key]: e.detail.value };
    this.setData({ settings });
    wx.setStorageSync('user_settings', settings);
  },

  onTimeChange(e) {
    const key = e.currentTarget.dataset.key;
    const settings = { ...this.data.settings, [key]: e.detail.value };
    this.setData({ settings });
    wx.setStorageSync('user_settings', settings);
  },

  updateMenuDesc(name, desc) {
    const groups = this.data.menuGroups.map(group => ({
      ...group,
      items: group.items.map(item => item.name === name ? { ...item, desc } : item)
    }));
    this.setData({ menuGroups: groups });
  },

  checkMember() {
    wx.showModal({
      title: '会员状态',
      content: this.data.memberInfo.isMember
        ? `当前为 ${this.data.memberInfo.name}\n到期时间：${this.data.memberInfo.expireDate || '长期'}`
        : '当前是普通用户，所有本地功能可正常使用。',
      showCancel: false
    });
  },

  showBenefits() {
    wx.showModal({
      title: '工具箱权益',
      content: '当前版本已开放本地记录、数据导出、趋势查看和模块入口。后续可把云同步、家庭协作和更多主题放到会员体系里。',
      showCancel: false
    });
  },

  syncData() {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    wx.setStorageSync('last_sync_time', `今日 ${timeStr}`);
    this.updateMenuDesc('数据同步', `上次 今日 ${timeStr}`);
    this.calculateStats();
    wx.showToast({ title: '本地数据已刷新', icon: 'success' });
  },

  exportData() {
    const info = wx.getStorageInfoSync();
    const snapshot = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      keys: {}
    };

    info.keys.forEach(key => {
      if (EXPORT_KEYS.includes(key) || key.startsWith('daily_status_')) {
        snapshot.keys[key] = wx.getStorageSync(key);
      }
    });

    wx.setClipboardData({
      data: JSON.stringify(snapshot, null, 2),
      success: () => {
        wx.showModal({
          title: '导出完成',
          content: '已把本机数据备份复制到剪贴板，你可以粘贴保存。',
          showCancel: false
        });
      }
    });
  },

  resetData() {
    wx.showModal({
      title: '重置本机数据',
      content: '将清空纪念日、天气城市、厨房记录、体重记录、购物车和最近使用；头像昵称与会员状态会保留。',
      confirmText: '确认清空',
      confirmColor: '#E5484D',
      success: (res) => {
        if (!res.confirm) return;

        const info = wx.getStorageInfoSync();
        info.keys.forEach(key => {
          if (RESET_KEYS.includes(key) || key.startsWith('weather_cache_') || key.startsWith('daily_status_')) {
            wx.removeStorageSync(key);
          }
        });

        this.loadUserData();
        this.calculateStats();
        wx.showToast({ title: '已清空记录', icon: 'success' });
      }
    });
  },

  changeTheme() {
    wx.showActionSheet({
      itemList: ['默认', '清爽蓝', '暖阳橙'],
      success: (res) => {
        const theme = ['默认', '清爽蓝', '暖阳橙'][res.tapIndex];
        const settings = { ...this.data.settings, theme };
        this.setData({ settings });
        wx.setStorageSync('user_settings', settings);
        this.updateMenuDesc('主题偏好', theme);
      }
    });
  },

  showTutorial() {
    wx.showModal({
      title: '新手教程',
      content: '首页选择模块；个人中心可查看统计、导出备份和重置本机数据；每个模块的数据会优先保存在本机。',
      showCancel: false
    });
  },

  feedback() {
    wx.showModal({
      title: '意见反馈',
      content: '可以把想优化的页面、功能或报错截图发给开发者继续迭代。',
      showCancel: false
    });
  },

  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '当前是个人工具箱项目，建议先通过微信开发者工具控制台截图定位问题。',
      showCancel: false
    });
  },

  aboutUs() {
    wx.showModal({
      title: '关于',
      content: `${APP_VERSION}\n一个整合生活记录、天气、厨房和纪念日的小工具箱。`,
      showCancel: false
    });
  }
});
