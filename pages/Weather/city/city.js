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

  onShow() {
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
    this.loadCities();
  },

  back() {
    wx.navigateBack();
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
    
    // Deduplicate: Keep the first occurrence (index 0 is priority)
    const seen = new Set();
    const uniqueCities = [];
    cities.forEach(c => {
      if (!seen.has(c.name)) {
        seen.add(c.name);
        c.x = 0; // Reset slide
        uniqueCities.push(c);
      }
    });

    // If duplicates were found, update storage
    if (uniqueCities.length !== cities.length) {
      cities = uniqueCities;
      wx.setStorageSync('weather_cities', cities);
    } else {
      // Just reset x for existing
      cities.forEach(c => c.x = 0);
    }
    
    this.setData({ cities });
    this.updateWeatherForCities(cities);
  },

  updateWeatherForCities(cities) {
    const API_KEY = '8968074cbf2aacf93ece6a19f282351a';
    const WEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';

    cities.forEach((city, index) => {
      if (!city.temp) { 
        wx.request({
          url: WEATHER_BASE,
          data: {
            lat: city.lat,
            lon: city.lon,
            appid: API_KEY,
            units: 'metric',
            lang: 'zh_cn'
          },
          success: (res) => {
            if (res.data && res.data.main) {
              const temp = Math.round(res.data.main.temp);
              const condition = res.data.weather[0].description;
              const aqi = 50; 
              
              const key = `cities[${index}]`;
              this.setData({
                [key + '.temp']: temp,
                [key + '.condition']: condition,
                [key + '.aqi']: aqi,
                [key + '.isLocation']: index === 0 
              });
              
              // Update storage (without x)
              const currentCities = this.data.cities;
              currentCities[index].temp = temp;
              currentCities[index].condition = condition;
              // Clean x before storage if needed, but keeping it is fine or ignored
              wx.setStorageSync('weather_cities', currentCities);
            }
          }
        });
      }
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
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        prevPage.setData({ currentCityIndex: index });
        prevPage.loadWeatherData(this.data.cities[index]);
      }
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
    wx.setStorageSync('weather_cities', cities);
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
          wx.setStorageSync('weather_cities', cities);
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
