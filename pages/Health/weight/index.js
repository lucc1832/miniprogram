Page({
  data: {
    enabled: true,
    hideNumbers: false,
    inputWeight: '',
    inputDate: '',
    today: '',
    minDate: '',
    saveDisabled: false,
    isMember: false,
    stats: { max: 0, min: 0, avg: 0 },
    trendDays: 7,
    lastDelta: 0,
    records: []
  },
  onLoad() {
    const today = this.formatDate(new Date());
    const minDate = this.formatDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    const enabled = wx.getStorageSync('weight_enabled');
    const hideNumbers = wx.getStorageSync('weight_hide') || false;
    this.setData({ today, minDate, inputDate: today, enabled: enabled !== '' ? enabled : true, hideNumbers });
    this.ensureKey();
    this.loadRecords();
    this.loadMemberStatus();
    this.renderChart();
  },
  onShow() {
    this.renderChart();
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
  commitRecord(val) {
    const date = this.data.inputDate;
    const records = this.data.records.filter(r => r.date !== date);
    records.push({ date, weight: val });
    records.sort((a,b)=> a.date.localeCompare(b.date));
    this.setData({ records, inputWeight: '', saveDisabled: true });
    this.saveRecords(records);
    this.updateLastDelta();
    this.calculateStats();
    this.renderChart();
    wx.showToast({ title: '记录成功', icon: 'none' });
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
  loadRecords() {
    const enc = wx.getStorageSync('weight_records_enc') || '';
    let arr = [];
    if (enc) {
      try {
        const json = this.xorHexDecode(enc, this.key);
        arr = JSON.parse(json);
      } catch(e) { arr = []; }
    }
    this.setData({ records: arr });
    this.updateSaveDisabled();
    this.updateLastDelta();
    this.calculateStats();
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
