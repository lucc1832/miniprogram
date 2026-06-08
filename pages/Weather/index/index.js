const amapWeather = require('../utils/amapWeather.js');
const iconManager = require('../utils/iconManager.js');
const { getNavigationLayout } = require('../../../utils/layout.js');

const CACHE_DURATION = 2 * 60 * 60 * 1000;
const CACHE_VERSION = 4;
const MIN_REFRESH_INTERVAL = 10 * 60 * 1000;
const LOCATION_REFRESH_INTERVAL = 60 * 60 * 1000;
const LAST_LOCATION_CHECK_KEY = 'weather_last_location_check';
const PENDING_CITY_INDEX_KEY = 'weather_pending_city_index';

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonTop: 24,
    menuButtonHeight: 32,
    windowWidth: 375,
    loading: true,
    currentCityIndex: 0,
    cities: [],
    weatherData: null,
    hourlyForecast: [],
    dailyForecast: [],
    forecastMode: 'trend',
    clothingAdvice: '',
    clothingTitle: '舒适出门',
    clothingIcon: '🧥',
    detailMetrics: [],
    lifestyleItems: [],
    dataNotes: [],
    forecastBrief: { trend: '' },
    weatherThemeClass: 'theme-blue',
    isRefreshing: false,
    showCityPanel: false,
    currentTheme: 'emoji',
    cacheNotice: ''
  },

  onLoad() {
    this.weatherRequestMap = {};
    this.lastWeatherToastAt = 0;
    this.deferredWeatherTimer = null;
    this.booting = true;

    const layout = getNavigationLayout();

    this.setData({
      statusBarHeight: layout.statusBarHeight,
      navBarHeight: layout.navBarHeight,
      menuButtonTop: layout.menuButtonTop,
      menuButtonHeight: layout.menuButtonHeight,
      menuButtonLeft: layout.menuButtonLeft,
      windowWidth: layout.windowWidth
    });

    let cachedCities = wx.getStorageSync('weather_cities') || [];
    cachedCities = this.dedupCities(cachedCities);

    if (cachedCities.length > 0) {
      this.setData({ cities: cachedCities });
      this.loadWeatherData(cachedCities[0]);
      this.updateLocationSilent();
    } else {
      this.initLocation();
    }

    setTimeout(() => {
      this.booting = false;
    }, 800);
  },

  onShow() {
    const currentTheme = wx.getStorageSync('weather_theme') || 'emoji';
    const cachedCities = wx.getStorageSync('weather_cities') || [];
    const uniqueCities = this.dedupCities(cachedCities);

    const pendingIndex = wx.getStorageSync(PENDING_CITY_INDEX_KEY);
    const hasPendingIndex = pendingIndex !== '' && pendingIndex !== undefined && pendingIndex !== null;
    if (hasPendingIndex) wx.removeStorageSync(PENDING_CITY_INDEX_KEY);

    const citiesChanged = !this.isSameCityList(uniqueCities, this.data.cities);
    const nextCities = citiesChanged ? uniqueCities : this.data.cities;
    let nextIndex = citiesChanged
      ? Math.min(this.data.currentCityIndex, Math.max(nextCities.length - 1, 0))
      : this.data.currentCityIndex;

    if (hasPendingIndex && nextCities.length > 0) {
      nextIndex = Math.min(Math.max(Number(pendingIndex) || 0, 0), nextCities.length - 1);
    }

    const updates = {};
    let shouldReload = false;

    if (this.data.currentTheme !== currentTheme) {
      updates.currentTheme = currentTheme;
      shouldReload = true;
    }

    if (!this.booting && citiesChanged) {
      updates.cities = nextCities;
      shouldReload = true;
    }

    if (nextIndex !== this.data.currentCityIndex) {
      updates.currentCityIndex = nextIndex;
      shouldReload = true;
    }

    if (Object.keys(updates).length > 0) {
      this.setData(updates);
    }

    if (this.booting) return;

    if (nextCities.length === 0) {
      this.initLocation();
      return;
    }

    if (shouldReload) {
      const city = nextCities[nextIndex];
      if (city) this.deferWeatherLoad(city, hasPendingIndex ? 180 : 80);
    }
  },

  onUnload() {
    this.clearDeferredWeatherLoad();
  },

  onHide() {
    this.clearDeferredWeatherLoad();
  },

  dedupCities(cities) {
    const seen = new Set();
    const list = [];

    (cities || []).forEach(city => {
      const key = city.adcode || `${city.name}_${Math.round((city.lat || 0) * 100)}_${Math.round((city.lon || 0) * 100)}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      list.push(city);
    });

    if (list.length !== (cities || []).length) {
      wx.setStorageSync('weather_cities', list);
    }

    return list;
  },

  isSameCityList(a = [], b = []) {
    if (a.length !== b.length) return false;
    return a.every((city, index) => {
      const other = b[index] || {};
      const cityKey = city.adcode || `${city.name}_${Math.round((city.lat || 0) * 100)}_${Math.round((city.lon || 0) * 100)}`;
      const otherKey = other.adcode || `${other.name}_${Math.round((other.lat || 0) * 100)}_${Math.round((other.lon || 0) * 100)}`;
      return cityKey === otherKey && city.name === other.name;
    });
  },

  updateCityInStorage(index, city) {
    const cities = [...this.data.cities];
    cities[index] = { ...cities[index], ...city };
    this.setData({ cities });
    wx.setStorageSync('weather_cities', cities);
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
      if (typeof index === 'number') this.updateCityInStorage(index, nextCity);
      return nextCity;
    });
  },

  updateLocationSilent() {
    const lastCheck = wx.getStorageSync(LAST_LOCATION_CHECK_KEY) || 0;
    if (Date.now() - Number(lastCheck) < LOCATION_REFRESH_INTERVAL) return;
    wx.setStorageSync(LAST_LOCATION_CHECK_KEY, Date.now());

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        amapWeather.reverseGeocode(res.latitude, res.longitude).then(city => {
          if (!city) return;

          const cities = [...this.data.cities];
          const oldCity = cities[0];
          if (!oldCity || oldCity.adcode !== city.adcode) {
            cities[0] = city;
            const unique = this.dedupCities(cities);
            this.setData({ cities: unique });
            wx.setStorageSync('weather_cities', unique);
            if (this.data.currentCityIndex === 0) this.loadWeatherData(city);
          }
        }).catch(err => {
          console.warn('Silent location update failed', err);
        });
      },
      fail: (err) => {
        console.warn('Silent location update failed', err);
      }
    });
  },

  initLocation() {
    this.setData({ loading: true });
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          amapWeather.reverseGeocode(res.latitude, res.longitude).then(city => {
            if (!city) {
              this.handleLocateFail(resolve);
              return;
            }

            const newCities = [city];
            this.setData({ cities: newCities, currentCityIndex: 0 });
            wx.setStorageSync('weather_cities', newCities);
            this.loadWeatherData(city).then(resolve);
          }).catch(() => this.handleLocateFail(resolve));
        },
        fail: (err) => {
          if (err.errMsg && (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize:fail'))) {
            wx.showModal({
              title: '定位权限未开启',
              content: '请在设置中开启位置权限以获取当地天气',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting({
                    success: (settingRes) => {
                      if (settingRes.authSetting['scope.userLocation']) this.initLocation();
                      else this.handleLocateFail(resolve);
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
    const defaultCity = { name: '北京市', province: '北京市', adcode: '110000', lat: 39.9042, lon: 116.4074 };
    this.setData({ cities: [defaultCity], currentCityIndex: 0 });
    wx.setStorageSync('weather_cities', [defaultCity]);
    this.loadWeatherData(defaultCity).then(resolve);
  },

  getWeatherCacheKey(adcode) {
    return `weather_cache_amap_${adcode}`;
  },

  getWeatherCache(adcode) {
    if (!adcode) return null;
    const cache = wx.getStorageSync(this.getWeatherCacheKey(adcode));
    return cache && cache.version === CACHE_VERSION ? cache : null;
  },

  applyWeatherCache(cache) {
    if (!cache) return false;
    const weatherData = cache.weatherData;
    this.setData({
      weatherData,
      hourlyForecast: cache.hourlyForecast || [],
      dailyForecast: cache.dailyForecast || [],
      clothingAdvice: cache.clothingAdvice || '',
      clothingTitle: cache.clothingTitle || '舒适出门',
      clothingIcon: cache.clothingIcon || '🧥',
      detailMetrics: cache.detailMetrics || [],
      lifestyleItems: cache.lifestyleItems || [],
      dataNotes: cache.dataNotes || [],
      forecastBrief: cache.forecastBrief || { trend: '' },
      weatherThemeClass: this.getWeatherThemeClass(weatherData && weatherData.condition, weatherData && weatherData.reportTime),
      loading: false
    });
    return true;
  },

  isCacheFresh(cache) {
    return !!(cache && Date.now() - Number(cache.timestamp || 0) < CACHE_DURATION);
  },

  saveWeatherCache(adcode, payload) {
    wx.setStorageSync(this.getWeatherCacheKey(adcode), {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      ...payload
    });
  },

  shouldThrottleRefresh(cache, options) {
    if (!options.force || options.ignoreThrottle || !cache) return false;
    return Date.now() - Number(cache.timestamp || 0) < MIN_REFRESH_INTERVAL;
  },

  loadWeatherData(city, options = {}) {
    if (typeof options === 'boolean') options = { force: options };
    const index = this.data.currentCityIndex;

    return this.ensureCityWithAdcode(city, index).then(resolvedCity => {
      if (!resolvedCity || !resolvedCity.adcode) {
        throw new Error('missing adcode');
      }

      wx.setNavigationBarTitle({ title: resolvedCity.name });

      const cache = this.getWeatherCache(resolvedCity.adcode);

      if (!options.force && this.isCacheFresh(cache)) {
        this.applyWeatherCache(cache);
        this.setData({ cacheNotice: '' });
        return Promise.resolve({ fromCache: true });
      }

      if (this.shouldThrottleRefresh(cache, options)) {
        this.applyWeatherCache(cache);
        this.setData({ cacheNotice: '刷新间隔较短，当前显示最近天气数据' });
        wx.showToast({ title: '已使用最近天气', icon: 'none' });
        return Promise.resolve({ fromCache: true, throttled: true });
      }

      const requestKey = resolvedCity.adcode;
      if (this.weatherRequestMap[requestKey]) {
        if (cache) this.applyWeatherCache(cache);
        return this.weatherRequestMap[requestKey];
      }

      if (cache) this.applyWeatherCache(cache);
      else this.setData({ loading: true });

      const task = amapWeather.getWeather(resolvedCity.adcode).then(({ live, forecast }) => {
        if (!live) throw new Error('weather failed');

        const casts = (forecast && forecast.casts) || [];
        const dailyForecast = this.formatDaily(casts);
        const hourlyForecast = this.formatTrend(casts);
        const weatherData = this.formatCurrent(live, casts, resolvedCity);
        const clothingAdvice = this.getClothingAdvice(weatherData.temp, weatherData.condition);
        const clothingTitle = this.getClothingTitle(weatherData.temp, weatherData.condition);
        const clothingIcon = this.getClothingIcon(weatherData.temp, weatherData.condition);
        const detailMetrics = this.buildDetailMetrics(weatherData);
        const lifestyleItems = this.buildLifestyleItems(weatherData, casts);
        const dataNotes = this.buildDataNotes(weatherData);
        const forecastBrief = this.buildForecastBrief(casts);

        this.setData({
          weatherData,
          hourlyForecast,
          dailyForecast,
          clothingAdvice,
          clothingTitle,
          clothingIcon,
          detailMetrics,
          lifestyleItems,
          dataNotes,
          forecastBrief,
          weatherThemeClass: this.getWeatherThemeClass(weatherData.condition, weatherData.reportTime),
          loading: false,
          cacheNotice: ''
        });

        const cities = [...this.data.cities];
        if (cities[index] && cities[index].adcode === resolvedCity.adcode) {
          cities[index] = {
            ...cities[index],
            temp: weatherData.temp,
            condition: weatherData.condition,
            lastUpdate: Date.now()
          };
          this.setData({ cities });
          wx.setStorageSync('weather_cities', cities);
        }

        this.saveWeatherCache(resolvedCity.adcode, {
          weatherData,
          hourlyForecast,
          dailyForecast,
          clothingAdvice,
          clothingTitle,
          clothingIcon,
          detailMetrics,
          lifestyleItems,
          dataNotes,
          forecastBrief
        });
        return { fromCache: false };
      }).catch(err => {
        console.warn('AMap weather failed', err);
        if (cache) {
          this.applyWeatherCache(cache);
          this.setData({ cacheNotice: '网络暂不可用，当前显示最近缓存天气' });
          this.showWeatherErrorToast('已显示缓存天气');
          return { fromCache: true, failed: true };
        }

        this.showWeatherErrorToast(this.getWeatherErrorTitle(err));
        this.setData({ loading: false });
        return { failed: true };
      }).finally(() => {
        delete this.weatherRequestMap[requestKey];
      });

      this.weatherRequestMap[requestKey] = task;
      return task;
    }).catch(err => {
      console.warn('Prepare weather request failed', err);
      this.showWeatherErrorToast(this.getWeatherErrorTitle(err));
      this.setData({ loading: false });
      return { failed: true };
    });
  },

  deferWeatherLoad(city, delay = 120, options = {}) {
    if (!city) return;
    this.clearDeferredWeatherLoad();

    this.deferredWeatherTimer = setTimeout(() => {
      this.deferredWeatherTimer = null;
      this.loadWeatherData(city, options);
    }, delay);
  },

  clearDeferredWeatherLoad() {
    if (!this.deferredWeatherTimer) return;
    clearTimeout(this.deferredWeatherTimer);
    this.deferredWeatherTimer = null;
  },

  showWeatherErrorToast(title) {
    const now = Date.now();
    if (now - this.lastWeatherToastAt < 3000) return;
    this.lastWeatherToastAt = now;
    wx.showToast({ title, icon: 'none' });
  },

  getWeatherErrorTitle(err) {
    const info = err && (err.info || err.errMsg || err.message || '');
    const infocode = err && err.infocode;

    if (String(info).includes('url not in domain list') || String(info).includes('合法域名')) {
      return '缺少高德请求域名';
    }
    if (info === 'USERKEY_PLAT_NOMATCH' || infocode === '10009') {
      return '高德Key平台不匹配';
    }
    if (info === 'INVALID_USER_KEY' || infocode === '10001') {
      return '高德Key无效';
    }
    if (info === 'SERVICE_NOT_AVAILABLE' || infocode === '10003') {
      return '高德服务未开通';
    }
    if (info === 'INVALID_USER_IP' || infocode === '10010') {
      return '高德Key限制了IP';
    }
    if (String(info).includes('timeout')) {
      return '天气请求超时';
    }

    return '获取天气失败';
  },

  formatCurrent(live, casts, city) {
    const first = casts && casts[0];
    const temp = Number(live.temperature || 0);
    const humidity = Number(live.humidity || 0);
    const dayTemp = first ? Number(first.daytemp) : temp;
    const nightTemp = first ? Number(first.nighttemp) : temp;
    const reportTime = live.reporttime ? live.reporttime.slice(5, 16) : '';
    const sun = this.estimateSunTimes(city, first && first.date);
    const uv = this.estimateUvLevel(live.weather, reportTime);

    return {
      city: city.name,
      temp: Math.round(temp),
      high: Math.round(Math.max(dayTemp, nightTemp)),
      low: Math.round(Math.min(dayTemp, nightTemp)),
      condition: live.weather || '--',
      windDir: live.winddirection && live.winddirection !== '无风向' ? `${live.winddirection}风` : '无持续风向',
      windSpeed: live.windpower ? `${live.windpower}级` : '--',
      humidity: live.humidity ? `${live.humidity}%` : '--',
      feelsLike: this.estimateFeelsLike(temp, humidity, live.windpower),
      uv: uv.value,
      uvText: uv.text,
      rainProb: first ? `${first.dayweather}/${first.nightweather}` : '--',
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      sunPosition: sun.position,
      sunNote: '按城市经纬度估算',
      source: '高德天气',
      reportTime
    };
  },

  formatTrend(casts) {
    const result = [];
    const relative = ['今天', '明天', '后天'];

    (casts || []).forEach((item, index) => {
      const label = relative[index] || this.formatMonthDay(item.date);
      result.push({
        key: `${item.date}-day`,
        time: label,
        period: '白天',
        temp: Math.round(Number(item.daytemp)),
        icon: this.getIcon(item.dayweather, false),
        text: item.dayweather,
        wind: `${item.daywind || '--'} ${item.daypower || '--'}级`
      });
      result.push({
        key: `${item.date}-night`,
        time: label,
        period: '夜间',
        temp: Math.round(Number(item.nighttemp)),
        icon: this.getIcon(item.nightweather, true),
        text: item.nightweather,
        wind: `${item.nightwind || '--'} ${item.nightpower || '--'}级`
      });
    });

    return result;
  },

  formatDaily(casts) {
    const result = (casts || []).map((item, index) => {
      const relative = index === 0 ? '今天' : (index === 1 ? '明天' : this.getWeekText(item.week));
      const high = Math.round(Math.max(Number(item.daytemp), Number(item.nighttemp)));
      const low = Math.round(Math.min(Number(item.daytemp), Number(item.nighttemp)));

      return {
        day: `${this.formatMonthDay(item.date)} ${relative}`,
        shortDay: relative,
        dateLabel: this.formatMonthDay(item.date),
        date: item.date,
        cond: `${item.dayweather}/${item.nightweather}`,
        icon: this.getIcon(item.dayweather, false),
        dayIcon: this.getIcon(item.dayweather, false),
        nightIcon: this.getIcon(item.nightweather, true),
        dayWeather: item.dayweather,
        nightWeather: item.nightweather,
        high,
        low
      };
    });

    if (result.length > 0) {
      const lows = result.map(item => item.low);
      const highs = result.map(item => item.high);
      const min = Math.min(...lows);
      const max = Math.max(...highs);
      const range = max - min || 1;

      result.forEach(item => {
        item.barLeft = ((item.low - min) / range) * 100;
        item.barWidth = Math.max(((item.high - item.low) / range) * 100, 2);
        item.rangeTop = ((max - item.high) / range) * 100;
        item.rangeBottom = ((max - item.low) / range) * 100;
        item.rangeHeight = Math.max(item.rangeBottom - item.rangeTop, 8);
      });
    }

    return result;
  },

  formatMonthDay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  },

  getWeekText(week) {
    const map = {
      1: '周一',
      2: '周二',
      3: '周三',
      4: '周四',
      5: '周五',
      6: '周六',
      7: '周日'
    };
    return map[week] || '';
  },

  getIcon(condition, isNight) {
    const text = condition || '';
    const suffix = isNight ? 'n' : 'd';
    let code = `02${suffix}`;

    if (text.includes('晴')) code = isNight ? '01n' : '01d';
    else if (text.includes('雷')) code = `11${suffix}`;
    else if (text.includes('雪')) code = `13${suffix}`;
    else if (text.includes('雨')) code = text.includes('阵') ? `10${suffix}` : `09${suffix}`;
    else if (text.includes('雾') || text.includes('霾') || text.includes('沙') || text.includes('尘')) code = `50${suffix}`;
    else if (text.includes('阴') || text.includes('云')) code = `03${suffix}`;

    return iconManager.getIcon(code, this.data.currentTheme);
  },

  getWeatherThemeClass(condition, reportTime) {
    const text = condition || '';
    let theme = 'theme-blue';

    if (text.includes('雨') || text.includes('雷')) theme = 'theme-rain';
    else if (text.includes('雪')) theme = 'theme-snow';
    else if (text.includes('晴')) theme = 'theme-sunny';
    else if (text.includes('雾') || text.includes('霾') || text.includes('沙') || text.includes('尘')) theme = 'theme-haze';

    return this.isNightNow(reportTime) ? `${theme} theme-night` : theme;
  },

  isNightNow(reportTime) {
    let hour = new Date().getHours();

    if (reportTime) {
      const match = String(reportTime).match(/\s(\d{1,2}):/);
      if (match) hour = Number(match[1]);
    }

    return hour >= 19 || hour < 6;
  },

  getClothingAdvice(temp, condition) {
    const weather = condition || '';
    let base = '体感舒适，穿日常衣物就好。';

    if (temp <= 5) base = '天气偏冷，建议羽绒服、围巾和保暖鞋。';
    else if (temp <= 12) base = '有点冷，建议厚外套或毛衣叠穿。';
    else if (temp <= 20) base = '温度适中，薄外套、卫衣或衬衫都合适。';
    else if (temp <= 28) base = '天气温暖，短袖加轻薄外搭更舒服。';
    else base = '天气较热，建议透气短袖，并注意防晒补水。';

    if (weather.includes('雨')) return `${base} 今天有降雨，记得带伞。`;
    if (weather.includes('雪')) return `${base} 路面可能湿滑，出门注意保暖防滑。`;
    if (weather.includes('雾') || weather.includes('霾')) return `${base} 能见度或空气状态一般，外出注意防护。`;
    return base;
  },

  getClothingTitle(temp, condition) {
    const weather = condition || '';
    if (weather.includes('雨')) return '带伞再出门';
    if (weather.includes('雪')) return '保暖防滑';
    if (temp <= 12) return '注意保暖';
    if (temp >= 30) return '轻薄防晒';
    if (temp >= 22) return '清爽穿搭';
    return '携带外套';
  },

  getClothingIcon(temp, condition) {
    const weather = condition || '';
    if (weather.includes('雨')) return '☂️';
    if (weather.includes('雪')) return '🧣';
    if (temp >= 30) return '👕';
    if (temp <= 12) return '🧥';
    return '🧢';
  },

  estimateFeelsLike(temp, humidity, windPower) {
    const windLevel = this.extractWindLevel(windPower);
    let feelsLike = Number(temp || 0);

    if (feelsLike >= 27 && humidity > 40) {
      feelsLike += Math.min((humidity - 40) / 15, 4);
    } else if (feelsLike <= 15 && windLevel >= 3) {
      feelsLike -= Math.min(windLevel / 2, 3);
    }

    return Math.round(feelsLike);
  },

  estimateUvLevel(condition, reportTime) {
    const weather = condition || '';
    const match = String(reportTime || '').match(/\s(\d{1,2}):/);
    const hour = match ? Number(match[1]) : new Date().getHours();
    let value = hour >= 10 && hour <= 15 ? 5 : 2;

    if (weather.includes('晴')) value += 2;
    if (weather.includes('阴') || weather.includes('雨') || weather.includes('雪')) value -= 2;
    value = Math.max(1, Math.min(value, 8));

    let text = '弱';
    if (value >= 6) text = '强';
    else if (value >= 3) text = '中等';

    return { value, text };
  },

  estimateSunTimes(city, dateStr) {
    const date = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
    const start = new Date(date.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((date - start) / 86400000);
    const lat = Number(city && city.lat);
    const lon = Number(city && city.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { sunrise: '06:00', sunset: '18:00', position: 50 };
    }

    const latitude = lat * Math.PI / 180;
    const declination = 23.44 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81)) * Math.PI / 180;
    const cosHourAngle = Math.max(-1, Math.min(1, -Math.tan(latitude) * Math.tan(declination)));
    const daylight = (24 / Math.PI) * Math.acos(cosHourAngle);
    const solarNoon = 12 + (120 - lon) * 4 / 60;
    const sunriseMinutes = Math.round((solarNoon - daylight / 2) * 60);
    const sunsetMinutes = Math.round((solarNoon + daylight / 2) * 60);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const position = Math.max(0, Math.min(100, ((nowMinutes - sunriseMinutes) / Math.max(sunsetMinutes - sunriseMinutes, 1)) * 100));

    return {
      sunrise: this.formatMinutes(sunriseMinutes),
      sunset: this.formatMinutes(sunsetMinutes),
      position: Math.round(position)
    };
  },

  formatMinutes(totalMinutes) {
    const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
    const minutes = String(normalized % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  buildDetailMetrics(weatherData) {
    return [
      {
        icon: '☀️',
        label: '紫外线',
        value: `${weatherData.uv} ${weatherData.uvText}`,
        note: '天气与时段估算'
      },
      {
        icon: '🌡️',
        label: '体感温度',
        value: `${weatherData.feelsLike}°`,
        note: '温湿度与风力估算'
      },
      {
        icon: '💧',
        label: '湿度',
        value: weatherData.humidity,
        note: '高德实时值'
      },
      {
        icon: '🌬️',
        label: '风向风力',
        value: `${weatherData.windDir} ${weatherData.windSpeed}`,
        note: '高德实时值'
      },
      {
        icon: '🌓',
        label: '昼夜天气',
        value: weatherData.rainProb,
        note: '高德预报值'
      },
      {
        icon: '🕒',
        label: '发布时间',
        value: weatherData.reportTime || '--',
        note: '数据更新时间'
      }
    ];
  },

  buildLifestyleItems(weatherData, casts) {
    const condition = weatherData.condition || '';
    const humidity = parseInt(weatherData.humidity, 10);
    const windLevel = this.extractWindLevel(weatherData.windSpeed);
    const hasRain = this.hasPrecipitation(condition)
      || (casts || []).some(item => this.hasPrecipitation(`${item.dayweather}${item.nightweather}`));
    const hot = weatherData.temp >= 30;
    const cold = weatherData.temp <= 12;

    return [
      { icon: '🧥', value: this.getClothingTitle(weatherData.temp, condition), label: '穿衣' },
      { icon: '☂️', value: hasRain ? '建议携带' : '暂时不用', label: '雨伞' },
      { icon: '🏃', value: hasRain || windLevel >= 5 ? '室内更佳' : '适宜户外', label: '运动' },
      { icon: '🚗', value: hasRain ? '不宜洗车' : '适宜洗车', label: '洗车' },
      { icon: '👕', value: hasRain || humidity >= 80 ? '晾晒较慢' : '适宜晾晒', label: '晾晒' },
      { icon: '😷', value: cold ? '注意保暖' : '风险较低', label: '感冒' },
      { icon: '🧴', value: hot || weatherData.uv >= 6 ? '加强防晒' : '日常防护', label: '防晒' },
      { icon: '🎣', value: hasRain || windLevel >= 5 ? '不太适宜' : '较适宜', label: '垂钓' },
      { icon: '🧳', value: hasRain ? '留意降水' : '出行顺畅', label: '出行' }
    ];
  },

  buildDataNotes() {
    return [
      { type: 'api', text: '温度、湿度、风向风力、天气状况与多日预报来自高德天气 Web 服务。' },
      { type: 'estimate', text: '体感、紫外线、日出日落与生活建议为本地算法估算，仅作日常参考。' },
      { type: 'estimate', text: '当前接口未返回空气质量、气压和能见度，因此页面不展示伪实时数据。' }
    ];
  },

  hasPrecipitation(text) {
    const value = text || '';
    return value.includes('雨') || value.includes('雪') || value.includes('雷');
  },

  buildForecastBrief(casts) {
    if (!casts || casts.length === 0) return null;

    const first = casts[0];
    const last = casts[casts.length - 1];
    const firstAvg = (Number(first.daytemp) + Number(first.nighttemp)) / 2;
    const lastAvg = (Number(last.daytemp) + Number(last.nighttemp)) / 2;
    const diff = Math.round(lastAvg - firstAvg);
    const rainyDays = casts.filter(item => {
      const text = `${item.dayweather || ''}${item.nightweather || ''}`;
      return text.includes('雨') || text.includes('雪') || text.includes('雷');
    });

    let trend = '气温整体平稳';
    if (diff >= 3) trend = `未来几天升温约 ${diff}°`;
    if (diff <= -3) trend = `未来几天降温约 ${Math.abs(diff)}°`;

    return {
      trend,
      rain: rainyDays.length > 0
        ? `${this.formatMonthDay(rainyDays[0].date)} 可能有降水`
        : '未来几天降水不明显',
      range: `${Math.min(...casts.map(item => Number(item.nighttemp)))}° - ${Math.max(...casts.map(item => Number(item.daytemp)))}°`
    };
  },

  extractWindLevel(text) {
    const match = String(text || '').match(/\d+/);
    return match ? Number(match[0]) : 0;
  },

  onPullDownRefresh() {
    if (this.data.isRefreshing) {
      wx.stopPullDownRefresh();
      return;
    }
    this.setData({ isRefreshing: true });
    const city = this.data.cities[this.data.currentCityIndex];
    const finish = () => {
      this.setData({ isRefreshing: false });
      wx.stopPullDownRefresh();
    };

    if (city) this.loadWeatherData(city, { force: true }).then(finish).catch(finish);
    else this.initLocation().then(finish).catch(finish);
  },

  onSwiperChange(e) {
    const index = Number(e.detail.current);
    if (index === this.data.currentCityIndex) return;

    const city = this.data.cities[index];
    if (!city) return;

    this.switchCityAt(index, 90);
  },

  switchCityAt(index, delay = 80) {
    if (index < 0 || index >= this.data.cities.length) return;

    const city = this.data.cities[index];
    const cache = city && city.adcode ? this.getWeatherCache(city.adcode) : null;

    this.setData({
      currentCityIndex: index,
      ...(cache ? {} : { loading: true })
    });

    if (cache) this.applyWeatherCache(cache);
    this.deferWeatherLoad(city, cache ? Math.max(delay, 160) : delay);
  },

  onManageCities() {
    wx.navigateTo({ url: '/pages/Weather/city/city' });
  },

  onShowMenu() {
    wx.showActionSheet({
      itemList: ['城市管理', '图标管理', '删除当前城市'],
      success: (res) => {
        if (res.tapIndex === 0) this.onManageCities();
        if (res.tapIndex === 1) wx.navigateTo({ url: '/pages/Weather/settings/settings' });
        if (res.tapIndex === 2) this.deleteCurrentCity();
      }
    });
  },

  deleteCurrentCity() {
    const { cities, currentCityIndex } = this.data;

    if (currentCityIndex === 0) {
      wx.showToast({ title: '当前定位无法删除', icon: 'none' });
      return;
    }
    if (cities.length <= 1) {
      wx.showToast({ title: '至少保留一个城市', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '提示',
      content: `确定要删除 ${cities[currentCityIndex].name} 吗？`,
      success: (res) => {
        if (!res.confirm) return;

        const newCities = [...cities];
        newCities.splice(currentCityIndex, 1);
        const newIndex = Math.min(currentCityIndex, newCities.length - 1);

        this.setData({ cities: newCities, currentCityIndex: newIndex });
        wx.setStorageSync('weather_cities', newCities);
        this.deferWeatherLoad(newCities[newIndex], 80);
      }
    });
  },

  saveCitiesToStorage(cities) {
    wx.setStorageSync('weather_cities', cities);
  },

  searchCity(query) {
    return amapWeather.geocode(query).then(list => list[0] || null);
  },

  switchToCity(index) {
    this.switchCityAt(index, 80);
  },

  onSwitchCity() {
    this.setData({ showCityPanel: true });
  },

  closeCityPanel() {
    this.setData({ showCityPanel: false });
  },

  selectCityFromPanel(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.currentCityIndex) {
      this.closeCityPanel();
      return;
    }

    const city = this.data.cities[index];
    if (!city) return;

    this.setData({ showCityPanel: false });
    this.switchCityAt(index, 120);
  },

  openCityManager() {
    this.setData({ showCityPanel: false });
    wx.navigateTo({ url: '/pages/Weather/city/city' });
  },

  addCityFromPanel() {
    this.setData({ showCityPanel: false });
    this.onAddCity();
  },

  onAddCity() {
    wx.navigateTo({ url: '/pages/Weather/search/search' });
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/portal/portal' })
    });
  },

  setForecastMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.forecastMode) return;
    this.setData({ forecastMode: mode });
  },

  noop() {
  }
});
