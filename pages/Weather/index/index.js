const app = getApp();

const API_KEY = '8968074cbf2aacf93ece6a19f282351a';
const WEATHER_BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE = 'https://api.openweathermap.org/geo/1.0';

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonTop: 24,
    menuButtonHeight: 32,
    loading: true,
    currentCityIndex: 0,
    cities: [],
    weatherData: null,
    hourlyForecast: [],
    dailyForecast: [],
    chartMinTemp: 0,
    chartMaxTemp: 20
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    // Calculate custom navigation bar height
    const navBarHeight = (menuButtonInfo.top - sysInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    
    this.setData({ 
      statusBarHeight: sysInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      menuButtonTop: menuButtonInfo.top,
      menuButtonHeight: menuButtonInfo.height
    });
    
    // 尝试从缓存读取城市列表
    const cachedCities = wx.getStorageSync('weather_cities');
    if (cachedCities && cachedCities.length > 0) {
      this.setData({ cities: cachedCities });
      // 加载第一个城市
      this.loadWeatherData(cachedCities[0]);
    } else {
      this.initLocation();
    }
  },

  onShow() {
    // Check if cities changed
    const cachedCities = wx.getStorageSync('weather_cities');
    if (cachedCities && JSON.stringify(cachedCities) !== JSON.stringify(this.data.cities)) {
      this.setData({ cities: cachedCities });
      // If current index is out of bounds, reset
      if (this.data.currentCityIndex >= cachedCities.length) {
        this.setData({ currentCityIndex: 0 });
      }
      if (cachedCities.length > 0) {
        this.loadWeatherData(cachedCities[this.data.currentCityIndex]);
      } else {
        // No cities? Init location again
        this.initLocation();
      }
    }
  },

  onManageCities() {
    wx.navigateTo({
      url: '/pages/Weather/city/city'
    });
  },

  // 显示菜单（删除城市等）
  onShowMenu() {
    const itemList = ['删除当前城市'];
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deleteCurrentCity();
        }
      }
    });
  },

  // 删除当前城市
  deleteCurrentCity() {
    const { cities, currentCityIndex } = this.data;
    
    if (cities.length <= 1) {
      wx.showToast({ title: '至少保留一个城市', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '提示',
      content: `确定要删除 ${cities[currentCityIndex].name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const newCities = [...cities];
          newCities.splice(currentCityIndex, 1);
          
          // 更新索引，如果删的是最后一个，索引要减一
          let newIndex = currentCityIndex;
          if (newIndex >= newCities.length) {
            newIndex = newCities.length - 1;
          }

          this.setData({
            cities: newCities,
            currentCityIndex: newIndex
          });
          
          this.saveCitiesToStorage(newCities);
          this.loadWeatherData(newCities[newIndex]);
        }
      }
    });
  },

  // 保存城市列表到缓存
  saveCitiesToStorage(cities) {
    wx.setStorageSync('weather_cities', cities);
  },

  onPullDownRefresh() {
    const city = this.data.cities[this.data.currentCityIndex];
    if (city) {
      this.loadWeatherData(city).then(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      this.initLocation().then(() => wx.stopPullDownRefresh());
    }
  },

  // 初始化定位
  initLocation() {
    this.setData({ loading: true });
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'wgs84',
        success: (res) => {
          // OpenWeatherMap Reverse Geocoding
          this.reverseGeocode(res.latitude, res.longitude).then(city => {
            if (city) {
              const newCities = [city];
              this.setData({ 
                cities: newCities,
                currentCityIndex: 0
              });
              this.saveCitiesToStorage(newCities); // 自动保存定位城市
              this.loadWeatherData(city).then(resolve);
            } else {
              this.handleLocateFail(resolve);
            }
          }).catch(() => this.handleLocateFail(resolve));
        },
        fail: (err) => {
          console.error('Location failed:', err);
          // 检查是否是权限问题
          if (err.errMsg && (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize:fail'))) {
             wx.showModal({
               title: '定位权限未开启',
               content: '请在设置中开启位置权限以获取当地天气',
               confirmText: '去设置',
               success: (res) => {
                 if (res.confirm) {
                   wx.openSetting({
                     success: (settingRes) => {
                       if (settingRes.authSetting['scope.userLocation']) {
                         this.initLocation(); // 重试
                       } else {
                         this.handleLocateFail(resolve);
                       }
                     }
                   });
                 } else {
                   this.handleLocateFail(resolve);
                 }
               }
             });
          } else {
             this.handleLocateFail(resolve);
          }
        }
      });
    });
  },

  handleLocateFail(resolve) {
    wx.showToast({ title: '定位失败，默认北京', icon: 'none' });
    const defaultCity = { name: 'Beijing', lat: 39.90, lon: 116.40 };
    this.setData({
      cities: [defaultCity],
      currentCityIndex: 0
    });
    this.loadWeatherData(defaultCity).then(resolve);
  },

  // Reverse Geocoding
  reverseGeocode(lat, lon) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${GEO_BASE}/reverse`,
        data: { lat, lon, limit: 1, appid: API_KEY },
        success: (res) => {
          if (res.data && res.data.length > 0) {
            const top = res.data[0];
            // 优先使用 local_names.zh，否则用 name
            const name = (top.local_names && top.local_names.zh) ? top.local_names.zh : top.name;
            resolve({ name: name, lat: top.lat, lon: top.lon });
          } else {
            resolve(null);
          }
        },
        fail: reject
      });
    });
  },

  // 搜索城市 (Geocoding API)
  searchCity(query) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${GEO_BASE}/direct`,
        data: { q: query, limit: 5, appid: API_KEY },
        success: (res) => {
          if (res.data && res.data.length > 0) {
            const top = res.data[0];
            const name = (top.local_names && top.local_names.zh) ? top.local_names.zh : top.name;
            resolve({ name: name, lat: top.lat, lon: top.lon });
          } else {
            resolve(null);
          }
        },
        fail: reject
      });
    });
  },

  // 切换城市
  onSwitchCity() {
    const cityNames = this.data.cities.map(c => c.name);
    wx.showActionSheet({
      itemList: cityNames,
      success: (res) => {
        const idx = res.tapIndex;
        if (idx !== this.data.currentCityIndex) {
          this.setData({ currentCityIndex: idx });
          const city = this.data.cities[idx];
          this.loadWeatherData(city);
        }
      }
    });
  },

  // 添加城市
  onAddCity() {
    wx.showModal({
      title: '添加城市',
      placeholderText: '请输入城市名称（如：Shanghai）',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          this.searchCity(res.content).then(city => {
            if (city) {
              // 简单去重
              const exists = this.data.cities.some(c => 
                Math.abs(c.lat - city.lat) < 0.01 && Math.abs(c.lon - city.lon) < 0.01
              );
              if (exists) {
                wx.showToast({ title: '城市已存在', icon: 'none' });
              } else {
                const newCities = [...this.data.cities, city];
                this.setData({ 
                  cities: newCities,
                  currentCityIndex: newCities.length - 1
                });
                this.saveCitiesToStorage(newCities); // 保存新列表
                this.loadWeatherData(city);
              }
            } else {
              wx.showToast({ title: '未找到该城市', icon: 'none' });
            }
          });
        }
      }
    });
  },

  onView5Days() {
    wx.showToast({ title: '已显示5天预报', icon: 'none' });
  },

  // 加载数据 (Current + Forecast)
  loadWeatherData(city) {
    this.setData({ loading: true });
    wx.setNavigationBarTitle({ title: city.name });

    const commonParams = {
      lat: city.lat,
      lon: city.lon,
      appid: API_KEY,
      units: 'metric',
      lang: 'zh_cn'
    };

    const p1 = this.requestApi(`${WEATHER_BASE}/weather`, commonParams);
    const p2 = this.requestApi(`${WEATHER_BASE}/forecast`, commonParams);
    const p3 = this.requestApi(`${WEATHER_BASE}/air_pollution`, commonParams);

    return Promise.all([p1, p2, p3]).then(results => {
      const [currentRes, forecastRes, aqiRes] = results;

      if (!currentRes || currentRes.cod != 200) {
        console.error("Current Weather API Error:", currentRes);
        throw new Error('Current weather failed');
      }

      // Calculate Rain Prob (Max of next 24h)
      let rainProb = 0;
      if (forecastRes && forecastRes.list) {
        const next24h = forecastRes.list.slice(0, 8);
        const maxPop = Math.max(...next24h.map(item => item.pop || 0));
        rainProb = Math.round(maxPop * 100);
      } else {
         console.warn("Forecast API failed or empty:", forecastRes);
      }

      // Get AQI
      let aqiVal = '--';
      let aqiLevel = '';
      if (aqiRes && aqiRes.list && aqiRes.list.length > 0) {
        const aqi = aqiRes.list[0].main.aqi; // 1-5
        aqiVal = aqi;
        const levels = ['优', '良', '中', '差', '极差'];
        aqiLevel = levels[aqi - 1] || '';
      }

      const current = this.formatCurrent(currentRes, city.name, aqiVal, aqiLevel, rainProb);
      
      let hourly = [];
      let daily = [];
      
      if (forecastRes && forecastRes.list) {
        hourly = this.formatHourly(forecastRes.list); // 前24h
        daily = this.formatDaily(forecastRes.list);   // 5天聚合
      }

      // 计算图表范围
      let min = 0, max = 20;
      if (hourly.length > 0) {
        const temps = hourly.map(h => h.temp);
        min = Math.min(...temps) - 2;
        max = Math.max(...temps) + 2;
      }

      this.setData({
        weatherData: current,
        hourlyForecast: hourly,
        dailyForecast: daily,
        chartMinTemp: min,
        chartMaxTemp: max,
        loading: false
      });

    }).catch(err => {
      console.error(err);
      wx.showToast({ title: '获取数据失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  requestApi(url, data) {
    return new Promise((resolve) => {
      wx.request({
        url,
        data: data,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            console.error(`Request failed [${res.statusCode}]: ${url}`, res.data);
            resolve(null);
          }
        },
        fail: (err) => {
          console.error(`Network failed: ${url}`, err);
          resolve(null);
        }
      });
    });
  },

  // 格式化 Current
  formatCurrent(data, cityName, aqiVal, aqiLevel, rainProb) {
    const weather = data.weather[0];
    const main = data.main;
    const wind = data.wind;
    const sys = data.sys;

    // 日出日落
    const sunrise = new Date(sys.sunrise * 1000).toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit'});
    const sunset = new Date(sys.sunset * 1000).toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit'});

    return {
      city: cityName,
      temp: Math.round(main.temp),
      high: Math.round(main.temp_max),
      low: Math.round(main.temp_min),
      condition: weather.description,
      windDir: this.getWindDir(wind.deg),
      windSpeed: `${wind.speed}m/s`,
      humidity: `${main.humidity}%`,
      feelsLike: Math.round(main.feels_like),
      uv: '--', // 标准接口无UV
      pressure: `${main.pressure}hPa`,
      rainProb: `${rainProb}%`,
      sunrise: sunrise,
      sunset: sunset,
      aqi: aqiVal, 
      aqiLevel: aqiLevel
    };
  },

  // 格式化 Hourly (取前8个数据点 = 24h)
  formatHourly(list) {
    return list.slice(0, 8).map(item => {
      const date = new Date(item.dt * 1000);
      const hours = date.getHours().toString().padStart(2, '0');
      const mins = date.getMinutes().toString().padStart(2, '0');
      return {
        time: `${hours}:${mins}`,
        temp: Math.round(item.main.temp),
        icon: this.getIcon(item.weather[0].icon),
        text: item.weather[0].description,
        wind: `${item.wind.speed}m/s`
      };
    });
  },

  // 格式化 Daily (聚合5天)
  formatDaily(list) {
    const dailyMap = {};
    
    list.forEach(item => {
      const dateObj = new Date(item.dt * 1000);
      const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
      
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = {
          dateObj: dateObj,
          temps: [],
          icons: [], // 收集一天内的图标，取出现最多的或正午的
          conds: []
        };
      }
      dailyMap[dateStr].temps.push(item.main.temp);
      dailyMap[dateStr].icons.push(item.weather[0].icon);
      dailyMap[dateStr].conds.push(item.weather[0].description);
    });

    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const result = [];

    Object.keys(dailyMap).forEach((k, index) => {
      if (index > 4) return; // 只取5天
      const obj = dailyMap[k];
      
      let dayLabel = days[obj.dateObj.getDay()];
      const todayStr = `${new Date().getMonth()+1}/${new Date().getDate()}`;
      if (k === todayStr) dayLabel = '今天';
      
      // 简单取正午附近的图标/天气，或者出现频率最高的
      // 这里简化取中间的
      const mid = Math.floor(obj.icons.length / 2);

      result.push({
        day: dayLabel,
        date: k,
        cond: obj.conds[mid],
        icon: this.getIcon(obj.icons[mid]),
        high: Math.round(Math.max(...obj.temps)),
        low: Math.round(Math.min(...obj.temps))
      });
    });

    return result;
  },

  getWindDir(deg) {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const i = Math.round(deg / 45) % 8;
    return dirs[i] + '风';
  },

  getIcon(code) {
    // OpenWeatherMap icon code to Emoji
    // https://openweathermap.org/weather-conditions
    const map = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return map[code] || '⛅';
  }
});
