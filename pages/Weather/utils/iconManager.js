const themes = {
  emoji: {
    name: '默认 (Emoji)',
    type: 'emoji',
    icons: {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    }
  },
  flat: {
    name: '扁平风格 (示例)',
    type: 'emoji', // 暂时用Emoji模拟，实际应为 'image'
    icons: {
      '01d': '🌞', '01n': '🌚',
      '02d': '🌤️', '02n': '☁️',
      '03d': '🌥️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧', '09n': '🌧',
      '10d': '🌦', '10n': '🌧',
      '11d': '🌩', '11n': '🌩',
      '13d': '❄️', '13n': '❄️',
      '50d': '🌫', '50n': '🌫'
    }
  }
};

const getIcon = (code, themeName = 'emoji') => {
  const theme = themes[themeName] || themes.emoji;
  return theme.icons[code] || theme.icons['02d'];
};

const getThemeType = (themeName = 'emoji') => {
  const theme = themes[themeName] || themes.emoji;
  return theme.type;
};

const getThemes = () => {
  return Object.keys(themes).map(key => ({
    id: key,
    name: themes[key].name,
    preview: [themes[key].icons['01d'], themes[key].icons['09d'], themes[key].icons['02d']]
  }));
};

module.exports = {
  getIcon,
  getThemeType,
  getThemes
};
