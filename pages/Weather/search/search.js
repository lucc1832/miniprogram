const amapWeather = require('../utils/amapWeather.js');
const PENDING_CITY_INDEX_KEY = 'weather_pending_city_index';
const { getNavigationLayout } = require('../../../utils/layout.js');

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
      '天津', '合肥', '福州', '昆明',
      '南昌', '南宁', '贵阳', '太原',
      '哈尔滨', '长春', '石家庄'
    ],
    searchResults: []
  },

  onLoad() {
    const layout = getNavigationLayout();
    
    this.setData({ 
      statusBarHeight: layout.statusBarHeight,
      navBarHeight: layout.navBarHeight,
      menuButtonLeft: layout.menuButtonLeft,
      menuButtonTop: layout.menuButtonTop,
      menuButtonHeight: layout.menuButtonHeight
    });
    this.locationTimer = setTimeout(() => {
      this.locationTimer = null;
      this.initLocation();
    }, 300);
  },

  onCancel() {
    wx.navigateBack();
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.locationTimer) clearTimeout(this.locationTimer);
  },

  initLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.reverseGeocode(res.latitude, res.longitude);
      },
      fail: () => {
        this.setData({ currentLocation: '定位失败' });
      }
    });
  },

  reverseGeocode(lat, lon) {
    amapWeather.reverseGeocode(lat, lon).then(city => {
      this.currentLocationCity = city;
      this.setData({ currentLocation: city && city.name ? city.name : '定位失败' });
    }).catch(() => {
      this.setData({ currentLocation: '定位失败' });
    });
  },

  onInput(e) {
    const val = (e.detail && e.detail.value) || '';
    this.setData({ searchText: val });

    if (this.searchTimer) clearTimeout(this.searchTimer);

    if (!val.trim()) {
      this.searchSeq = (this.searchSeq || 0) + 1;
      this.setData({ searchResults: [] });
      return;
    }

    this.searchTimer = setTimeout(() => {
      this.doSearch(val.trim());
    }, 500);
  },

  clearSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchSeq = (this.searchSeq || 0) + 1;
    this.setData({ searchText: '', searchResults: [] });
  },

  doSearch(keyword) {
    const seq = (this.searchSeq || 0) + 1;
    this.searchSeq = seq;

    amapWeather.geocode(keyword).then(results => {
      if (seq !== this.searchSeq) return;
      this.setData({
        searchResults: results.map(item => ({
          ...item,
          country: '中国'
        }))
      });
    }).catch(err => {
        console.error('Search failed', err);
        wx.showToast({ title: '搜索失败', icon: 'none' });
    });
  },

  onSelectCity(e) {
    const { name, lat, lon, adcode } = e.currentTarget.dataset;
    if (!name || name === '定位中...' || name === '定位失败') return;

    if (adcode) {
      const city = this.data.searchResults.find(item => item.adcode === adcode);
      if (city) {
        this.addCityDirectly(city);
        return;
      }
    }

    if (this.currentLocationCity && this.currentLocationCity.name === name) {
      this.addCityDirectly(this.currentLocationCity);
    } else if (lat && lon) {
      this.addCityDirectly({ name, lat: Number(lat), lon: Number(lon), adcode });
    } else {
      this.addCityToStorage(name);
    }
  },

  switchToCity(index) {
    wx.setStorageSync(PENDING_CITY_INDEX_KEY, index);
    const pages = getCurrentPages();
    const indexPage = pages.find(p => p.route === 'pages/Weather/index/index');
    
    if (indexPage) {
      const delta = pages.length - pages.indexOf(indexPage) - 1;
      wx.navigateBack({ delta: delta });
    } else {
      wx.navigateBack();
    }
  },

  addCityDirectly(cityObj) {
    let cities = wx.getStorageSync('weather_cities') || [];
    
    const index = cities.findIndex(c => {
      const sameName = c.name === cityObj.name;
      const sameAdcode = cityObj.adcode && c.adcode === cityObj.adcode;
      const sameLoc = c.lat && c.lon && cityObj.lat && cityObj.lon
        && Math.abs(c.lat - cityObj.lat) < 0.01
        && Math.abs(c.lon - cityObj.lon) < 0.01;
      return sameAdcode || sameName || sameLoc;
    });

    if (index === -1) {
      cities.push(cityObj);
      wx.setStorageSync('weather_cities', cities);
      this.switchToCity(cities.length - 1);
    } else {
       this.switchToCity(index);
    }
  },

  addCityToStorage(cityName) {
    wx.showLoading({ title: '添加中...' });

    amapWeather.geocode(cityName).then(list => {
        wx.hideLoading();
        if (list.length > 0) {
          this.addCityDirectly(list[0]);
        } else {
          wx.showToast({ title: '未找到该城市信息', icon: 'none' });
        }
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  }
});
