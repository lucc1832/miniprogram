Page({
  data: {
    searchText: '',
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonLeft: 0,
    menuButtonTop: 0,
    menuButtonHeight: 32,
    currentLocation: '定位中...',
    hotCities: [
      '北京', '上海', '深圳', '广州',
      '武汉', '长沙', '南京', '苏州',
      '西安', '济南', '青岛', '沈阳',
      '重庆', '郑州', '成都', '杭州',
      '厦门'
    ],
    intlCities: [
      '纽约', '巴黎', '伦敦', '东京',
      '罗马', '迪拜', '莫斯科', '悉尼',
      '新加坡', '北京', '雅典'
    ],
    searchResults: []
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    // Calculate custom navigation bar height
    const navBarHeight = (menuButtonInfo.top - sysInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    
    this.setData({ 
      statusBarHeight: sysInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      menuButtonLeft: menuButtonInfo.left,
      menuButtonTop: menuButtonInfo.top,
      menuButtonHeight: menuButtonInfo.height
    });
    this.initLocation();
  },

  onCancel() {
    wx.navigateBack();
  },

  initLocation() {
    // Attempt to get current location city name
    // We can reuse the logic from index.js but simpler
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        this.reverseGeocode(res.latitude, res.longitude);
      },
      fail: () => {
        this.setData({ currentLocation: '定位失败' });
      }
    });
  },

  reverseGeocode(lat, lon) {
    const API_KEY = '8968074cbf2aacf93ece6a19f282351a';
    const GEO_BASE = 'https://api.openweathermap.org/geo/1.0/reverse';
    
    wx.request({
      url: GEO_BASE,
      data: { lat, lon, limit: 1, appid: API_KEY },
      success: (res) => {
        if (res.data && res.data.length > 0) {
          const top = res.data[0];
          const name = (top.local_names && top.local_names.zh) ? top.local_names.zh : top.name;
          this.setData({ currentLocation: name });
        }
      }
    });
  },

  onInput(e) {
    const val = e.detail.value;
    this.setData({ searchText: val });
    if (val.length > 0) {
      this.doSearch(val);
    } else {
      this.setData({ searchResults: [] });
    }
  },

  doSearch(keyword) {
    const API_KEY = '8968074cbf2aacf93ece6a19f282351a';
    const GEO_BASE = 'https://api.openweathermap.org/geo/1.0/direct';
    
    wx.request({
      url: GEO_BASE,
      data: {
        q: keyword,
        limit: 10,
        appid: API_KEY
      },
      success: (res) => {
        if (res.data && Array.isArray(res.data)) {
          const results = res.data.map(item => ({
            name: (item.local_names && item.local_names.zh) ? item.local_names.zh : item.name,
            province: item.state || item.country,
            lat: item.lat,
            lon: item.lon,
            country: item.country
          }));
          this.setData({ searchResults: results });
        } else {
           this.setData({ searchResults: [] });
        }
      },
      fail: (err) => {
        console.error('Search failed', err);
        wx.showToast({ title: '搜索失败', icon: 'none' });
      }
    });
  },

  onSelectCity(e) {
    const { name, lat, lon } = e.currentTarget.dataset;
    if (!name || name === '定位中...' || name === '定位失败') return;

    if (lat && lon) {
      this.addCityDirectly({ name, lat, lon });
    } else {
      this.addCityToStorage(name);
    }
  },

  switchToCity(index) {
    const pages = getCurrentPages();
    const indexPage = pages.find(p => p.route === 'pages/Weather/index/index');
    
    if (indexPage) {
      indexPage.setData({ currentCityIndex: index });
      const cities = wx.getStorageSync('weather_cities');
      if (cities && cities[index]) {
        indexPage.loadWeatherData(cities[index]);
      }
      const delta = pages.length - pages.indexOf(indexPage) - 1;
      wx.navigateBack({ delta: delta });
    } else {
      wx.navigateBack();
    }
  },

  addCityDirectly(cityObj) {
    let cities = wx.getStorageSync('weather_cities') || [];
    
    // Check duplicates
    const index = cities.findIndex(c => c.name === cityObj.name);
    if (index === -1) {
      cities.push(cityObj);
      wx.setStorageSync('weather_cities', cities);
      wx.navigateBack();
    } else {
       this.switchToCity(index);
    }
  },

  addCityToStorage(cityName) {
    // We need coordinates for the weather app to work best.
    // If we only have name, we might need to geocode it again OR 
    // if the search result has coords, use them.
    // The hot cities list only has names.
    // So we should geocode them to get lat/lon before adding.
    
    wx.showLoading({ title: '添加中...' });
    
    const API_KEY = '8968074cbf2aacf93ece6a19f282351a';
    const GEO_BASE = 'https://api.openweathermap.org/geo/1.0/direct';

    wx.request({
      url: GEO_BASE,
      data: { q: cityName, limit: 1, appid: API_KEY },
      success: (res) => {
        wx.hideLoading();
        if (res.data && res.data.length > 0) {
          const top = res.data[0];
          const name = (top.local_names && top.local_names.zh) ? top.local_names.zh : top.name;
          const newCity = { name: name, lat: top.lat, lon: top.lon };
          
          let cities = wx.getStorageSync('weather_cities') || [];
          
          // Check duplicates
          const index = cities.findIndex(c => c.name === name);
          if (index === -1) {
            cities.push(newCity);
            wx.setStorageSync('weather_cities', cities);
            
            this.switchToCity(cities.length - 1);
          } else {
             this.switchToCity(index);
          }
        } else {
          wx.showToast({ title: '未找到该城市信息', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  }
});
