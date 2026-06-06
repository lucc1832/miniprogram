const AMAP_KEY = '5d133337e4aadedd51e9032383ce90b7';
const AMAP_BASE = 'https://restapi.amap.com/v3';

function request(path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${AMAP_BASE}${path}`,
      data: {
        key: AMAP_KEY,
        output: 'JSON',
        ...data
      },
      success(res) {
        const body = res.data || {};
        if (res.statusCode === 200 && body.status === '1') {
          resolve(body);
          return;
        }
        reject({
          ...body,
          requestPath: path
        });
      },
      fail(err) {
        reject({
          ...err,
          requestPath: path
        });
      }
    });
  });
}

function normalizeName(component) {
  if (!component) return '';
  const city = Array.isArray(component.city) ? '' : component.city;
  return city || component.district || component.province || '';
}

function makeCityFromGeocode(item) {
  const location = item.location || '';
  const [lon, lat] = location.split(',').map(Number);
  const cityName = Array.isArray(item.city) ? '' : item.city;

  return {
    name: cityName || item.district || item.formatted_address || item.province,
    province: item.province || '',
    district: item.district || '',
    adcode: item.adcode || '',
    citycode: item.citycode || '',
    lat,
    lon,
    location
  };
}

function reverseGeocode(lat, lon) {
  return request('/geocode/regeo', {
    location: `${lon},${lat}`,
    extensions: 'base',
    radius: 1000
  }).then(data => {
    const component = data.regeocode && data.regeocode.addressComponent;
    if (!component) return null;

    return {
      name: normalizeName(component),
      province: component.province || '',
      district: component.district || '',
      adcode: component.adcode || '',
      citycode: component.citycode || '',
      lat,
      lon,
      location: `${lon},${lat}`
    };
  });
}

function geocode(address) {
  return request('/geocode/geo', {
    address
  }).then(data => {
    const list = data.geocodes || [];
    const seen = new Set();

    return list
      .map(makeCityFromGeocode)
      .filter(item => {
        if (!item.name || !item.adcode || seen.has(item.adcode)) return false;
        seen.add(item.adcode);
        return true;
      });
  });
}

function getWeather(adcode) {
  const base = request('/weather/weatherInfo', {
    city: adcode,
    extensions: 'base'
  });
  const forecast = request('/weather/weatherInfo', {
    city: adcode,
    extensions: 'all'
  });

  return Promise.all([base, forecast]).then(([liveData, forecastData]) => ({
    live: liveData.lives && liveData.lives[0],
    forecast: forecastData.forecasts && forecastData.forecasts[0]
  }));
}

module.exports = {
  AMAP_KEY,
  geocode,
  getWeather,
  reverseGeocode
};
