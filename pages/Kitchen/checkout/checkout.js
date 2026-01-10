const db = wx.cloud.database();
const CART_KEY = "of_cart_v1";

function loadCart() {
  return wx.getStorageSync(CART_KEY) || [];
}
function saveCart(list) {
  wx.setStorageSync(CART_KEY, list);
}
function calcTotal(list) {
  const total = list.reduce((s, x) => s + Number(x.price || 0), 0);
  return Number(total.toFixed(2));
}

Page({
  data: {
    address: "",
    remark: "",
    cartList: [],
    groupedCartList: [],
    cartTotal: 0,
    paymentMethod: 'wechat', // wechat | balance
    isSubmitting: false
  },

  onLoad() {
    const cartList = loadCart();
    this.setData({
      cartList,
      groupedCartList: this.groupCartItems(cartList),
      cartTotal: calcTotal(cartList)
    });
  },

  // 聚合购物车商品用于展示
  groupCartItems(list) {
    const map = {};
    list.forEach(item => {
      const key = item.name; // 假设name唯一，或者可以用id
      if (map[key]) {
        map[key].count++;
        map[key].totalPrice += Number(item.price);
      } else {
        map[key] = {
          ...item,
          count: 1,
          totalPrice: Number(item.price)
        };
      }
    });
    // 格式化价格
    return Object.values(map).map(item => ({
      ...item,
      totalPriceStr: item.totalPrice.toFixed(2)
    }));
  },

  onAddress(e) { this.setData({ address: e.detail.value }); },
  onRemark(e) { this.setData({ remark: e.detail.value }); },
  
  selectPayment(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ paymentMethod: method });
  },

  goBack() {
    wx.navigateBack();
  },

  async submit() {
    const { address, remark, cartList, paymentMethod, isSubmitting } = this.data;

    if (isSubmitting) return;
    if (!cartList.length) {
      wx.showToast({ title: "购物车为空", icon: "none" });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: "请填写地址", icon: "none" });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '正在支付...', mask: true });

    // 模拟支付过程
    setTimeout(async () => {
      try {
        const total = calcTotal(cartList);
        
        // 模拟支付成功，写入云数据库
        // 注意：实际项目中这里应该调用云函数进行支付下单
        await db.collection("orders").add({
          data: {
            address: address.trim(),
            remark: remark.trim(),
            items: cartList,
            total,
            paymentMethod,
            status: "paid", // 简化流程，直接设为paid
            createdAt: Date.now()
          }
        });

        // 同步数据到 Kitchen 模块
        this.syncToKitchen(cartList, total);

        // 清空购物车
        saveCart([]);
        
        wx.hideLoading();
        wx.showToast({ title: "支付成功", icon: "success", duration: 2000 });

        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 1500);

      } catch (e) {
        console.error(e);
        wx.hideLoading();
        wx.showToast({ title: "系统繁忙，请重试", icon: "none" });
        this.setData({ isSubmitting: false });
      }
    }, 1500); // 模拟1.5秒网络延迟
  },

  syncToKitchen(cartList, total) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    
    // 1. 更新今日状态（触发热力图变化）
    wx.setStorageSync('daily_status_' + todayStr, 'ordered'); 

    // 2. 添加到厨房日记订单列表
    const kitchenOrders = wx.getStorageSync('kitchen_orders') || [];
    kitchenOrders.unshift({
      id: Date.now(),
      date: todayStr,
      items: cartList,
      total: total,
      status: '已下单' // 这里可以根据支付状态调整，目前保持一致
    });
    wx.setStorageSync('kitchen_orders', kitchenOrders);
  }
});
