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
    const cities = wx.getStorageSync('weather_cities') || [];
    // Ideally we should update weather for these cities here or cache it
    // For now we just show them. 
    // We might need to fetch current weather for each city to show on the card
    // Let's assume we store basic info or fetch it.
    // For the UI demo, we can just show names.
    // But the image shows weather info.
    // So we should probably fetch weather for them if not cached.
    
    this.setData({ cities });
    this.updateWeatherForCities(cities);
  },

  updateWeatherForCities(cities) {
    // This could be expensive if many cities. Limit to a few.
    const API_KEY = '8968074cbf2aacf93ece6a19f282351a';
    const WEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';

    cities.forEach((city, index) => {
      if (!city.temp) { // Only fetch if no data
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
              const aqi = 50; // Mock AQI
              
              const key = `cities[${index}]`;
              this.setData({
                [key + '.temp']: temp,
                [key + '.condition']: condition,
                [key + '.aqi']: aqi,
                [key + '.isLocation']: index === 0 // Assume first is location
              });
              
              // Update storage
              const currentCities = this.data.cities;
              currentCities[index].temp = temp;
              currentCities[index].condition = condition;
              wx.setStorageSync('weather_cities', currentCities);
            }
          }
        });
      }
    });
  },

  onToggleEdit() {
    this.setData({ isEditing: !this.data.isEditing, selectedCities: [] });
  },

  onSelectCity(e) {
    if (this.data.isEditing) {
      const index = e.currentTarget.dataset.index;
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
      const index = e.currentTarget.dataset.index;
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
    
    selected.forEach(idx => {
      cities.splice(idx, 1);
    });
    
    this.setData({ cities, selectedCities: [], isEditing: false });
    wx.setStorageSync('weather_cities', cities);
  },

  onSearch() {
    // Navigate to search page or show search input
    // wx.showToast({ title: '搜索功能待实现', icon: 'none' });
    // In a real app, we would have a search page.
    // For this task, we can re-use the search logic from index.js but here.
    // Let's use a simple modal for now or just the add logic from index.
    this.onAddCity();
  },
  
  onAddCity() {
     wx.navigateTo({
       url: '/pages/Weather/search/search'
     });
  },
});
