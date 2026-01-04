Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number
  },

  data: {
    activeCat: 'all',
    foods: [
      { name: '蒸鸡蛋', img: 'https://img.yzcdn.cn/vant/cat.jpeg' },
      { name: '辣椒炒牛肉', img: 'https://img.yzcdn.cn/vant/cat.jpeg' },
      { name: '土豆炖牛腩', img: 'https://img.yzcdn.cn/vant/cat.jpeg' },
      { name: '辣椒炒牛肚', img: 'https://img.yzcdn.cn/vant/cat.jpeg' },
      { name: '黄瓜炒火腿', img: 'https://img.yzcdn.cn/vant/cat.jpeg' },
      { name: '清炒上海青', img: 'https://img.yzcdn.cn/vant/cat.jpeg' }
    ]
  },

  methods: {
    switchCat(e) {
      this.setData({ activeCat: e.currentTarget.dataset.cat });
    }
  }
})