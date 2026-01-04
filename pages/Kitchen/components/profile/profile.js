Component({
  properties: {
    statusBarHeight: Number,
    navBarHeight: Number
  },

  data: {
    funcs: [
      { name: '个人信息', icon: '👤', color: '#81C784', action: 'showUserInfo' },
      { name: '邀请成员', icon: '📩', color: '#64B5F6', action: 'showInvite' },
      { name: '创建厨房', icon: '🏠', color: '#FFB74D', action: 'createKitchen' },
      { name: '新手教程', icon: '📖', color: '#BA68C8', action: 'showTutorial' },
      { name: '菜品分类', icon: '📂', color: '#4DB6AC', action: 'manageCategories' },
      { name: '添加菜品', icon: '➕', color: '#FF8A65', action: 'addRecipe' },
      { name: '我的菜品', icon: '🍲', color: '#AED581', action: 'myRecipes' },
      { name: '隐藏默认', icon: '👁️', color: '#90A4AE', action: 'toggleHidden' },
      { name: '食材分类', icon: '🥕', color: '#FFD54F', action: 'manageIngCategories' },
      { name: '添加食材', icon: '➕', color: '#4DD0E1', action: 'addIngredient' },
      { name: '我的食材', icon: '🍎', color: '#E57373', action: 'myIngredients' },
      { name: '隐藏默认', icon: '👁️', color: '#A1887F', action: 'toggleHidden' },
      { name: '联系客服', icon: '🎧', color: '#9575CD', action: 'contactService' },
      { name: '意见反馈', icon: '📝', color: '#F06292', action: 'feedback' },
      { name: '分享小程序', icon: '🔗', color: '#4FC3F7', action: 'shareApp' },
      { name: '更多小程序', icon: '📱', color: '#7986CB', action: 'moreApps' }
    ],
    showModal: false,
    modalTitle: '',
    modalContent: '',
    ingredients: [],
    showIngredientList: false
  },

  methods: {
    handleFuncClick(e) {
      const action = e.currentTarget.dataset.action;
      if (this[action]) {
        this[action]();
      } else {
        this.showToast('功能开发中');
      }
    },

    showToast(title) {
      wx.showToast({ title, icon: 'none' });
    },

    showModalInfo(title, content) {
      this.setData({
        showModal: true,
        modalTitle: title,
        modalContent: content
      });
    },

    closeModal() {
      this.setData({ showModal: false });
    },

    // Actions
    showUserInfo() {
      this.showModalInfo('个人信息', '当前用户：我的厨房体验官\nID: 888888');
    },

    showInvite() {
      this.showModalInfo('邀请成员', '邀请码：KITCHEN-2024\n请让家庭成员输入此码加入。');
    },

    createKitchen() {
      this.showModalInfo('创建厨房', '您已拥有默认厨房，无需重复创建。');
    },

    showTutorial() {
      this.showToast('正在打开教程视频...');
    },

    manageCategories() {
      this.showModalInfo('菜品分类', '当前分类：荤、素、蛋、汤、主食');
    },

    addRecipe() {
      wx.showModal({
        title: '添加菜品',
        content: '是否跳转到添加页面？',
        success: (res) => {
          if (res.confirm) {
            this.showToast('跳转成功');
          }
        }
      });
    },

    myRecipes() {
      this.showToast('请前往“点餐”页面查看所有菜品');
    },

    toggleHidden() {
      this.showToast('已切换默认菜品显示状态');
    },

    manageIngCategories() {
      this.showModalInfo('食材分类', '当前分类：肉类、蔬菜、水果、调料');
    },

    addIngredient() {
      wx.showModal({
        title: '添加食材',
        editable: true,
        placeholderText: '输入食材名称',
        success: (res) => {
          if (res.confirm && res.content) {
            const ings = this.data.ingredients;
            ings.push(res.content);
            this.setData({ ingredients: ings });
            this.showToast('添加成功');
          }
        }
      });
    },

    myIngredients() {
      if (this.data.ingredients.length === 0) {
        this.showModalInfo('我的食材', '冰箱空空如也，快去添加吧');
      } else {
        this.setData({ showIngredientList: true });
      }
    },

    closeIngList() {
      this.setData({ showIngredientList: false });
    },

    contactService() {
      this.showModalInfo('联系客服', '客服电话：400-888-8888\n工作时间：9:00-18:00');
    },

    feedback() {
      this.showToast('感谢您的反馈，我们会做得更好');
    },

    shareApp() {
      this.showToast('点击右上角菜单进行分享');
    },

    moreApps() {
      this.showToast('更多精彩敬请期待');
    }
  }
})