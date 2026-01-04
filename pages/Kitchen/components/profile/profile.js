Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number
  },

  data: {
    funcs: [
      { name: '个人信息', icon: '👤', color: '#81C784' },
      { name: '邀请成员', icon: '📩', color: '#64B5F6' },
      { name: '创建厨房', icon: '🏠', color: '#FFB74D' },
      { name: '新手教程', icon: '📖', color: '#BA68C8' },
      { name: '菜品分类', icon: '📂', color: '#4DB6AC' },
      { name: '添加菜品', icon: '➕', color: '#FF8A65' },
      { name: '我的菜品', icon: '🍲', color: '#AED581' },
      { name: '隐藏默认', icon: '👁️', color: '#90A4AE' },
      { name: '食材分类', icon: '🥕', color: '#FFD54F' },
      { name: '添加食材', icon: '➕', color: '#4DD0E1' },
      { name: '我的食材', icon: '🍎', color: '#E57373' },
      { name: '隐藏默认', icon: '👁️', color: '#A1887F' },
      { name: '联系客服', icon: '🎧', color: '#9575CD' },
      { name: '意见反馈', icon: '📝', color: '#F06292' },
      { name: '分享小程序', icon: '🔗', color: '#4FC3F7' },
      { name: '更多小程序', icon: '📱', color: '#7986CB' }
    ]
  }
})