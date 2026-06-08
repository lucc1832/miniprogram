const APP_VERSION = '小小工具箱 v1.1.0';
const cloudStore = require('../../utils/cloudStore.js');

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
  'period_records_enc',
  'period_settings_enc',
  'period_private_key',
  'roi_logs_local',
  'portal_recent_module'
];

const RESET_PRESERVE_KEYS = [
  'cloud_openid'
];

const DEFAULT_MEMBER_INFO = {
  isMember: false,
  name: '普通用户',
  expireDate: ''
};

const DEFAULT_SETTINGS = {
  reminder: false,
  reminderTime: '17:00',
  theme: '默认'
};

const BASE_MENU_GROUPS = [
  {
    title: '账号与权益',
    subtitle: '账号、会员和个人权益',
    items: [
      { name: '云端账号', icon: '📱', desc: '未登录', action: 'bindAccount' },
      { name: '会员状态', icon: '👑', desc: '未开通', action: 'checkMember' },
      { name: '查看权益', icon: '✨', desc: '功能说明', action: 'showBenefits' }
    ]
  },
  {
    title: '偏好设置',
    subtitle: '提醒时间和显示偏好',
    items: [
      { name: '每日提醒', icon: '⏰', type: 'switch', key: 'reminder' },
      { name: '通知时间', icon: '🕔', type: 'time', key: 'reminderTime' },
      { name: '主题偏好', icon: '🎨', desc: '默认', action: 'changeTheme' }
    ]
  },
  {
    title: '支持与反馈',
    subtitle: '教程、反馈和版本信息',
    items: [
      { name: '新手教程', icon: '📖', desc: '快速了解', action: 'showTutorial' },
      { name: '意见反馈', icon: '📝', desc: '继续优化', action: 'feedback' },
      { name: '联系客服', icon: '🎧', desc: '问题定位', action: 'contactService' },
      { name: '关于我们', icon: 'ℹ️', desc: APP_VERSION, action: 'aboutUs' }
    ]
  }
];

const DATA_ACTIONS = [
  { name: '同步云端', icon: '🔄', desc: '上传当前全部数据', action: 'syncData', primary: true },
  { name: '云端恢复', icon: '☁️', desc: '登录账号后恢复', action: 'restoreCloudData', primary: true },
  { name: '导出备份', icon: '📤', desc: '复制一份本机数据', action: 'exportData' },
  { name: '清空数据', icon: '🗑️', desc: '备份后清空全部数据', action: 'resetData', danger: true }
];

function cloneMenuGroups() {
  return BASE_MENU_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => ({ ...item }))
  }));
}

function cloneDataActions(lastSync) {
  return DATA_ACTIONS.map(item => ({
    ...item,
    desc: item.action === 'syncData' && lastSync ? `上次 ${lastSync}` : item.desc
  }));
}

function buildMenuGroups(account, memberInfo, settings, lastSync) {
  const groups = cloneMenuGroups();
  groups.forEach(group => {
    group.items.forEach(item => {
      if (item.name === '云端账号') item.desc = account.phoneMask || '未登录';
      if (item.name === '会员状态') item.desc = memberInfo.isMember ? memberInfo.name : '未开通';
      if (item.name === '主题偏好') item.desc = settings.theme || '默认';
      if (item.name === '数据同步') item.desc = lastSync ? `上次 ${lastSync}` : '未同步';
    });
  });
  return groups;
}

