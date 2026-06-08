function getWindowInfo() {
  if (typeof wx.getWindowInfo === 'function') {
    return wx.getWindowInfo();
  }

  return {
    statusBarHeight: 20,
    windowWidth: 375,
    windowHeight: 667,
    screenWidth: 375,
    screenHeight: 667,
    safeArea: null
  };
}

function getNavigationLayout() {
  const windowInfo = getWindowInfo();
  const statusBarHeight = Number(windowInfo.statusBarHeight || 20);
  const menuButtonInfo = typeof wx.getMenuButtonBoundingClientRect === 'function'
    ? wx.getMenuButtonBoundingClientRect()
    : null;

  const menuButtonTop = Number(menuButtonInfo && menuButtonInfo.top || statusBarHeight + 6);
  const menuButtonHeight = Number(menuButtonInfo && menuButtonInfo.height || 32);
  const menuButtonLeft = Number(menuButtonInfo && menuButtonInfo.left || windowInfo.windowWidth - 96);
  const navBarHeight = Math.max(
    44,
    (menuButtonTop - statusBarHeight) * 2 + menuButtonHeight
  );

  return {
    statusBarHeight,
    navBarHeight,
    menuButtonTop,
    menuButtonHeight,
    menuButtonLeft,
    windowWidth: Number(windowInfo.windowWidth || 375),
    windowHeight: Number(windowInfo.windowHeight || 667),
    safeArea: windowInfo.safeArea || null
  };
}

module.exports = {
  getWindowInfo,
  getNavigationLayout
};
