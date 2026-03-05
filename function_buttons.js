var app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    editMode: false,
    buttons: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 从本地存储加载按钮配置
    this.loadButtonConfig();
  },

  /**
   * 从本地存储加载按钮配置
   */
  loadButtonConfig: function() {
    let buttons = wx.getStorageSync('function_buttons') || [];
    
    // 兼容旧版本数据结构
    buttons = buttons.map(button => {
      if (!button.pressData) {
        return {
          ...button,
          pressData: button.data || '00',
          releaseData: '00'
        };
      }
      return button;
    });
    
    // 如果没有按钮，使用默认按钮
    if (buttons.length === 0) {
      buttons = this.getDefaultButtons();
    }

    this.setData({
      buttons: buttons
    });
  },

  /**
   * 获取默认按钮配置
   */
  getDefaultButtons: function() {
    return [
      {
        id: 1,
        name: '前进',
        pressData: '01',
        releaseData: '02',
        isHex: true
      },
      {
        id: 2,
        name: '后退',
        pressData: '03',
        releaseData: '04',
        isHex: true
      },
      {
        id: 3,
        name: '左转',
        pressData: '05',
        releaseData: '06',
        isHex: true
      },
      {
        id: 4,
        name: '右转',
        pressData: '07',
        releaseData: '08',
        isHex: true
      }
    ];
  },

  /**
   * 切换编辑模式
   */
  toggleEditMode: function() {
    const editMode = !this.data.editMode;
    this.setData({
      editMode: editMode
    });

    // 如果退出编辑模式，保存配置
    if (!editMode) {
      this.saveButtonConfig();
    }
  },

  /**
   * 保存按钮配置到本地存储
   */
  saveButtonConfig: function() {
    wx.setStorageSync('function_buttons', this.data.buttons);
    wx.showToast({
      title: '配置已保存',
      icon: 'success',
      duration: 2000
    });
  },

  /**
   * 按钮按下事件
   */
  onButtonPress: function(e) {
    if (this.data.editMode) return;

    const buttonId = e.currentTarget.dataset.id;
    const button = this.data.buttons.find(b => b.id === buttonId);

    if (button) {
      this.sendButtonData(button, 'press');
    }
  },

  /**
   * 按钮释放事件
   */
  onButtonRelease: function(e) {
    if (this.data.editMode) return;

    const buttonId = e.currentTarget.dataset.id;
    const button = this.data.buttons.find(b => b.id === buttonId);

    if (button) {
      this.sendButtonData(button, 'release');
    }
  },

  /**
   * 发送按钮数据
   */
  sendButtonData: function(button, actionType) {
    if (!app.globalData.isConnected) {
      wx.showToast({
        title: '未连接设备',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否有连接的设备
    if (!app.globalData.ble_device || !app.globalData.ble_device.deviceId) {
      wx.showToast({
        title: '设备信息缺失',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    let dataToSend = actionType === 'press' ? button.pressData : button.releaseData;

    // 如果是十六进制格式，需要转换
    if (button.isHex) {
      // 移除所有非十六进制字符
      dataToSend = dataToSend.replace(/[^0-9A-Fa-f]/g, '');
      // 确保字符数为偶数
      if (dataToSend.length % 2 !== 0) {
        dataToSend = dataToSend.slice(0, -1);
      }

      // 如果处理后的数据为空，则不发送
      if (dataToSend.length === 0) {
        console.log('处理后的数据为空，不执行发送操作:', button.name, actionType);
        return;
      }

      // 转换为ArrayBuffer
      const buffer = new ArrayBuffer(dataToSend.length / 2);
      const uint8Array = new Uint8Array(buffer);
      for (let i = 0; i < dataToSend.length; i += 2) {
        uint8Array[i / 2] = parseInt(dataToSend.substring(i, i + 2), 16);
      }

      // 发送十六进制数据
      wx.writeBLECharacteristicValue({
        deviceId: app.globalData.ble_device.deviceId,
        serviceId: app.globalData.mserviceuuid,
        characteristicId: app.globalData.mtxduuid,
        value: buffer,
        success: () => {
          console.log('发送成功:', button.name, actionType, dataToSend);
          wx.showToast({
            title: '发送成功',
            icon: 'success',
            duration: 1000
          });
        },
        fail: (error) => {
          console.error('发送失败:', error);
          wx.showToast({
            title: '发送失败',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else {
      // 如果文本数据为空，则不发送
      if (dataToSend.length === 0) {
        console.log('文本数据为空，不执行发送操作:', button.name, actionType);
        return;
      }

      // 发送文本数据
      const buffer = new ArrayBuffer(dataToSend.length);
      const uint8Array = new Uint8Array(buffer);
      for (let i = 0; i < dataToSend.length; i++) {
        uint8Array[i] = dataToSend.charCodeAt(i);
      }

      wx.writeBLECharacteristicValue({
        deviceId: app.globalData.ble_device.deviceId,
        serviceId: app.globalData.mserviceuuid,
        characteristicId: app.globalData.mtxduuid,
        value: buffer,
        success: () => {
          console.log('发送成功:', button.name, actionType, dataToSend);
          wx.showToast({
            title: '发送成功',
            icon: 'success',
            duration: 1000
          });
        },
        fail: (error) => {
          console.error('发送失败:', error);
          wx.showToast({
            title: '发送失败',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }
  },

  /**
   * 一键授时功能
   */
  syncTime: function() {
    // 检查蓝牙连接状态
    if (!app.globalData.isConnected) {
      wx.showToast({
        title: '未连接设备',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否有连接的设备
    if (!app.globalData.ble_device || !app.globalData.ble_device.deviceId) {
      wx.showToast({
        title: '设备信息缺失',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 获取当前时间
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`; // 格式化为 HH:MM，不带换行符

    console.log('准备发送时间:', timeString);

    // 将时间字符串转换为ArrayBuffer
    const buffer = new ArrayBuffer(timeString.length);
    const uint8Array = new Uint8Array(buffer);
    for (let i = 0; i < timeString.length; i++) {
      uint8Array[i] = timeString.charCodeAt(i);
    }

    // 发送时间数据
    wx.writeBLECharacteristicValue({
      deviceId: app.globalData.ble_device.deviceId,
      serviceId: app.globalData.mserviceuuid,
      characteristicId: app.globalData.mtxduuid,
      value: buffer,
      success: () => {
        console.log('授时发送成功:', timeString);
        wx.showToast({
          title: '授时成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (error) => {
        console.error('授时发送失败:', error);
        wx.showToast({
          title: '授时失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 按钮名称改变事件
   */
  onButtonNameChange: function(e) {
    const buttonId = e.currentTarget.dataset.id;
    const newName = e.detail.value;

    const buttons = this.data.buttons.map(button => {
      if (button.id === buttonId) {
        return {...button, name: newName};
      }
      return button;
    });

    this.setData({
      buttons: buttons
    });
  },

  /**
   * 按钮按下数据改变事件
   */
  onButtonPressDataChange: function(e) {
    const buttonId = e.currentTarget.dataset.id;
    const newData = e.detail.value;

    const buttons = this.data.buttons.map(button => {
      if (button.id === buttonId) {
        return {...button, pressData: newData};
      }
      return button;
    });

    this.setData({
      buttons: buttons
    });
  },

  /**
   * 按钮松开数据改变事件
   */
  onButtonReleaseDataChange: function(e) {
    const buttonId = e.currentTarget.dataset.id;
    const newData = e.detail.value;

    const buttons = this.data.buttons.map(button => {
      if (button.id === buttonId) {
        return {...button, releaseData: newData};
      }
      return button;
    });

    this.setData({
      buttons: buttons
    });
  },

  /**
   * 十六进制格式切换事件
   */
  onHexFormatChange: function(e) {
    const buttonId = e.currentTarget.dataset.id;
    const isHex = e.detail.value.length > 0;

    const buttons = this.data.buttons.map(button => {
      if (button.id === buttonId) {
        return {...button, isHex: isHex};
      }
      return button;
    });

    this.setData({
      buttons: buttons
    });
  },

  /**
   * 添加新按钮
   */
  addButton: function() {
    // 确保在编辑模式下
    if (!this.data.editMode) {
      this.setData({
        editMode: true
      });
    }

    // 生成新按钮ID
    const maxId = this.data.buttons.reduce((max, button) => Math.max(max, button.id), 0);
    const newButton = {
      id: maxId + 1,
      name: '新按钮',
      pressData: '00',
      releaseData: '00',
      isHex: true
    };

    const buttons = [...this.data.buttons, newButton];
    this.setData({
      buttons: buttons
    });
  },

  /**
   * 删除按钮
   */
  deleteButton: function(e) {
    const buttonId = e.currentTarget.dataset.id;
    const buttons = this.data.buttons.filter(button => button.id !== buttonId);

    this.setData({
      buttons: buttons
    });
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    // 确保保存配置
    if (this.data.editMode) {
      this.saveButtonConfig();
    }
  }
})