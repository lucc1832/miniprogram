const amapWeather = require('../utils/amapWeather.js');
const PENDING_CITY_INDEX_KEY = 'weather_pending_city_index';

Page({
  data: {
    cities: [],
    isEditing: false,
    selectedCities: [],
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonTop: 0,
    menuButtonHeight: 32,
    windowWidth: 375
  },

  onLoad() {
    this.initLayout();
  },

  onShow() {
    this.loadCities();
  },

  onUnload() {
    if (this.weatherUpdateTimer) clearTimeout(this.weatherUpdateTimer);
  },

  onHide() {
    if (this.weatherUpdateTimer) clearTimeout(this.weatherUpdateTimer);
  },

  initLayout() {
    const sysInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    // Calculate custom navigation bar height
    const navBarHeight = (menuButtonInfo.top - sysInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    
    this.setData({ 
      statusBarHeight: sysInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      menuButtonTop: menuButtonInfo.top,
      menuButtonHeight: menuButtonInfo.height,
      windowWidth: sysInfo.windowWidth
    });
  },

  back() {
    wx.navigateBack();
  },

  cleanCitiesForStorage(cities) {
    return (cities || []).map(city => {
      const next = { ...city };
      delete next.x;
      delete next.isLocation;
      return next;
    });
  },

  onCancel() {
    this.setData({ isEditing: false, selectedCities: [] });
  },

  onSelectAll() {
    const all = this.data.cities.map((_, i) => i);
    this.setData({ selectedCities: all });
  },

  loadCities() {
    let cities = wx.getStorageSync('weather_cities') || [];
    
    const seen = new Set();
    const uniqueCities = [];
    cities.forEach(c => {
      const key = c.adcode || `${c.name}_${Math.round((c.lat || 0) * 100)}_${Math.round((c.lon || 0) * 100)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCities.push({ ...c, x: 0, isLocation: uniqueCities.length === 0 });
      }
    });

    // If duplicates were found, update storage
    if (uniqueCities.length !== cities.length) {
      cities = uniqueCities;
      wx.setStorageSync('weather_cities', this.cleanCitiesForStorage(cities));
    } else {
      // Just reset x for existing
      cities = uniqueCities;
    }
    
    this.setData({ cities });
    this.scheduleWeatherUpdate(cities);
  },

  scheduleWeatherUpdate(cities) {
    if (this.weatherUpdateTimer) clearTimeout(this.weatherUpdateTimer);
    this.weatherUpdateTimer = setTimeout(() => {
      this.weatherUpdateTimer = null;
      this.updateWeatherForCities(cities);
    }, 360);
  },

  updateWeatherForCities(cities) {
    const CACHE_DURATION = 2 * 60 * 60 * 1000;
    const now = Date.now();

    const staleCities = (cities || [])
      .map((city, index) => ({ city, index }))
      .filter(({ city }) => !city.temp || !city.lastUpdate || (now - city.lastUpdate > CACHE_DURATION));

    staleCities.reduce((chain, { city, index }) => chain.then(() => {
      return this.ensureCityWithAdcode(city, index).then(nextCity => {
          if (!nextCity || !nextCity.adcode) return;
          return amapWeather.getWeather(nextCity.adcode).then(({ live }) => {
            if (!live) return;

            const temp = Math.round(Number(live.temperature || 0));
            const condition = live.weather || '';
            const key = `cities[${index}]`;
            this.setData({
              [key + '.temp']: temp,
              [key + '.condition']: condition
            });

            const currentCities = wx.getStorageSync('weather_cities') || [];
            if (currentCities[index] && (currentCities[index].adcode === nextCity.adcode || currentCities[index].name === nextCity.name)) {
              currentCities[index] = {
                ...currentCities[index],
                ...nextCity,
                temp,
                condition,
                lastUpdate: now
              };
              wx.setStorageSync('weather_cities', this.cleanCitiesForStorage(currentCities));
            }
          });
        }).catch(err => {
          console.warn('城市天气更新失败', err);
        });
    }), Promise.resolve());
  },

  ensureCityWithAdcode(city, index) {
    if (city && city.adcode) return Promise.resolve(city);

    const byLocation = city && city.lat && city.lon
      ? amapWeather.reverseGeocode(city.lat, city.lon)
      : Promise.resolve(null);

    return byLocation.then(res => {
      if (res && res.adcode) return res;
      if (!city || !city.name) return null;
      return amapWeather.geocode(city.name).then(list => list[0] || null);
    }).then(resolved => {
      if (!resolved) return city;
      const nextCity = { ...city, ...resolved };
      if (typeof index === 'number') {
        const cities = [...this.data.cities];
        cities[index] = nextCity;
        this.setData({ cities });
        wx.setStorageSync('weather_cities', this.cleanCitiesForStorage(cities));
      }
      return nextCity;
    });
  },

  onToggleEdit() {
    // Reset all slides when entering edit mode
    const resetCities = this.data.cities.map(c => ({ ...c, x: 0 }));
    this.setData({ 
      isEditing: !this.data.isEditing, 
      selectedCities: [],
      cities: resetCities
    });
  },

  onSelectCity(e) {
    const index = e.currentTarget.dataset.index;
    
    // If dragging heavily, don't trigger select (simple heuristic usually handled by system, but good to know)
    // Here we assume tap is intentional.

    if (this.data.isEditing) {
      if (index === 0) {
        wx.showToast({ title: '当前定位无法选择', icon: 'none' });
        return;
      }
      
      const selected = this.data.selectedCities;
      const i = selected.indexOf(index);
      if (i > -1) {
        selected.splice(i, 1);
      } else {
        selected.push(index);
      }
      this.setData({ selectedCities: selected });
    } else {
      // Switch city
      wx.setStorageSync(PENDING_CITY_INDEX_KEY, index);
      wx.navigateBack();
    }
  },

  onDelete() {
    const selected = this.data.selectedCities.sort((a, b) => b - a);
    const cities = this.data.cities;
    
    // Check if index 0 is selected
    if (selected.includes(0)) {
        wx.showToast({ title: '当前定位无法删除', icon: 'none' });
        // Remove 0 from selection or just stop
        // Let's filter it out
        const validSelected = selected.filter(i => i !== 0);
        if (validSelected.length === 0) return;
        
        validSelected.forEach(idx => {
            cities.splice(idx, 1);
        });
    } else {
        selected.forEach(idx => {
            cities.splice(idx, 1);
        });
    }
    
    this.setData({ cities, selectedCities: [], isEditing: false });
    wx.setStorageSync('weather_cities', this.cleanCitiesForStorage(cities));
  },

  // Slide interactions
  onSwipeChange(e) {
    // We can track x here if needed
  },

  onSwipeEnd(e) {
    const index = e.currentTarget.dataset.index;
    // We can't get x directly from touchend event object in simple way without tracking change.
    // But we can rely on user action. 
    // If we want snapping:
    // This is a bit complex in standard MP without wxs or query.
    // Let's rely on damping and let user slide.
    // If you want auto-open/close, we need to track x in bindchange.
  },

  onSlideDelete(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) {
      wx.showToast({ title: '当前定位无法删除', icon: 'none' });
      // Reset slide
      this.setData({ [`cities[${index}].x`]: 0 });
      return;
    }

    wx.showModal({
      title: '提示',
      content: '确定要删除该城市吗？',
      success: (res) => {
        if (res.confirm) {
          const cities = this.data.cities;
          cities.splice(index, 1);
          // Reset x for all (or just re-render)
          cities.forEach(c => c.x = 0);
          this.setData({ cities });
          wx.setStorageSync('weather_cities', this.cleanCitiesForStorage(cities));
          wx.showToast({ title: '已删除', icon: 'none' });
        } else {
          // Cancelled, reset slide
          this.setData({ [`cities[${index}].x`]: 0 });
        }
      }
    });
  },

  onSearch() {
    this.onAddCity();
  },
  
  onAddCity() {
     wx.navigateTo({
       url: '/pages/Weather/search/search'
     });
  },
});
