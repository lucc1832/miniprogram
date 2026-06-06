const RECORD_KEY = 'period_records_enc';
const SETTINGS_KEY = 'period_settings_enc';
const SECRET_KEY = 'period_private_key';
const cloudStore = require('../../../utils/cloudStore.js');

const DEFAULT_SETTINGS = {
  cycleLength: 28,
  periodLength: 5,
  hideSensitive: false
};

Page({
  data: {
    today: '',
    minDate: '',
    settings: DEFAULT_SETTINGS,
    hideSensitive: false,
    records: [],
    recentRecords: [],
    activeRecord: null,
    editingId: '',
    formSheetVisible: false,
    statusTitle: '还没有记录',
    statusMeta: '记录一次开始日期后，会自动估算下次时间',
    currentCycleDay: '--',
    nextDate: '--',
    daysUntil: '--',
    fertileWindow: '--',
    ovulationDate: '--',
    avgCycle: '--',
    avgDuration: '--',
    saveText: '保存记录',
    form: {
      startDate: '',
      hasEndDate: false,
      endDate: '',
      flow: 'medium',
      pain: 0,
      symptoms: [],
      moods: [],
      note: ''
    },
    symptomMap: {},
    moodMap: {},
    flowOptions: [
      { value: 'light', label: '少量' },
      { value: 'medium', label: '正常' },
      { value: 'heavy', label: '偏多' }
    ],
    symptomOptions: [
      { value: 'cramp', label: '腹痛' },
      { value: 'backache', label: '腰酸' },
      { value: 'headache', label: '头痛' },
      { value: 'fatigue', label: '乏力' },
      { value: 'bloating', label: '胀气' },
      { value: 'acne', label: '长痘' }
    ],
    moodOptions: [
      { value: 'stable', label: '稳定' },
      { value: 'sensitive', label: '敏感' },
      { value: 'anxious', label: '焦虑' },
      { value: 'low', label: '低落' }
    ]
  },

  async onLoad() {
    const today = this.formatDate(new Date());
    const min = new Date();
    min.setFullYear(min.getFullYear() - 3);
    await this.ensureKey();
    this.setData({
      today,
      minDate: this.formatDate(min),
      'form.startDate': today,
      'form.endDate': today
    });
    await this.loadSettings();
    await this.loadRecords();
  },

  async ensureKey() {
    let key = wx.getStorageSync(SECRET_KEY);
    if (!key) {
      try {
        key = await cloudStore.get(SECRET_KEY, '');
      } catch (e) {
        console.warn('load period key from cloud failed', e);
      }
    }

    if (!key) {
      key = this.randomKey(32);
    }

    wx.setStorageSync(SECRET_KEY, key);
    this.privateKey = key;
  },

  async loadSettings() {
    const settings = await this.readSecure(SETTINGS_KEY, DEFAULT_SETTINGS);
    this.setData({
      settings: { ...DEFAULT_SETTINGS, ...settings },
      hideSensitive: !!settings.hideSensitive
    });
  },

  async loadRecords() {
    const records = await this.readSecure(RECORD_KEY, []);
    const safeRecords = Array.isArray(records) ? records : [];
    this.setData({ records: safeRecords }, () => this.refreshView());
  },

  saveRecords(records) {
    this.writeSecure(RECORD_KEY, records);
  },

  saveSettings(settings) {
    const next = { ...this.data.settings, ...settings };
    this.setData({ settings: next, hideSensitive: !!next.hideSensitive });
    this.writeSecure(SETTINGS_KEY, next);
    this.refreshView();
  },

  refreshView() {
    const today = this.data.today || this.formatDate(new Date());
    const records = (this.data.records || [])
      .map(item => this.normalizeRecord(item))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    const activeRecord = records.find(item => !item.endDate) || null;
    const latest = activeRecord || records[0] || null;
    const cycleLengths = [];
    const asc = records.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 1; i < asc.length; i++) {
      const days = this.diffDays(asc[i].startDate, asc[i - 1].startDate);
      if (days >= 15 && days <= 60) cycleLengths.push(days);
    }

    const durations = records
      .filter(item => item.endDate)
      .map(item => this.periodDuration(item))
      .filter(days => days > 0 && days <= 20);

    const avgCycle = cycleLengths.length
      ? Math.round(cycleLengths.reduce((sum, n) => sum + n, 0) / cycleLengths.length)
      : Number(this.data.settings.cycleLength || 28);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length)
      : Number(this.data.settings.periodLength || 5);

    let statusTitle = '还没有记录';
    let statusMeta = '记录一次开始日期后，会自动估算下次时间';
    let currentCycleDay = '--';
    let nextDate = '--';
    let daysUntil = '--';
    let fertileWindow = '--';
    let ovulationDate = '--';

    if (latest) {
      const dayInCycle = Math.max(1, this.diffDays(today, latest.startDate) + 1);
      const predictedNext = this.addDays(latest.startDate, avgCycle);
      const remain = this.diffDays(predictedNext, today);
      const ovulation = this.addDays(predictedNext, -14);
      const fertileStart = this.addDays(ovulation, -5);
      const fertileEnd = this.addDays(ovulation, 1);

      currentCycleDay = String(dayInCycle);
      nextDate = this.shortDate(predictedNext);
      ovulationDate = this.shortDate(ovulation);
      fertileWindow = `${this.shortDate(fertileStart)} - ${this.shortDate(fertileEnd)}`;

      if (activeRecord) {
        const periodDay = Math.max(1, this.diffDays(today, activeRecord.startDate) + 1);
        statusTitle = `经期第 ${periodDay} 天`;
        statusMeta = periodDay > avgDuration
          ? '本次持续时间偏长，可以留意身体状态'
          : '正在记录本次经期，结束后点击“今天结束”';
        daysUntil = '进行中';
      } else if (remain >= 0) {
        statusTitle = `预计 ${remain} 天后开始`;
        statusMeta = `根据最近记录估算，下次可能在 ${this.shortDate(predictedNext)}`;
        daysUntil = String(remain);
      } else {
        statusTitle = `预计已延迟 ${Math.abs(remain)} 天`;
        statusMeta = '预测只作参考，如果明显异常建议咨询医生';
        daysUntil = `+${Math.abs(remain)}`;
      }
    }

    const recentRecords = records.slice(0, 8).map(item => ({
      ...item,
      rangeText: item.endDate ? `${this.shortDate(item.startDate)} - ${this.shortDate(item.endDate)}` : `${this.shortDate(item.startDate)} 开始`,
      durationText: item.endDate ? `${this.periodDuration(item)} 天` : '进行中',
      flowText: this.getLabel(this.data.flowOptions, item.flow),
      painText: `${item.pain || 0}/10`,
      symptomText: this.labelsFromValues(this.data.symptomOptions, item.symptoms).join('、') || '无明显症状',
      moodText: this.labelsFromValues(this.data.moodOptions, item.moods).join('、') || '未记录'
    }));

    this.setData({
      records,
      recentRecords,
      activeRecord,
      statusTitle,
      statusMeta,
      currentCycleDay,
      nextDate,
      daysUntil,
      fertileWindow,
      ovulationDate,
      avgCycle: records.length ? `${avgCycle} 天` : '--',
      avgDuration: records.length ? `${avgDuration} 天` : '--'
    });
  },

  normalizeRecord(item) {
    return {
      id: item.id || this.randomKey(12),
      startDate: item.startDate || this.data.today,
      endDate: item.endDate || '',
      flow: item.flow || 'medium',
      pain: Number(item.pain || 0),
      symptoms: Array.isArray(item.symptoms) ? item.symptoms : [],
      moods: Array.isArray(item.moods) ? item.moods : [],
      note: item.note || '',
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now()
    };
  },

  startToday() {
    if (this.data.activeRecord) {
      wx.showToast({ title: '已有进行中的记录', icon: 'none' });
      return;
    }
    const today = this.data.today;
    const record = this.normalizeRecord({
      id: this.randomKey(16),
      startDate: today,
      endDate: '',
      flow: 'medium',
      pain: 0,
      symptoms: [],
      moods: [],
      note: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    const records = [record, ...this.data.records];
    this.setData({ records }, () => {
      this.saveRecords(records);
      this.refreshView();
    });
    wx.showToast({ title: '已开始记录' });
  },

  endToday() {
    const active = this.data.activeRecord;
    if (!active) {
      wx.showToast({ title: '没有进行中的记录', icon: 'none' });
      return;
    }
    const today = this.data.today;
    if (this.diffDays(today, active.startDate) < 0) {
      wx.showToast({ title: '结束日不能早于开始日', icon: 'none' });
      return;
    }
    const records = this.data.records.map(item => item.id === active.id
      ? { ...item, endDate: today, updatedAt: Date.now() }
      : item
    );
    this.setData({ records }, () => {
      this.saveRecords(records);
      this.refreshView();
    });
    wx.showToast({ title: '已结束本次' });
  },

  onStartDate(e) {
    this.setData({ 'form.startDate': e.detail.value });
  },

  openAddRecord() {
    this.setData({
      editingId: '',
      saveText: '保存记录',
      formSheetVisible: true,
      form: this.getDefaultForm()
    }, () => this.updateSelectionMaps());
  },

  closeFormSheet() {
    this.resetForm();
  },

  toggleEndDate(e) {
    this.setData({ 'form.hasEndDate': e.detail.value });
  },

  onEndDate(e) {
    this.setData({ 'form.endDate': e.detail.value });
  },

  pickFlow(e) {
    this.setData({ 'form.flow': e.currentTarget.dataset.value });
  },

  onPainChange(e) {
    this.setData({ 'form.pain': Number(e.detail.value || 0) });
  },

  toggleSymptom(e) {
    this.toggleArrayField('form.symptoms', e.currentTarget.dataset.value);
  },

  toggleMood(e) {
    this.toggleArrayField('form.moods', e.currentTarget.dataset.value);
  },

  toggleArrayField(path, value) {
    const key = path.split('.')[1];
    const list = this.data.form[key] || [];
    const next = list.includes(value)
      ? list.filter(item => item !== value)
      : [...list, value];
    this.setData({ [path]: next }, () => this.updateSelectionMaps());
  },

  updateSelectionMaps() {
    const symptomMap = {};
    const moodMap = {};
    (this.data.form.symptoms || []).forEach(value => { symptomMap[value] = true; });
    (this.data.form.moods || []).forEach(value => { moodMap[value] = true; });
    this.setData({ symptomMap, moodMap });
  },

  noop() {},

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value });
  },

  onSettingInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = Number(e.detail.value || 0);
    this.setData({ [`settings.${field}`]: value });
  },

  saveCycleSettings() {
    const cycleLength = Number(this.data.settings.cycleLength);
    const periodLength = Number(this.data.settings.periodLength);
    if (cycleLength < 15 || cycleLength > 60) {
      wx.showToast({ title: '周期建议在15-60天', icon: 'none' });
      return;
    }
    if (periodLength < 1 || periodLength > 20) {
      wx.showToast({ title: '经期天数建议在1-20天', icon: 'none' });
      return;
    }
    this.saveSettings({ cycleLength, periodLength });
    wx.showToast({ title: '已更新预测' });
  },

  togglePrivacy() {
    this.saveSettings({ hideSensitive: !this.data.hideSensitive });
  },

  savePeriodRecord() {
    const form = this.data.form;
    if (!form.startDate) {
      wx.showToast({ title: '请选择开始日期', icon: 'none' });
      return;
    }
    const endDate = form.hasEndDate ? form.endDate : '';
    if (endDate && this.diffDays(endDate, form.startDate) < 0) {
      wx.showToast({ title: '结束日不能早于开始日', icon: 'none' });
      return;
    }

    const now = Date.now();
    const record = this.normalizeRecord({
      id: this.data.editingId || this.randomKey(16),
      startDate: form.startDate,
      endDate,
      flow: form.flow,
      pain: form.pain,
      symptoms: form.symptoms,
      moods: form.moods,
      note: (form.note || '').trim(),
      createdAt: now,
      updatedAt: now
    });

    const withoutSame = this.data.records.filter(item => {
      if (this.data.editingId) return item.id !== this.data.editingId;
      return item.startDate !== record.startDate;
    });
    const records = [record, ...withoutSame];
    this.setData({ records }, () => {
      this.saveRecords(records);
      this.resetForm();
      this.refreshView();
    });
    wx.showToast({ title: this.data.editingId ? '已更新' : '已保存' });
  },

  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.records.find(item => item.id === id);
    if (!record) return;
    this.setData({
      editingId: id,
      saveText: '更新记录',
      formSheetVisible: true,
      form: {
        startDate: record.startDate,
        hasEndDate: !!record.endDate,
        endDate: record.endDate || this.data.today,
        flow: record.flow,
        pain: record.pain || 0,
        symptoms: record.symptoms || [],
        moods: record.moods || [],
        note: record.note || ''
      }
    }, () => this.updateSelectionMaps());
  },

  cancelEdit() {
    this.resetForm();
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录？',
      content: '删除后不可恢复',
      confirmText: '删除',
      confirmColor: '#d84d4d',
      success: res => {
        if (!res.confirm) return;
        const records = this.data.records.filter(item => item.id !== id);
        this.setData({ records }, () => {
          this.saveRecords(records);
          if (this.data.editingId === id) this.resetForm();
          this.refreshView();
        });
      }
    });
  },

  resetForm() {
    this.setData({
      editingId: '',
      saveText: '保存记录',
      formSheetVisible: false,
      form: this.getDefaultForm()
    }, () => this.updateSelectionMaps());
  },

  getDefaultForm() {
    return {
      startDate: this.data.today,
      hasEndDate: false,
      endDate: this.data.today,
      flow: 'medium',
      pain: 0,
      symptoms: [],
      moods: [],
      note: ''
    };
  },

  periodDuration(record) {
    if (!record || !record.startDate || !record.endDate) return 0;
    return this.diffDays(record.endDate, record.startDate) + 1;
  },

  getLabel(options, value) {
    const item = options.find(option => option.value === value);
    return item ? item.label : '未记录';
  },

  labelsFromValues(options, values) {
    const set = new Set(values || []);
    return options.filter(option => set.has(option.value)).map(option => option.label);
  },

  includes(list, value) {
    return Array.isArray(list) && list.includes(value);
  },

  async readSecure(key, fallback) {
    const candidates = [];

    try {
      const cloudEnc = await cloudStore.get(key, '');
      if (cloudEnc) candidates.push({ source: 'cloud', enc: cloudEnc });
    } catch (e) {
      console.warn('read period data from cloud failed', key, e);
    }

    const localEnc = wx.getStorageSync(key);
    if (localEnc) candidates.push({ source: 'local', enc: localEnc });

    for (const item of candidates) {
      if (!this.isHexPayload(item.enc)) continue;
      try {
        const value = JSON.parse(this.xorHexDecode(item.enc, this.privateKey));
        if (item.source === 'cloud') wx.setStorageSync(key, item.enc);
        return value;
      } catch (e) {
        console.warn('period secure candidate invalid', item.source, e);
      }
    }

    if (candidates.length) {
      console.warn('period secure read ignored invalid payload', key);
    }

    return fallback;
  },

  writeSecure(key, value) {
    const json = JSON.stringify(value);
    const enc = this.xorHexEncode(json, this.privateKey);
    wx.setStorageSync(key, enc);
    cloudStore.set(key, enc).catch(e => {
      console.warn('write period data to cloud failed', key, e);
    });
  },

  randomKey(n) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  },

  xorHexEncode(str, key) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      const kc = key.charCodeAt(i % key.length);
      const bc = str.charCodeAt(i) ^ kc;
      out.push(bc.toString(16).padStart(2, '0'));
    }
    return out.join('');
  },

  xorHexDecode(hex, key) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
      const kc = key.charCodeAt(i % key.length);
      s += String.fromCharCode(bytes[i] ^ kc);
    }
    return s;
  },

  isHexPayload(value) {
    return typeof value === 'string' && value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  shortDate(dateStr) {
    if (!dateStr || dateStr === '--') return '--';
    const parts = String(dateStr).split('-');
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  },

  addDays(dateStr, days) {
    const date = new Date(String(dateStr).replace(/-/g, '/') + ' 00:00:00');
    date.setDate(date.getDate() + Number(days || 0));
    return this.formatDate(date);
  },

  diffDays(a, b) {
    const da = new Date(String(a).replace(/-/g, '/') + ' 00:00:00');
    const db = new Date(String(b).replace(/-/g, '/') + ' 00:00:00');
    da.setHours(0, 0, 0, 0);
    db.setHours(0, 0, 0, 0);
    return Math.round((da.getTime() - db.getTime()) / 86400000);
  }
});
