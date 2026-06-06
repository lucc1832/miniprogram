const {
  formatDate,
  getDateBefore,
  randomKey,
  xorHexEncode,
  xorHexDecode,
  normalizeRecordStore,
  sortRecords,
  calculateStreak
} = require('./utils.js');
const { drawTrendChart } = require('./chart.js');

const STATUS_OPTIONS = [
  { val: 'normal', label: '正常', icon: '😊' },
  { val: 'bloated', label: '浮肿', icon: '😫' },
  { val: 'overate', label: '吃多了', icon: '🍕' },
  { val: 'bad_sleep', label: '没睡好', icon: '💤' }
];

Page({
  data: {
    hideNumbers: false,
    currentUser: 'user1',
    inputWeight: '',
    inputDate: '',
    today: '',
    minDate: '',
    saveDisabled: false,
    saveButtonText: '保存记录',
    selectedRecord: null,
    trendDays: 30,
    lastDelta: 0,
    records: [],
    allRecords: { user1: [], user2: [] },
    statusOptions: STATUS_OPTIONS,
    selectedStatus: 'normal',
    feedbackText: '',
    bmi: 0,
    bodyFat: 0,
    showProfileModal: false,
    tempProfile: { height: '', gender: 1, birthYear: 1990 },
    userProfiles: { user1: null, user2: null },
    isBound: false,
    inviteCode: '',
    showBindModal: false,
    bindInput: '',
    partnerName: '体重搭子',
    partnerRecord: null,
    partnerTodayStatus: 'unrecorded',
    partnerStreak: 0,
    myStreak: 0,
    interaction: {
      likedToday: false,
      receivedLike: false,
      msg: ''
    }
  },
  onLoad() {
    const today = formatDate(new Date());
    const minDate = getDateBefore(365);
    const hideNumbers = wx.getStorageSync('weight_hide') || false;
    const currentUser = wx.getStorageSync('weight_current_user') || 'user1';
    const isBound = wx.getStorageSync('weight_is_bound') || false;
    const partnerName = wx.getStorageSync('weight_partner_name') || '体重搭子';
    const myCode = wx.getStorageSync('weight_invite_code') || randomKey(6).toUpperCase();
    if (!wx.getStorageSync('weight_invite_code')) {
      wx.setStorageSync('weight_invite_code', myCode);
    }

    this.setData({ 
      today, 
      minDate, 
      inputDate: today, 
      hideNumbers,
      currentUser,
      isBound,
      partnerName,
      inviteCode: myCode
    });
    this.ensureKey();
    this.loadUserProfiles();
    this.loadRecords();
    this.checkInteraction();
  },
  
  showBind() {
    this.setData({ showBindModal: true });
  },
  
  hideBind() {
    this.setData({ showBindModal: false });
  },
  
  onBindInput(e) {
    this.setData({ bindInput: e.detail.value });
  },
  
  confirmBind() {
    if (this.data.bindInput.length < 4) {
      wx.showToast({ title: '请输入有效邀请码', icon: 'none' });
      return;
    }
    this.setData({ 
      isBound: true, 
      partnerName: '亲爱的搭子',
      showBindModal: false 
    });
    wx.setStorageSync('weight_is_bound', true);
    wx.setStorageSync('weight_partner_name', '亲爱的搭子');
    this.updateCurrentRecords(); 
    wx.showToast({ title: '绑定成功！', icon: 'success' });
  },
  
  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'none' })
    });
  },

  checkInteraction() {
    const lastLikeDate = wx.getStorageSync('weight_last_like_date');
    const likedToday = lastLikeDate === this.data.today;
    const receivedLike = wx.getStorageSync('weight_received_like_date') === this.data.today;
    
    this.setData({
      'interaction.likedToday': likedToday,
      'interaction.receivedLike': receivedLike
    });
  },
  
  sendLike() {
    if (this.data.interaction.likedToday) return;
    
    this.setData({ 'interaction.likedToday': true });
    wx.setStorageSync('weight_last_like_date', this.data.today);
    
    const msgs = ['今天也坚持了', '一起加油', '我看到了', '棒棒哒'];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    
    wx.showToast({ title: `已发送: ${msg}`, icon: 'none' });
  },
  
  loadUserProfiles() {
    const profiles = wx.getStorageSync('weight_user_profiles') || { user1: null, user2: null };
    this.setData({ userProfiles: profiles });
  },
  
  checkProfile() {
    const p = this.data.userProfiles[this.data.currentUser];
    if (p) {
      this.setData({ 
        showProfileModal: true, 
        tempProfile: { ...p } 
      });
    } else {
      this.setData({ 
        showProfileModal: true, 
        tempProfile: { height: '', gender: 1, birthYear: 1990 } 
      });
    }
  },
  
  onSaveProfile() {
    const { height, gender, birthYear } = this.data.tempProfile;
    if (!height || height < 50 || height > 250) {
      wx.showToast({ title: '身高不正确', icon: 'none' });
      return;
    }
    const profiles = { ...this.data.userProfiles };
    profiles[this.data.currentUser] = { height: parseFloat(height), gender: parseInt(gender), birthYear: parseInt(birthYear) };
    
    this.setData({ userProfiles: profiles, showProfileModal: false });
    wx.setStorageSync('weight_user_profiles', profiles);
    this.calculateMetrics();
  },
  
  onProfileInput(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail.value;
    this.setData({ [`tempProfile.${field}`]: val });
  },

  onStatusSelect(e) {
    this.setData({ selectedStatus: e.currentTarget.dataset.val });
  },

  updateCurrentRecords() {
    const userRecords = this.data.allRecords[this.data.currentUser] || [];
    const selectedRecord = userRecords.find(record => record.date === this.data.inputDate);
    this.setData({
      records: userRecords,
      selectedStatus: selectedRecord && selectedRecord.status ? selectedRecord.status : 'normal'
    });

    this.updateSaveDisabled();
    this.updateLastDelta();
    this.renderChart();
    this.calculateMetrics();

    if (userRecords.length >= 2) {
      const sorted = sortRecords(userRecords);
      const last = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2];
      this.setFeedback(last.weight, previous.weight);
    } else {
      this.setData({ feedbackText: '开始记录的第一天，加油！🌱' });
    }

    if (this.data.isBound) {
      this.updatePartnerStats();
    }
  },

  updatePartnerStats() {
    const partnerId = this.data.currentUser === 'user1' ? 'user2' : 'user1';
    const partnerRecords = this.data.allRecords[partnerId] || [];
    const todayRecord = partnerRecords.find(record => record.date === this.data.today);
    let partnerChange = null;

    if (partnerRecords.length >= 2) {
      const sorted = sortRecords(partnerRecords);
      const last = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2];
      if (last.date === this.data.today) {
        partnerChange = Number((last.weight - previous.weight).toFixed(1));
      }
    }

    this.setData({
      partnerTodayStatus: todayRecord ? 'recorded' : 'unrecorded',
      partnerStreak: calculateStreak(partnerRecords, this.data.today),
      myStreak: calculateStreak(this.data.records, this.data.today),
      partnerRecord: todayRecord ? { ...todayRecord, change: partnerChange } : null
    });
  },
  
  setFeedback(curr, prev) {
    const diff = curr - prev;
    let text = '';
    if (diff < -0.1) text = '比上次轻了一点点，继续保持 👏';
    else if (diff > 0.1) text = '别怕，体重会波动，明天再看 🌱';
    else text = '体重保持稳定，很棒 👍';
    this.setData({ feedbackText: text });
  },

  calculateMetrics() {
    const p = this.data.userProfiles[this.data.currentUser];
    const records = this.data.records;
    if (!p || !p.height || records.length === 0) {
      this.setData({ bmi: 0, bodyFat: 0 });
      return;
    }
    
    const weight = records[records.length - 1].weight;
    const h = p.height / 100;
    const bmi = (weight / (h * h)).toFixed(1);
    
    const age = new Date().getFullYear() - p.birthYear;
    const sexVal = p.gender === 1 ? 1 : 0;
    const fat = (1.20 * bmi + 0.23 * age - 10.8 * sexVal - 5.4).toFixed(1);
    
    this.setData({ bmi, bodyFat: fat > 0 ? fat : 0 });
  },

  onToggleHideNumbers(e) {
    const val = e && e.detail && typeof e.detail.value === 'boolean'
      ? e.detail.value
      : !this.data.hideNumbers;
    this.setData({ hideNumbers: val });
    wx.setStorageSync('weight_hide', val);
    this.renderChart();
  },
  onWeightInput(e) {
    this.setData({ inputWeight: e.detail.value });
  },
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ inputDate: date });
    this.updateSaveDisabled();
  },
  updateSaveDisabled() {
    const existing = this.data.records.find(r => r.date === this.data.inputDate);
    this.setData({
      saveDisabled: !!existing,
      selectedRecord: existing || null,
      selectedStatus: existing && existing.status ? existing.status : 'normal',
      saveButtonText: existing
        ? (this.data.inputDate === this.data.today ? '今日已记录' : '当天已记录')
        : '保存记录'
    });
  },
  onSaveRecord() {
    const val = parseFloat(this.data.inputWeight);
    if (isNaN(val)) { wx.showToast({ title: '请输入有效体重', icon: 'none' }); return; }
    if (val < 20 || val > 300) {
      wx.showModal({
        title: '确认',
        content: '数值异常（<20 或 >300），是否仍然记录？',
        success: (res) => {
          if (res.confirm) this.commitRecord(val);
        }
      });
      return;
    }
    this.commitRecord(val);
  },
  onShow() {
    this.renderChart();
  },

  loadRecords() {
    const enc = wx.getStorageSync('weight_records_enc') || '';
    let allData = normalizeRecordStore(null);

    if (enc) {
      try {
        allData = normalizeRecordStore(JSON.parse(xorHexDecode(enc, this.key)));
      } catch (e) {
        console.error('Load records failed', e);
      }
    }

    this.setData({ allRecords: allData });
    this.updateCurrentRecords();
  },
  
  commitRecord(val) {
    const date = this.data.inputDate;
    const user = this.data.currentUser;
    const status = this.data.selectedStatus;
    let currentRecords = [...this.data.allRecords[user]];

    const previousRecords = sortRecords(currentRecords.filter(record => record.date < date));
    const previousWeight = previousRecords.length
      ? previousRecords[previousRecords.length - 1].weight
      : null;
    currentRecords = currentRecords.filter(r => r.date !== date);
    currentRecords.push({ date, weight: val, status });
    currentRecords = sortRecords(currentRecords);

    const allRecords = { ...this.data.allRecords };
    allRecords[user] = currentRecords;

    this.setData({ 
      allRecords, 
      records: currentRecords, 
      inputWeight: '', 
      saveDisabled: true,
      selectedRecord: currentRecords.find(r => r.date === date) || null,
      saveButtonText: date === this.data.today ? '今日已记录' : '当天已记录'
    });

    this.saveRecords(allRecords);
    this.updateLastDelta();
    this.renderChart();
    this.calculateMetrics();

    if (previousWeight !== null) {
      this.setFeedback(val, previousWeight);
    } else {
      this.setData({ feedbackText: '开始记录的第一天，加油！🌱' });
    }

    wx.showToast({ title: '记录成功', icon: 'success' });
  },

  updateLastDelta() {
    if (this.data.records.length < 2) { this.setData({ lastDelta: 0 }); return; }
    const sorted = sortRecords(this.data.records);
    const last = sorted[sorted.length-1];
    const prev = sorted[sorted.length-2];
    const delta = parseFloat((last.weight - prev.weight).toFixed(1));
    this.setData({ lastDelta: delta });
  },
  setTrendDays(e) {
    const days = parseInt(e.currentTarget.dataset.days, 10);
    this.setData({ trendDays: days });
    this.renderChart();
  },
  renderChart() {
    drawTrendChart(this);
  },
  ensureKey() {
    let key = wx.getStorageSync('weight_key');
    if (!key) {
      key = randomKey(32);
      wx.setStorageSync('weight_key', key);
    }
    this.key = key;
  },

  saveRecords(arr) {
    const json = JSON.stringify(arr);
    const enc = xorHexEncode(json, this.key);
    wx.setStorageSync('weight_records_enc', enc);
  }
});
