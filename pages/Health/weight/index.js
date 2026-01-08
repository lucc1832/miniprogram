Page({
  data: {
    enabled: true,
    hideNumbers: false,
    currentUser: 'user1', // user1 or user2
    inputWeight: '',
    inputDate: '',
    today: '',
    minDate: '',
    saveDisabled: false,
    isMember: false,
    stats: { max: 0, min: 0, avg: 0 },
    trendDays: 30, // Default to 30 days for better view
    lastDelta: 0,
    records: [], // Current user's records
    allRecords: { user1: [], user2: [] }, // Store both
    // New Features Data
    statusOptions: [
      { val: 'normal', label: '正常', icon: '😊' },
      { val: 'bloated', label: '浮肿', icon: '😫' },
      { val: 'overate', label: '吃多了', icon: '🍕' },
      { val: 'bad_sleep', label: '没睡好', icon: '💤' }
    ],
    selectedStatus: 'normal',
    feedbackText: '',
    bmi: 0,
    bodyFat: 0,
    showProfileModal: false,
    tempProfile: { height: '', gender: 1, birthYear: 1990 },
    userProfiles: { user1: null, user2: null },
    // Dual System Data
    isBound: false,
    inviteCode: '',
    showBindModal: false,
    bindInput: '',
    partnerName: '体重搭子',
    partnerRecord: null, // Latest record of partner
    partnerTodayStatus: 'unrecorded', // 'recorded' | 'unrecorded'
    partnerStreak: 0,
    myStreak: 0,
    interaction: {
      likedToday: false,
      receivedLike: false,
      msg: ''
    }
  },
  onLoad() {
    const today = this.formatDate(new Date());
    const minDate = this.formatDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    const enabled = wx.getStorageSync('weight_enabled');
    const hideNumbers = wx.getStorageSync('weight_hide') || false;
    const currentUser = wx.getStorageSync('weight_current_user') || 'user1';
    
    // Load Dual System State
    const isBound = wx.getStorageSync('weight_is_bound') || false;
    const partnerName = wx.getStorageSync('weight_partner_name') || '体重搭子';
    const myCode = wx.getStorageSync('weight_invite_code') || this.randomKey(6).toUpperCase();
    if (!wx.getStorageSync('weight_invite_code')) {
      wx.setStorageSync('weight_invite_code', myCode);
    }

    this.setData({ 
      today, 
      minDate, 
      inputDate: today, 
      enabled: enabled !== '' ? enabled : true, 
      hideNumbers,
      currentUser,
      isBound,
      partnerName,
      inviteCode: myCode
    });
    this.ensureKey();
    this.loadUserProfiles(); // Load profiles first
    this.loadRecords();
    this.loadMemberStatus();
    this.checkInteraction();
  },
  
  // Dual System Methods
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
    // Simulation: Any code > 4 chars binds successfully
    this.setData({ 
      isBound: true, 
      partnerName: '亲爱的搭子', // Default name after bind
      showBindModal: false 
    });
    wx.setStorageSync('weight_is_bound', true);
    wx.setStorageSync('weight_partner_name', '亲爱的搭子');
    
    // Auto-switch to dual view context if needed, but we keep single view primary
    // Trigger update to show partner stats
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
    // Check if I liked partner today
    const lastLikeDate = wx.getStorageSync('weight_last_like_date');
    const likedToday = lastLikeDate === this.data.today;
    
    // Simulate receiving like (randomly for demo, or based on stored state)
    // For local demo, let's say partner likes you if you recorded today
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
  
  // Update Profile Management
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

  onSwitchUser(e) {
    const user = e.currentTarget.dataset.user;
    if (user === this.data.currentUser) return;
    
    this.setData({ currentUser: user });
    wx.setStorageSync('weight_current_user', user);
    
    // Switch records context
    this.updateCurrentRecords();
    this.checkProfile(); // Check if new user has profile
  },
  
  onStatusSelect(e) {
    this.setData({ selectedStatus: e.currentTarget.dataset.val });
  },

  updateCurrentRecords() {
    const userRecords = this.data.allRecords[this.data.currentUser] || [];
    this.setData({ records: userRecords });
    
    // Set status if today has record
    const todayRecord = userRecords.find(r => r.date === this.data.inputDate);
    if (todayRecord && todayRecord.status) {
      this.setData({ selectedStatus: todayRecord.status });
    } else {
      this.setData({ selectedStatus: 'normal' });
    }

    this.updateSaveDisabled();
    this.updateLastDelta();
    this.calculateStats();
    this.renderChart();
    this.calculateMetrics();
    
    // Set initial feedback
    if (userRecords.length >= 2) {
       const sorted = [...userRecords].sort((a,b)=> a.date.localeCompare(b.date));
       const last = sorted[sorted.length-1];
       const prev = sorted[sorted.length-2];
       this.setFeedback(last.weight, prev.weight);
    } else {
       this.setData({ feedbackText: '开始记录的第一天，加油！🌱' });
    }

    // Update Dual System Stats
    if (this.data.isBound) {
      this.updatePartnerStats();
    }
  },

  updatePartnerStats() {
    // In this local simulation, we treat the "other" user slot as the partner
    // If current is user1, partner is user2, and vice versa.
    const partnerId = this.data.currentUser === 'user1' ? 'user2' : 'user1';
    const partnerRecords = this.data.allRecords[partnerId] || [];
    
    // Check partner today status
    const pToday = partnerRecords.find(r => r.date === this.data.today);
    const partnerTodayStatus = pToday ? 'recorded' : 'unrecorded';
    
    // Partner Streak
    const pStreak = this.calculateStreak(partnerRecords);
    
    // My Streak
    const myStreak = this.calculateStreak(this.data.records);
    
    // Partner Last Record for comparison (simulated privacy: only show change if both recorded today? 
    // Or just show status. User asked for "Today Change" comparison.)
    let partnerChange = null;
    if (partnerRecords.length >= 2) {
      const sorted = [...partnerRecords].sort((a,b)=> a.date.localeCompare(b.date));
      const last = sorted[sorted.length-1];
      const prev = sorted[sorted.length-2];
      // Only show change if last record is TODAY
      if (last.date === this.data.today) {
         partnerChange = (last.weight - prev.weight).toFixed(1);
      }
    }
    
    this.setData({
      partnerTodayStatus,
      partnerStreak: pStreak,
      myStreak,
      partnerRecord: pToday ? { ...pToday, change: partnerChange } : null
    });
  },

  calculateStreak(records) {
    if (!records || records.length === 0) return 0;
    const sorted = [...records].sort((a,b)=> b.date.localeCompare(a.date)); // Descending
    const today = this.data.today;
    const yesterday = this.formatDate(new Date(Date.now() - 24*3600*1000));
    
    let streak = 0;
    // If latest is today, start count. If latest is yesterday, start count. 
    // If latest is older than yesterday, streak is broken (0).
    // Wait, if I recorded today, streak includes today. If I haven't, but recorded yesterday, streak is still valid (just not incremented for today yet? Or is it?)
    // Usually streak means consecutive days ending today or yesterday.
    
    let currentCheck = new Date(today);
    let hasToday = sorted[0].date === today;
    
    if (!hasToday && sorted[0].date !== yesterday) {
       return 0;
    }
    
    // Simple logic: iterate back day by day
    for (let i=0; i<sorted.length; i++) {
       const d = sorted[i].date;
       // We expect d to be consecutive
       // Actually easier: check if sorted[i] matches expected date
    }
    
    // Let's use a simpler approach
    let count = 0;
    let lastDateStr = hasToday ? today : yesterday;
    let lastDate = new Date(lastDateStr);
    
    // If we don't have a record for "lastDateStr", then streak is 0 (unless we are checking today and have yesterday)
    // Re-evaluate:
    // Case 1: Latest is Today. Count backwards.
    // Case 2: Latest is Yesterday. Count backwards.
    // Case 3: Latest is older. Streak 0.
    
    const latest = sorted[0].date;
    if (latest !== today && latest !== yesterday) return 0;
    
    let expected = new Date(latest);
    
    for (let i=0; i<sorted.length; i++) {
      const recDate = sorted[i].date;
      const expectedStr = this.formatDate(expected);
      if (recDate === expectedStr) {
        count++;
        expected.setDate(expected.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
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
    
    // Body Fat: (1.20 × BMI) + (0.23 × Age) - (10.8 × Sex) - 5.4
    // Sex: 1 male, 0 female
    const age = new Date().getFullYear() - p.birthYear;
    const sexVal = p.gender === 1 ? 1 : 0;
    const fat = (1.20 * bmi + 0.23 * age - 10.8 * sexVal - 5.4).toFixed(1);
    
    this.setData({ bmi, bodyFat: fat > 0 ? fat : 0 });
  },

  onToggleEnabled(e) {
    const val = e.detail.value;
    this.setData({ enabled: val });
    wx.setStorageSync('weight_enabled', val);
  },
  onToggleHideNumbers(e) {
    const val = e.detail.value;
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
    this.setData({ saveDisabled: !!existing });
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
    let allData = { user1: [], user2: [] };
    
    if (enc) {
      try {
        const json = this.xorHexDecode(enc, this.key);
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          // Migration: Old format was just an array, assign to user1
          allData.user1 = parsed;
        } else if (parsed && typeof parsed === 'object') {
          // New format
          allData = { ...allData, ...parsed };
        }
      } catch(e) { 
        console.error('Load records failed', e);
        allData = { user1: [], user2: [] };
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
    
    // Remove existing for same date
    let prevWeight = null;
    // Find previous record (not today)
    const sortedPrev = currentRecords.filter(r => r.date < date).sort((a,b)=> a.date.localeCompare(b.date));
    if (sortedPrev.length > 0) {
      prevWeight = sortedPrev[sortedPrev.length-1].weight;
    }

    currentRecords = currentRecords.filter(r => r.date !== date);
    
    // Add new
    currentRecords.push({ date, weight: val, status });
    currentRecords.sort((a,b)=> a.date.localeCompare(b.date));
    
    // Update allRecords
    const allRecords = { ...this.data.allRecords };
    allRecords[user] = currentRecords;
    
    this.setData({ 
      allRecords, 
      records: currentRecords, 
      inputWeight: '', 
      saveDisabled: true 
    });
    
    this.saveRecords(allRecords);
    this.updateLastDelta();
    this.calculateStats();
    this.renderChart();
    this.calculateMetrics();
    
    if (prevWeight !== null) {
      this.setFeedback(val, prevWeight);
    } else {
      this.setData({ feedbackText: '开始记录的第一天，加油！🌱' });
    }
    
    wx.showToast({ title: '记录成功', icon: 'success' });
  },
  calculateStats() {
    if (!this.data.isMember || this.data.records.length === 0) { 
      this.setData({ stats: { max: 0, min: 0, avg: 0 }});
      return; 
    }
    const arr = this.data.records.map(r => r.weight);
    const max = Math.max(...arr);
    const min = Math.min(...arr);
    const avg = parseFloat((arr.reduce((s,x)=>s+x,0)/arr.length).toFixed(1));
    this.setData({ stats: { max, min, avg } });
  },
  updateLastDelta() {
    if (this.data.records.length < 2) { this.setData({ lastDelta: 0 }); return; }
    const sorted = [...this.data.records].sort((a,b)=> a.date.localeCompare(b.date));
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
    const query = wx.createSelectorQuery();
    query.select('#trendChart').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0]) return;
      const canvas = res[0].node;
      const width = res[0].width;
      const height = res[0].height;
      const ctx = canvas.getContext('2d');
      canvas.width = width * 2;
      canvas.height = height * 2;
      ctx.scale(2,2);
      ctx.clearRect(0,0,width,height);
      const endDate = new Date(this.data.today);
      const startDate = new Date(endDate.getTime() - (this.data.trendDays-1)*24*60*60*1000);
      const points = [];
      const map = new Map(this.data.records.map(r=>[r.date, r.weight]));
      for (let i=0;i<this.data.trendDays;i++){
        const d = new Date(startDate.getTime()+i*24*60*60*1000);
        const ds = this.formatDate(d);
        const w = map.has(ds)? map.get(ds): null;
        points.push({ ds, w });
      }
      const vals = points.filter(p=>p.w!=null).map(p=>p.w);
      if (vals.length === 0) return;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const pad = 0.5;
      const yMin = min - pad;
      const yMax = max + pad;
      const toX = (i)=> 20 + i*(width-40)/(this.data.trendDays-1);
      const toY = (v)=> height-20 - (v - yMin)/(yMax - yMin) * (height-40);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6b5cff';
      ctx.beginPath();
      let started=false;
      points.forEach((p,i)=>{
        if (p.w==null) return;
        const x = toX(i);
        const y = toY(p.w);
        if (!started){ ctx.moveTo(x,y); started=true; } else { ctx.lineTo(x,y); }
      });
      ctx.stroke();
      if (!this.data.hideNumbers) {
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`范围 ${min}~${max} kg`, 20, 20);
      }
    });
  },
  ensureKey() {
    let key = wx.getStorageSync('weight_key');
    if (!key) {
      key = this.randomKey(32);
      wx.setStorageSync('weight_key', key);
    }
    this.key = key;
  },
  randomKey(n) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i=0;i<n;i++){ s += chars[Math.floor(Math.random()*chars.length)]; }
    return s;
  },
  xorHexEncode(str, key) {
    const out = [];
    for (let i=0;i<str.length;i++){
      const kc = key.charCodeAt(i % key.length);
      const bc = str.charCodeAt(i) ^ kc;
      out.push(bc.toString(16).padStart(2,'0'));
    }
    return out.join('');
  },
  xorHexDecode(hex, key) {
    const bytes = [];
    for (let i=0;i<hex.length;i+=2){
      bytes.push(parseInt(hex.slice(i,i+2),16));
    }
    let s = '';
    for (let i=0;i<bytes.length;i++){
      const kc = key.charCodeAt(i % key.length);
      s += String.fromCharCode(bytes[i] ^ kc);
    }
    return s;
  },
  
  saveRecords(arr) {
    const json = JSON.stringify(arr);
    const enc = this.xorHexEncode(json, this.key);
    wx.setStorageSync('weight_records_enc', enc);
  },
  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  },
  loadMemberStatus() {
    const m = wx.getStorageSync('member_info');
    this.setData({ isMember: !!(m && m.isMember) });
  }
})
