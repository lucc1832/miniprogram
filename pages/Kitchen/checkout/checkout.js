const cloudStore = require('../../../utils/cloudStore.js');
const CART_KEY = 'of_cart_v1';

function loadCart() {
  return wx.getStorageSync(CART_KEY) || [];
}

function saveCart(list) {
  wx.setStorageSync(CART_KEY, list);
}

function getCount(item) {
  return Math.max(1, Number(item.count || 1));
}

function getUnitPrice(item) {
  return Number(item.unitPrice != null ? item.unitPrice : item.price || 0);
}

function getItemTotal(item) {
  if (item.totalPrice != null) return Number(item.totalPrice || 0);
  return getUnitPrice(item) * getCount(item);
}

function normalizeCart(list) {
  return (list || []).map(item => {
    const count = getCount(item);
    const unitPrice = getUnitPrice(item);
    const totalPrice = Number(getItemTotal(item).toFixed(2));
    return {
      ...item,
      count,
      unitPrice,
      price: unitPrice,
      totalPrice
    };
  });
}

function calcTotal(list) {
  const total = list.reduce((sum, item) => sum + getItemTotal(item), 0);
  return Number(total.toFixed(2));
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

Page({
  data: {
    address: '',
    remark: '',
    cartList: [],
    groupedCartList: [],
    cartTotal: 0,
    paymentMethod: 'wechat',
    isSubmitting: false
  },

  onLoad() {
    const cartList = normalizeCart(loadCart());
    this.setData({
      cartList,
      groupedCartList: this.groupCartItems(cartList),
      cartTotal: calcTotal(cartList)
    });
  },

  groupCartItems(list) {
    const map = {};
    list.forEach(item => {
      const key = item.id || item.name;
      const count = getCount(item);
      const unitPrice = getUnitPrice(item);
      const total = getItemTotal(item);

      if (map[key]) {
        map[key].count += count;
        map[key].totalPrice += total;
      } else {
        map[key] = {
          ...item,
          count,
          price: unitPrice.toFixed(2),
          totalPrice: total
        };
      }
    });

    return Object.values(map).map(item => ({
      ...item,
      totalPriceStr: item.totalPrice.toFixed(2)
    }));
  },

  onAddress(e) {
    this.setData({ address: e.detail.value });
  },

  onRemark(e) {
    this.setData({ remark: e.detail.value });
  },
  
  selectPayment(e) {
    this.setData({ paymentMethod: e.currentTarget.dataset.method });
  },

  goBack() {
    wx.navigateBack();
  },

  async submit() {
    const { address, remark, cartList, paymentMethod, isSubmitting } = this.data;

    if (isSubmitting) return;
    if (!cartList.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: '请填写地址', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '正在记录...', mask: true });

    setTimeout(async () => {
      const total = calcTotal(cartList);
      const order = {
        address: address.trim(),
        remark: remark.trim(),
        items: cartList,
        total,
        paymentMethod,
        status: 'paid',
        createdAt: Date.now()
      };

      try {
        await cloudStore.addUserDoc('orders', order);
      } catch (e) {
        console.warn('云端订单写入失败，已保留本地订单', e);
      }

      this.syncToKitchen(cartList, total, order);
      saveCart([]);

      wx.hideLoading();
      wx.showToast({ title: '演示记录成功', icon: 'success', duration: 1600 });

      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 1200);
    }, 600);
  },

  syncToKitchen(cartList, total, order) {
    const now = new Date();
    const todayStr = formatDateKey(now);
    
    wx.setStorageSync('daily_status_' + todayStr, 'ordered');

    const kitchenOrders = wx.getStorageSync('kitchen_orders') || [];
    kitchenOrders.unshift({
      id: Date.now(),
      dateKey: todayStr,
      date: todayStr,
      items: cartList,
      total,
      address: order.address,
      remark: order.remark,
      paymentMethod: order.paymentMethod,
      status: '已下单'
    });
    wx.setStorageSync('kitchen_orders', kitchenOrders);
  }
});
