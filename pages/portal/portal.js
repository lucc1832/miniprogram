const RECENT_KEY = 'portal_recent_module';
const cloudStore = require('../../utils/cloudStore.js');

Page({
  data: {
    todayLabel: '',
    enabledCount: 5,
    recentModule: null,
    modules: [
      {
        key: 'breakeven',
        icon: '📌',
        title: '到期便签',
        desc: '物品到期提醒，顺手算使用成本',
        badge: '提醒',
        url: '/pages/Breakeven/ReturnHomepage/ReturnHomepage',
        accentClass: 'accent-purple'
      },
      {
        key: 'weather',
        icon: '🌤️',
        title: '天气预报',
        desc: '实时天气、空气质量和未来趋势',
        badge: '定位',
        url: '/pages/Weather/index/index',
        accentClass: 'accent-blue'
      },
      {
        key: 'anniversary',
        icon: '💛',
        title: '纪念日',
        desc: '把重要日子放进一条时间线',
        badge: '陪伴',
        url: '/pages/Anniversary/home/home',
        accentClass: 'accent-rose'
      },
      {
        key: 'kitchen',
        icon: '🍳',
        title: '我的厨房',
        desc: '点菜、菜篮子、食记和订单',
        badge: '点餐',
        url: '/pages/Kitchen/index/index',
        accentClass: 'accent-amber'
      },
      {
        key: 'weight',
        icon: '⚖️',
        title: '身体记录',
        desc: '记录体重变化，查看趋势和指标',
        badge: '趋势',
        url: '/pages/Health/weight/index',
        accentClass: 'accent-green'
      },
      {
        key: 'period',
        icon: '🌙',
        title: '月经记录',
        desc: '记录周期、经量、疼痛和症状变化',
        badge: '私密',
        url: '/pages/Health/period/index',
        accentClass: 'accent-period'
      },
      {
        key: 'accounting',
        icon: '🧾',
        title: '记账',
        desc: '预算、流水和月度复盘入口',
        badge: '规划中',
        disabled: true,
        accentClass: 'accent-slate'
      }
    ]
  },

  onLoad() {
    this.setTodayLabel();
    this.setData({
      enabledCount: this.data.modules.filter(item => !item.disabled).length
    });
  },

  onShow() {
    this.loadRecentModule();
    this.loadModuleSummaries();
  },

  setTodayLabel() {
    const now = new Date();
    this.setData({
      todayLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    });
  },

  async loadModuleSummaries() {
    const modules = this.data.modules.map(item => ({ ...item }));
    const updateSummary = (key, summary) => {
      const module = modules.find(item => item.key === key);
      if (module && summary) module.summary = summary;
    };

    const cities = wx.getStorageSync('weather_cities') || [];
    if (cities[0]) {
      updateSummary('weather', cities[0].temp !== undefined
        ? `${cities[0].name} ${cities[0].temp}℃`
        : `${cities[0].name} · 等待更新`);
    }

    const anniversaries = wx.getStorageSync('anniversary_events_v2') || [];
    updateSummary('anniversary', anniversaries.length ? `${anniversaries.length} 个重要日子` : '还没有添加纪念日');

    const kitchenOrders = wx.getStorageSync('kitchen_orders') || [];
    updateSummary('kitchen', kitchenOrders.length ? `${kitchenOrders.length} 条食记` : '今天想吃点什么');

    const weightRecords = this.getWeightRecordCount();
    updateSummary('weight', weightRecords ? `${weightRecords} 条体重记录` : '开始记录第一次变化');

    const periodRecords = this.getPeriodRecordCount();
    updateSummary('period', periodRecords ? `${periodRecords} 条私密记录` : '记录周期与身体状态');

    this.setData({ modules });

    try {
      const goods = await cloudStore.getUserRows('goods');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soon = goods.filter(item => {
        if (!item.expireEnabled || !item.expireDate) return false;
        const target = new Date(String(item.expireDate).replace(/-/g, '/') + ' 00:00:00');
        const days = Math.ceil((target.getTime() - today.getTime()) / 86400000);
        return days >= 0 && days <= 30;
      }).length;
      updateSummary('breakeven', soon ? `${soon} 个项目临期` : `${goods.length} 个物品在管理`);
      this.setData({ modules });
    } catch (err) {
      console.warn('portal goods summary failed', err);
    }
  },

  getWeightRecordCount() {
    const enc = wx.getStorageSync('weight_records_enc') || '';
    const key = wx.getStorageSync('weight_key') || '';
    if (!enc || !key || enc.length % 2 !== 0) return 0;
    try {
      let text = '';
      for (let i = 0; i < enc.length; i += 2) {
        const value = parseInt(enc.slice(i, i + 2), 16);
        text += String.fromCharCode(value ^ key.charCodeAt((i / 2) % key.length));
      }
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.length;
      return Object.keys(parsed || {}).reduce((sum, name) => sum + (Array.isArray(parsed[name]) ? parsed[name].length : 0), 0);
    } catch (err) {
      return 0;
    }
  },

  getPeriodRecordCount() {
    const enc = wx.getStorageSync('period_records_enc') || '';
    const key = wx.getStorageSync('period_private_key') || '';
    if (!enc || !key || enc.length % 2 !== 0) return 0;
    try {
      let text = '';
      for (let i = 0; i < enc.length; i += 2) {
        const value = parseInt(enc.slice(i, i + 2), 16);
        text += String.fromCharCode(value ^ key.charCodeAt((i / 2) % key.length));
      }
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (err) {
      return 0;
    }
  },

  loadRecentModule() {
    const recent = wx.getStorageSync(RECENT_KEY);
    if (recent && recent.url) {
      const current = this.data.recentModule;
      if (!current || current.url !== recent.url || current.at !== recent.at) {
        this.setData({ recentModule: recent });
      }
    } else if (this.data.recentModule) {
      this.setData({ recentModule: null });
    }
  },

  handleCardTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.modules[index];
    if (!item) return;

    if (item.disabled || !item.url) {
      this.toast();
      return;
    }

    this.openModule(item);
  },

  openRecent() {
    const recent = this.data.recentModule;
    if (!recent || !recent.url) return;
    this.openModule(recent);
  },

  openModule(item) {
    if (this.navigating) return;
    this.navigating = true;

    const recent = {
      key: item.key,
      icon: item.icon,
      title: item.title,
      desc: item.desc,
      url: item.url,
      at: Date.now()
    };

    wx.setStorageSync(RECENT_KEY, recent);
    this.setData({ recentModule: recent });

    wx.navigateTo({
      url: item.url,
      complete: () => {
        setTimeout(() => {
          this.navigating = false;
        }, 350);
      },
      fail(err) {
        console.warn('navigateTo fail:', err);
        wx.showToast({ title: '页面打开失败，请稍后重试', icon: 'none' });
      }
    });
  },

  toast() {
    wx.showToast({ title: '记账模块正在抓紧开发中，即将上线，敬请期待', icon: 'none' });
  }
});