Page({
  accountResolve: null,

  data: {
    appVersion: APP_VERSION,
    defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSIjZGVkZWRlIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIvPjxwYXRoIGQ9Ik0yNSA4MCBRNTAgNTAgNzUgODAiIGZpbGw9IiM5OTkiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjQwIiByPSIyMCIgZmlsbD0iIzk5OSIvPjwvc3ZnPg==',
    userInfo: {},
    hasUserInfo: false,
    memberInfo: DEFAULT_MEMBER_INFO,
    accountInfo: { accountId: '', phoneMask: '' },
    stats: { daysJoined: 0, totalRecords: 0, streakDays: 0 },
    settings: DEFAULT_SETTINGS,
    lastSyncLabel: '未同步',
    menuGroups: cloneMenuGroups(),
    dataActions: cloneDataActions(''),

    modalVisible: false,
    modalType: 'info',
    modalIcon: '✨',
    modalTitle: '',
    modalDesc: '',
    modalPrimary: '知道了',
    modalSecondary: '取消',
    modalDanger: false,
    modalBusy: false,
    modalPayload: null,
    accountError: '',
    accountMode: 'login',
    accountPhoneInput: '',
    accountPasswordInput: '',
    accountPasswordConfirmInput: ''
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
    if (!cloudStore.getAccountInfo().accountId) return;

    cloudStore.getUserRows('users').then(list => {
      if (!list || list.length === 0) return;

      const userData = list[0];
      const memberInfo = {
        isMember: !!userData.isMember,
        name: userData.memberName || '普通用户',
        expireDate: userData.expireDate || ''
      };

      wx.setStorageSync('member_info', memberInfo);
      this.loadUserData();

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
    const rawUserInfo = wx.getStorageSync('user_info');
    const rawMemberInfo = wx.getStorageSync('member_info');
    const rawSettings = wx.getStorageSync('user_settings');
    const userInfo = rawUserInfo && typeof rawUserInfo === 'object' ? rawUserInfo : {};
    const memberInfo = {
      ...DEFAULT_MEMBER_INFO,
      ...(rawMemberInfo && typeof rawMemberInfo === 'object' ? rawMemberInfo : {})
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(rawSettings && typeof rawSettings === 'object' ? rawSettings : {})
    };
    const lastSync = wx.getStorageSync('last_sync_time') || '';
    const accountInfo = cloudStore.getAccountInfo();

    this.setData({
      userInfo,
      hasUserInfo: !!(userInfo && (userInfo.avatarUrl || userInfo.nickName)),
      memberInfo,
      accountInfo,
      settings,
      lastSyncLabel: lastSync || '未同步',
      menuGroups: buildMenuGroups(accountInfo, memberInfo, settings, lastSync),
      dataActions: cloneDataActions(lastSync)
    });
  },

  calculateStats() {
    let joinDate = wx.getStorageSync('join_date');
    if (!joinDate) {
      if (this.resettingLocalData) {
        this.setData({ stats: { daysJoined: 0, totalRecords: 0, streakDays: 0 } });
        return;
      }
      joinDate = Date.now();
      wx.setStorageSync('join_date', joinDate);
    }

    const daysJoined = Math.floor((Date.now() - Number(joinDate)) / (1000 * 60 * 60 * 24)) + 1;
    const anniversaryCount = this.getStorageArray('anniversary_events_v2').length;
    const kitchenOrders = this.getStorageArray('kitchen_orders');
    const weightRecords = this.getWeightRecords();
    const weightCount = Object.keys(weightRecords).reduce((sum, key) => {
      return sum + (Array.isArray(weightRecords[key]) ? weightRecords[key].length : 0);
    }, 0);
    const periodCount = this.getPeriodRecords().length;
    const roiLogs = this.getStorageArray('roi_logs_local').length;
    const totalRecords = anniversaryCount + kitchenOrders.length + weightCount + periodCount + roiLogs;
    const streakDays = Math.max(
      this.calculateWeightStreak(weightRecords),
      this.calculateKitchenStreak()
    );

    this.setData({ stats: { daysJoined, totalRecords, streakDays } });
  },

  getPeriodRecords() {
    const enc = wx.getStorageSync('period_records_enc') || '';
    const key = wx.getStorageSync('period_private_key') || '';
    if (!this.isHexPayload(enc) || !key) return [];

    try {
      const parsed = JSON.parse(this.xorHexDecode(enc, key));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('月经记录解析失败', e);
      return [];
    }
  },

  isHexPayload(value) {
    return typeof value === 'string' && value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
  },

  getStorageArray(key) {
    const value = wx.getStorageSync(key);
    return Array.isArray(value) ? value : [];
  },

  getWeightRecords() {
    const enc = wx.getStorageSync('weight_records_enc') || '';
    const key = wx.getStorageSync('weight_key') || '';
    if (!enc || !key || !this.isHexPayload(enc)) return { user1: [], user2: [] };

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

  chooseAvatarImage() {
    const setAvatar = avatarUrl => {
      if (!avatarUrl) return;
      const userInfo = { ...(this.data.userInfo || {}), avatarUrl };
      this.setData({ userInfo, hasUserInfo: true });
      wx.setStorageSync('user_info', userInfo);
    };
    const handleFail = err => {
      if (err && /cancel/i.test(err.errMsg || err.message || '')) return;
      wx.showToast({ title: '头像选择失败', icon: 'none' });
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => {
          const file = res.tempFiles && res.tempFiles[0];
          setAvatar(file && file.tempFilePath);
        },
        fail: handleFail
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => setAvatar(res.tempFilePaths && res.tempFilePaths[0]),
      fail: handleFail
    });
  },

  onChooseAvatar(e) {
    const avatarUrl = e && e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
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
    const item = e.currentTarget.dataset.item || {};
    if (item.type) return;
    if (item.action && this[item.action]) this[item.action]();
    else wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  handleDataAction(e) {
    const item = e.currentTarget.dataset.item || {};
    if (item.action && this[item.action]) this[item.action]();
  },

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    const settings = { ...this.data.settings, [key]: e.detail.value };
    wx.setStorageSync('user_settings', settings);
    this.loadUserData();
  },

  onTimeChange(e) {
    const key = e.currentTarget.dataset.key;
    const settings = { ...this.data.settings, [key]: e.detail.value };
    wx.setStorageSync('user_settings', settings);
    this.loadUserData();
  },

  updateMenuDesc(name, desc) {
    const groups = this.data.menuGroups.map(group => ({
      ...group,
      items: group.items.map(item => item.name === name ? { ...item, desc } : item)
    }));
    this.setData({ menuGroups: groups });
  },

  noop() {},

  openModal(config) {
    this.setData({
      modalVisible: true,
      modalType: config.type || 'info',
      modalIcon: config.icon || '✨',
      modalTitle: config.title || '',
      modalDesc: config.desc || '',
      modalPrimary: config.primary || '知道了',
      modalSecondary: config.secondary || '取消',
      modalDanger: !!config.danger,
      modalBusy: false,
      modalPayload: config.payload || null,
      accountError: '',
      accountMode: config.accountMode || this.data.accountMode || 'login',
      accountPhoneInput: config.keepPhone ? this.data.accountPhoneInput : '',
      accountPasswordInput: '',
      accountPasswordConfirmInput: ''
    });
  },

  closeModal() {
    if (this.accountResolve) {
      this.accountResolve(null);
      this.accountResolve = null;
    }

    this.setData({
      modalVisible: false,
      modalBusy: false,
      accountError: '',
      modalPayload: null
    });
  },

  closeModalSilently() {
    this.setData({
      modalVisible: false,
      modalBusy: false,
      accountError: '',
      modalPayload: null
    });
  },

  async confirmModal() {
    if (this.data.modalBusy) return;
    const payload = this.data.modalPayload || {};

    if (this.data.modalType === 'account') {
      await this.confirmAccountAuth();
      return;
    }

    if (this.data.modalType === 'accountManage') {
      this.openAccountBindModal('登录或注册新的云端账号后，会自动恢复这个账号的数据。', 'login');
      return;
    }

    if (this.data.modalType === 'confirm') {
      if (payload.action === 'restore') {
        await this.doRestoreCloudData();
        return;
      }
      if (payload.action === 'reset') {
        await this.doResetData();
        return;
      }
    }

    this.closeModal();
  },

  openResultModal(title, desc, options = {}) {
    this.openModal({
      type: 'result',
      icon: options.icon || '✅',
      title,
      desc,
      primary: options.primary || '知道了',
      secondary: '',
      danger: !!options.danger
    });
  },

  openConfirmModal(config) {
    this.openModal({
      type: 'confirm',
      icon: config.icon || (config.danger ? '⚠️' : '☁️'),
      title: config.title,
      desc: config.desc,
      primary: config.primary || '确认',
      secondary: config.secondary || '取消',
      danger: !!config.danger,
      payload: { action: config.action }
    });
  },

  bindAccount() {
    const account = cloudStore.getAccountInfo();
    if (account.accountId) {
      this.openModal({
        type: 'accountManage',
        icon: '📱',
        title: '账号已登录',
        desc: '数据同步、恢复和清空都会按当前云端账号隔离。更换账号需要重新输入手机号和密码。',
        primary: '切换账号',
        secondary: '关闭'
      });
      return;
    }

    this.promptAccountAuth();
  },

  openAccountBindModal(message, mode = 'login') {
    this.openModal({
      type: 'account',
      icon: '🔐',
      title: '云端账号',
      desc: message || '登录或注册后，数据只会同步和恢复到这个云端账号。',
      primary: mode === 'register' ? '注册并恢复' : '登录并恢复',
      secondary: '暂不登录',
      accountMode: mode
    });
  },

  promptAccountAuth(message) {
    return new Promise(resolve => {
      this.accountResolve = resolve;
      this.openAccountBindModal(message, 'login');
    });
  },

  switchAccountMode(e) {
    const mode = e.currentTarget.dataset.mode || 'login';
    this.setData({
      accountMode: mode,
      modalPrimary: mode === 'register' ? '注册并恢复' : '登录并恢复',
      accountError: '',
      accountPasswordInput: '',
      accountPasswordConfirmInput: ''
    });
  },

  onAccountPhoneInput(e) {
    this.setData({
      accountPhoneInput: e.detail.value,
      accountError: ''
    });
  },

  onAccountPasswordInput(e) {
    this.setData({
      accountPasswordInput: e.detail.value,
      accountError: ''
    });
  },

  onAccountPasswordConfirmInput(e) {
    this.setData({
      accountPasswordConfirmInput: e.detail.value,
      accountError: ''
    });
  },

  async confirmAccountAuth() {
    if (this.data.modalBusy) return;
    const phone = this.data.accountPhoneInput || '';
    const password = this.data.accountPasswordInput || '';
    const mode = this.data.accountMode || 'login';

    if (mode === 'register' && password !== this.data.accountPasswordConfirmInput) {
      this.setData({ accountError: '两次输入的密码不一致' });
      return;
    }

    this.setData({ modalBusy: true, accountError: '' });
    wx.showLoading({ title: mode === 'register' ? '注册中' : '登录中' });

    try {
      const account = mode === 'register'
        ? await cloudStore.registerAccount(phone, password)
        : await cloudStore.loginAccount(phone, password);
      const resolver = this.accountResolve;
      this.accountResolve = null;
      this.closeModalSilently();
      this.loadUserData();
      this.checkCloudMemberStatus();
      await this.restoreAfterAccountAuth(account, mode);
      if (resolver) resolver(account);
    } catch (err) {
      this.setData({
        modalBusy: false,
        accountError: err.message || '账号验证失败'
      });
      wx.showToast({ title: err.message || '账号验证失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async restoreAfterAccountAuth(account, mode) {
    wx.showLoading({ title: '恢复数据中' });
    try {
      const result = await cloudStore.restoreAllToLocal({
        overwrite: true,
        includeDeletedFallback: true,
        restoreCollections: true
      });

      this.loadUserData();
      this.calculateStats();

      if (!result.restored) {
        this.openResultModal(
          mode === 'register' ? '注册完成' : '登录完成',
          `${account.phoneMask} 已登录。当前账号暂无云端备份，本机数据会保留；需要备份时点“同步云端”。`,
          { icon: '✅' }
        );
        return;
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      wx.setStorageSync('last_sync_time', `今日 ${timeStr}`);
      this.loadUserData();
      this.calculateStats();

      const localCount = result.localRestored || 0;
      const cloudCount = result.cloudRestore ? result.cloudRestore.documents : 0;
      this.openResultModal(
        mode === 'register' ? '注册并恢复完成' : '登录并恢复完成',
        `已恢复 ${account.phoneMask} 账号下的本机数据 ${localCount} 项、业务记录 ${cloudCount} 条。`,
        { icon: '✅' }
      );
    } catch (err) {
      console.error('auto restore after account auth failed', err);
      this.openResultModal(
        mode === 'register' ? '注册完成，恢复失败' : '登录完成，恢复失败',
        '账号已经登录，但自动恢复没有完成。请检查云端数据库权限，或者稍后在数据管理里手动点“云端恢复”。',
        { icon: '⚠️', danger: true }
      );
    } finally {
      wx.hideLoading();
    }
  },

  async ensureAccountBound(actionName) {
    const account = cloudStore.getAccountInfo();
    if (account.accountId) return account;

    return this.promptAccountAuth(`${actionName || '操作'}需要先登录云端账号。登录成功后会自动恢复这个账号的数据。`);
  },

  async syncData() {
    const account = await this.ensureAccountBound('数据同步');
    if (!account) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    wx.showLoading({ title: '同步中' });

    try {
      const result = await cloudStore.migrateLocalStorage();

      if (result.collectionMissing) {
        this.openResultModal(
          '云端空间未准备好',
          '请先在云开发数据库创建 user_storage 集合，并确认读写权限后再同步。',
          { icon: '⚠️', danger: true }
        );
        return;
      }

      wx.setStorageSync('last_sync_time', `今日 ${timeStr}`);
      const cloudBackup = result.cloudBackup || { documents: 0, failed: 0 };
      const uploadedCount = result.success + cloudBackup.documents;
      this.loadUserData();
      this.calculateStats();
      this.updateMenuDesc('数据同步', `已同步 ${uploadedCount} 项`);

      this.openResultModal(
        result.failed || cloudBackup.failed ? '部分同步完成' : '同步完成',
        result.failed || cloudBackup.failed
          ? `已上传本机 ${result.success} 项、业务记录 ${cloudBackup.documents} 条，失败 ${result.failed + cloudBackup.failed} 项。请检查云端数据权限。`
          : `已把账号 ${account.phoneMask} 的本机 ${result.success} 项、业务记录 ${cloudBackup.documents} 条备份到云端。`
      );
    } catch (e) {
      console.error('cloud sync failed', e);
      this.openResultModal('同步失败', '请确认云端数据存储已开启，并且当前账号有读写权限。', {
        icon: '⚠️',
        danger: true
      });
    } finally {
      wx.hideLoading();
    }
  },

  async restoreCloudData() {
    const account = await this.ensureAccountBound('从云端恢复');
    if (!account) return;

    this.openConfirmModal({
      action: 'restore',
      icon: '☁️',
      title: '从云端恢复',
      desc: `将使用 ${account.phoneMask} 账号的云端备份覆盖本机同名数据。建议先确认当前手机上的数据已经同步。`,
      primary: '开始恢复'
    });
  },

  async doRestoreCloudData() {
    this.setData({ modalBusy: true });
    wx.showLoading({ title: '恢复中' });

    try {
      const result = await cloudStore.restoreAllToLocal({
        overwrite: true,
        includeDeletedFallback: true,
        restoreCollections: true
      });

      if (!result.restored) {
        this.openResultModal(
          '暂无可恢复数据',
          '当前云端账号下还没有可恢复的数据。请先在有数据的设备上点“数据同步”，再回到这里恢复。',
          { icon: 'ℹ️' }
        );
        return;
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      wx.setStorageSync('last_sync_time', `今日 ${timeStr}`);
      this.loadUserData();
      this.calculateStats();
      this.updateMenuDesc('数据同步', `已恢复 ${result.restored} 项`);

      const localCount = result.localRestored || 0;
      const cloudCount = result.cloudRestore ? result.cloudRestore.documents : 0;
      const cloudFailed = result.cloudRestore ? result.cloudRestore.failed : 0;
      this.openResultModal(
        cloudFailed ? '部分恢复完成' : '恢复完成',
        cloudFailed
          ? `已恢复本机 ${localCount} 项、业务记录 ${cloudCount} 条，还有 ${cloudFailed} 类业务数据恢复失败，请检查云端权限。`
          : result.usedDeletedFallback
          ? `已恢复本机 ${localCount} 项、业务记录 ${cloudCount} 条，并找回了之前清空前保留的历史备份。`
          : `已恢复本机 ${localCount} 项、业务记录 ${cloudCount} 条。`
      );
    } catch (e) {
      console.error('cloud restore failed', e);
      this.openResultModal('恢复失败', '请确认云端数据存储已开启，并且当前账号有读写权限。', {
        icon: '⚠️',
        danger: true
      });
    } finally {
      wx.hideLoading();
    }
  },

  buildLocalSnapshot() {
    const info = wx.getStorageInfoSync();
    const snapshot = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      keys: {}
    };

    info.keys.forEach(key => {
      if (this.shouldExportStorageKey(key)) {
        snapshot.keys[key] = wx.getStorageSync(key);
      }
    });
    return snapshot;
  },

  copySnapshotToClipboard(snapshot) {
    return new Promise(resolve => {
      wx.setClipboardData({
        data: JSON.stringify(snapshot, null, 2),
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    });
  },

  async exportData() {
    const snapshot = this.buildLocalSnapshot();
    const copied = await this.copySnapshotToClipboard(snapshot);
    if (!copied) {
      this.openResultModal('导出失败', '暂时无法复制本机备份，请稍后重试。', { icon: '⚠️', danger: true });
      return;
    }
    this.openResultModal('导出完成', '已把本机数据备份复制到剪贴板，可以粘贴保存或发给自己留档。', {
      icon: '📤'
    });
  },

  async resetData() {
    const account = await this.ensureAccountBound('重置前备份');
    if (!account) return;

    this.openConfirmModal({
      action: 'reset',
      icon: '🗑️',
      title: '重置数据',
      desc: `会先把当前数据备份到 ${account.phoneMask}，再清空本机数据、业务记录、账号绑定、头像昵称和会员缓存。`,
      primary: '确认清空',
      danger: true
    });
  },

  async doResetData() {
    this.setData({ modalBusy: true });
    wx.showLoading({ title: '清空中' });

    try {
      const backupResult = await cloudStore.migrateLocalStorage();
      if (backupResult.collectionMissing) {
        this.openResultModal(
          '重置已取消',
          '云端备份空间还没准备好。为避免清空后无法恢复，请先完成云端数据库初始化，再重置。',
          { icon: '⚠️', danger: true }
        );
        return;
      }

      const backupFailed = backupResult.failed + ((backupResult.cloudBackup && backupResult.cloudBackup.failed) || 0);
      if (backupFailed) {
        this.openResultModal(
          '重置已取消',
          '当前数据备份没有全部完成。为避免清空后无法恢复，请先点“数据同步”确认成功，再重置。',
          { icon: '⚠️', danger: true }
        );
        return;
      }

      const snapshotCopied = await this.copySnapshotToClipboard(this.buildLocalSnapshot());
      const info = wx.getStorageInfoSync();
      const keys = info.keys.filter(key => this.shouldResetStorageKey(key));
      const storageClearResult = await cloudStore.clearCurrentStorage(keys);
      const clearResult = await cloudStore.clearCloudCollections();

      cloudStore.runWithoutAutoSync(() => {
        keys.forEach(key => wx.removeStorageSync(key));
      });

      this.resettingLocalData = true;
      try {
        this.loadUserData();
        this.calculateStats();
      } finally {
        this.resettingLocalData = false;
      }

      this.openResultModal(
        clearResult.failed || storageClearResult.failed ? '部分清空完成' : '清空完成',
        clearResult.failed || storageClearResult.failed
          ? `本机已清空 ${keys.length} 项，业务记录已清空 ${clearResult.documents} 条；还有部分云端镜像未清空，请检查云端权限。`
          : `本机已清空 ${keys.length} 项，业务记录已清空 ${clearResult.documents} 条。${snapshotCopied ? '清空前的本机备份也已复制到剪贴板。' : '云端备份已完成，需要找回时重新登录并恢复。'}`,
        { icon: '✅' }
      );
    } catch (e) {
      console.error('reset data failed', e);
      this.openResultModal('清空失败', '请确认云端数据存储已开启，并且当前账号有读写权限。', {
        icon: '⚠️',
        danger: true
      });
    } finally {
      wx.hideLoading();
    }
  },

  shouldExportStorageKey(key) {
    if (!key) return false;
    return EXPORT_KEYS.includes(key)
      || key.startsWith('daily_status_')
      || key.startsWith('weather_cache_')
      || key.startsWith('weather_')
      || key.startsWith('weight_')
      || key.startsWith('period_');
  },

  shouldResetStorageKey(key) {
    if (!key || RESET_PRESERVE_KEYS.includes(key)) return false;
    return true;
  },

  changeTheme() {
    wx.showActionSheet({
      itemList: ['默认', '清爽蓝', '暖阳橙'],
      success: (res) => {
        const theme = ['默认', '清爽蓝', '暖阳橙'][res.tapIndex];
        const settings = { ...this.data.settings, theme };
        wx.setStorageSync('user_settings', settings);
        this.loadUserData();
      }
    });
  },

  checkMember() {
    this.openResultModal(
      '会员状态',
      this.data.memberInfo.isMember
        ? `当前为 ${this.data.memberInfo.name}，到期时间：${this.data.memberInfo.expireDate || '长期'}。`
        : '当前是普通用户，所有本地功能可正常使用。',
      { icon: '👑' }
    );
  },

  showBenefits() {
    this.openResultModal(
      '工具箱权益',
      '当前版本已开放本地记录、数据导出、趋势查看、云端同步和账号隔离。后续可以继续扩展家庭协作、更多主题和会员权益。',
      { icon: '✨' }
    );
  },

  showTutorial() {
    this.openResultModal(
      '新手教程',
      '首页选择模块进入对应功能；个人中心负责账号绑定、云端同步、导出备份和重置本机数据。恢复数据前请先绑定同一个手机号。',
      { icon: '📖' }
    );
  },

  feedback() {
    this.openResultModal(
      '意见反馈',
      '可以把想优化的页面、功能或报错截图发给开发者继续迭代。截图里最好保留控制台报错和当前页面。',
      { icon: '📝' }
    );
  },

  contactService() {
    this.openResultModal(
      '联系客服',
      '当前是个人工具箱项目。遇到问题时，建议先截图页面和开发者工具控制台，方便快速定位。',
      { icon: '🎧' }
    );
  },

  aboutUs() {
    this.openResultModal(
      '关于',
      `${APP_VERSION}\n一个整合生活记录、天气、厨房、纪念日和周期记录的小工具箱。`,
      { icon: 'ℹ️' }
    );
  }
});
