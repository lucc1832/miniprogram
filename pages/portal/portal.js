const RECENT_KEY = 'portal_recent_module';

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
  },

  setTodayLabel() {
    const now = new Date();
    const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    this.setData({
      todayLabel: `${now.getMonth() + 1}月${now.getDate()}日 ${weeks[now.getDay()]}`
    });
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
    wx.showToast({ title: '这个模块还在打磨中', icon: 'none' });
  }
});
