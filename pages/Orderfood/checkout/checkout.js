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
    cartTotal: 0
  },

  onLoad() {
    const cartList = loadCart();
    this.setData({
      cartList,
      cartTotal: calcTotal(cartList)
    });
  },

  onAddress(e) { this.setData({ address: e.detail.value }); },
  onRemark(e) { this.setData({ remark: e.detail.value }); },

  async submit() {
    const { address, remark, cartList } = this.data;

    if (!cartList.length) {
      wx.showToast({ title: "购物车为空", icon: "none" });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: "请填写地址", icon: "none" });
      return;
    }

    const total = calcTotal(cartList);

    // 写入云数据库 orders
    try {
      await db.collection("orders").add({
        data: {
          address: address.trim(),
          remark: remark.trim(),
          items: cartList,
          total,
          status: "created",
          createdAt: Date.now()
        }
      });

      // 清空购物车
      saveCart([]);
      wx.showToast({ title: "下单成功", icon: "success" });

      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 800);
    } catch (e) {
      console.log(e);
      wx.showToast({ title: "下单失败（云未配置）", icon: "none" });
    }
  }
});
