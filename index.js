//		@sulingkai
//		2025-08
//		@version 1.0.2
const app = getApp()

function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

Page({
  onLoad() {
    // 页面加载时检查蓝牙状态并自动启动搜索
    this.getBluetoothAdapterState();
    // 初始化搜索状态变量
    this._discoveryStarted = false;
    // 请求蓝牙和位置权限
    this.requestBluetoothPermissions();
    // 检查是否被禁止访问
    this.checkAccessRestriction();
    // 页面加载后自动点击搜索蓝牙设备按钮
    this.autoStartBluetoothSearch();
  },
  onShow() {
    // 页面显示时更新蓝牙状态并自动重启搜索
    this.getBluetoothAdapterState();
    // 如果不在搜索状态且蓝牙可用，自动开始搜索
    if (!this._discoveryStarted && this.data.bluetoothStatus === "蓝牙已开启") {
      this.startBluetoothDevicesDiscovery();
    }
  },

  data: {
    devices: [],
    connected: false,
    chs: [], 
    misScanding: false,
    scandbutName:"搜索蓝牙设备",
    bluetoothStatus: "未连接",
    bluetoothIcon: "/images/bluetooth_off.svg",  // 修正为svg
    // 密码输入弹窗相关数据
    showPasswordModal: false,
    passwordInput: '',
    passwordError: false,
    // 密码错误计数和访问限制
    passwordErrorCount: 0,
    accessRestricted: false,
    restrictionEndTime: null
  },
  
  // 页面加载后自动点击搜索蓝牙设备按钮
  autoStartBluetoothSearch: function() {
    // 延迟一段时间后自动开始搜索，确保页面完全加载
    setTimeout(() => {
      // 只有在蓝牙未开启时才自动点击按钮
      if (this.data.bluetoothStatus !== "蓝牙已开启") {
        this.openBluetoothAdapter();
      }
    }, 500);
  },
  
  // 检查访问限制
  checkAccessRestriction: function() {
    // 从本地存储获取密码错误次数和限制结束时间
    const errorCount = wx.getStorageSync('passwordErrorCount') || 0;
    const restrictionEnd = wx.getStorageSync('restrictionEndTime');
    
    // 检查是否还在限制期内
    if (restrictionEnd) {
      const now = new Date().getTime();
      if (now < restrictionEnd) {
        // 仍在限制期内
        this.setData({
          accessRestricted: true,
          restrictionEndTime: restrictionEnd
        });
        return;
      } else {
        // 限制期已过，清除限制
        wx.removeStorageSync('passwordErrorCount');
        wx.removeStorageSync('restrictionEndTime');
        this.setData({
          accessRestricted: false,
          restrictionEndTime: null
        });
      }
    }
    
    // 设置当前错误次数
    this.setData({
      passwordErrorCount: errorCount
    });
  },
  
  // 请求蓝牙和位置权限
  requestBluetoothPermissions() {
    wx.getSetting({
      success: (res) => {
        // 检查蓝牙权限
        if (!res.authSetting['scope.bluetooth']) {
          wx.authorize({
            scope: 'scope.bluetooth',
            success: () => {
              console.log('蓝牙权限获取成功');
            },
            fail: () => {
              wx.showModal({
                title: '提示',
                content: '请在设置中开启蓝牙权限以使用蓝牙功能',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        }
        
        // 检查位置权限（Android设备必须）
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              console.log('位置权限获取成功');
              // 授权成功后重新扫描设备
              this.getBluetoothAdapterState();
            },
            fail: () => {
              console.log('位置权限获取失败，请在设置中开启位置权限以搜索蓝牙设备');
            }
          });
        }
      }
    });
  },
  
  openBluetoothAdapter() {
    this.misScanding = false
    this.setData({
      bluetoothStatus: "正在打开蓝牙...",
      bluetoothIcon: "/images/bluetooth_searching.svg"  
    })
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('openBluetoothAdapter success', res)
        this.setData({
          bluetoothStatus: "蓝牙已开启",
          bluetoothIcon: "/images/bluetooth_on.svg" 
        })
        // 蓝牙开启成功后自动启动搜索
        this.startBluetoothDevicesDiscovery()
      },
      fail: (res) => {
        console.error('openBluetoothAdapter fail', res)
        this.setData({
          bluetoothStatus: "蓝牙开启失败",
          bluetoothIcon: "/images/bluetooth_off.svg"  
        })
        if (res.errCode === 10001) {
          wx.onBluetoothAdapterStateChange((res) => {
            console.log('onBluetoothAdapterStateChange', res)
            this.setData({
              bluetoothStatus: res.available ? "蓝牙已开启" : "蓝牙已关闭",
              bluetoothIcon: res.available ? "/images/bluetooth_on.svg" : "/images/bluetooth_off.svg"
            })
            // 蓝牙状态变为可用时自动开始搜索
            if (res.available) {
              this.startBluetoothDevicesDiscovery()
            }
          })
        }
      }
    })
  },
  getBluetoothAdapterState() {
    wx.getBluetoothAdapterState({
      success: (res) => {
        console.log('getBluetoothAdapterState', res)
        // 更新蓝牙状态UI
        this.setData({
          bluetoothStatus: res.available ? "蓝牙已开启" : "蓝牙已关闭",
          bluetoothIcon: res.available ? "/images/bluetooth_on.svg" : "/images/bluetooth_off.svg" 
        })
        if (res.discovering) {
          this.onBluetoothDeviceFound()
        } else if (res.available) {
          // 蓝牙可用但未搜索时自动启动搜索
          this.startBluetoothDevicesDiscovery()
        }
      },
      fail: (res) => {
        console.error('getBluetoothAdapterState fail', res)
        this.setData({
          bluetoothStatus: "蓝牙状态未知",
          bluetoothIcon: "/images/bluetooth_off.svg" 
        })
      }
    })
  },
  startBluetoothDevicesDiscovery() {
    var that = this;
    if (this._discoveryStarted) {
      this.stopBluetoothDevicesDiscovery()
      return
    }
    this.setData({ 
      misScanding: true, 
      scandbutName: "正在搜索，点击停止", 
      devices: [],
      chs: [],
    })
    this._discoveryStarted = true
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: (res) => {
        setTimeout(function () {
          console.log("----BluetoothDevicesDiscovery finish---- ");
          if (that._discoveryStarted){
            that.stopBluetoothDevicesDiscovery()
          }
        }, 20000);
        console.log('startBluetoothDevicesDiscovery success', res)
        this.onBluetoothDeviceFound()
      },
    })
  },
  stopBluetoothDevicesDiscovery() {
    this._discoveryStarted = false
    wx.stopBluetoothDevicesDiscovery()
    this.setData({ 
      misScanding: false, 
      scandbutName:"重新刷新列表", 
    })
  },
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return
        }
        const foundDevices = this.data.devices
        const idx = inArray(foundDevices, 'deviceId', device.deviceId)
        const data = {}
        if (idx === -1) {
          data[`devices[${foundDevices.length}]`] = device
        } else {
          data[`devices[${idx}]`] = device
        }
        this.setData(data)
      })
    })
  },
  goto_Comm(e){
    app.globalData.ble_device = e.currentTarget.dataset
    this.stopBluetoothDevicesDiscovery()
    wx.navigateTo({
      url: '/pages/comm/comm',
    })
  },
  createBLEConnection(e) {
    const ds = e.currentTarget.dataset
    const deviceId = ds.deviceId
    const name = ds.name
    this.setData({
      bluetoothStatus: "正在连接设备...",
      bluetoothIcon: "/images/bluetooth_connecting.svg" 
    })
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        this.setData({
          connected: true,
          name,
          deviceId,
          bluetoothStatus: "已连接: " + name,
          bluetoothIcon: "/images/bluetooth_connected.svg" 
        })
        this.getBLEDeviceServices(deviceId)
      },
      fail: (err) => {
        console.error('连接设备失败', err)
        this.setData({
          bluetoothStatus: "连接失败",
          bluetoothIcon: "/images/bluetooth_on.svg" 
        })
      }
    })
    this.stopBluetoothDevicesDiscovery()
  },
  closeBLEConnection() {
    this.setData({
      bluetoothStatus: "已断开连接",
      bluetoothIcon: "/images/bluetooth_on.svg"  
    })
    wx.closeBLEConnection({
      deviceId: this.data.deviceId
    })
    this.setData({
      connected: false,
      chs: [],
      canWrite: false,
    })
  },
  getBLEDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            return
          }
        }
      }
    })
  },
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success', res.characteristics)
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          if (item.properties.read) {
            wx.readBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            })
          }
          if (item.properties.write) {
            this.setData({
              canWrite: true
            })
            this._deviceId = deviceId
            this._serviceId = serviceId
            this._characteristicId = item.uuid
            this.writeBLECharacteristicValue()
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
            })
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res)
      }
    })
    // 操作之前先监听，保证第一时间获取数据
    wx.onBLECharacteristicValueChange((characteristic) => {
      const idx = inArray(this.data.chs, 'uuid', characteristic.characteristicId)
      const data = {}
      if (idx === -1) {
        data[`chs[${this.data.chs.length}]`] = {
          uuid: characteristic.characteristicId,
          value: ab2hex(characteristic.value)
        }
      } else {
        data[`chs[${idx}]`] = {
          uuid: characteristic.characteristicId,
          value: ab2hex(characteristic.value)
        }
      }
      this.setData(data)
    })
  },
  writeBLECharacteristicValue() {
    // 向蓝牙设备发送一个0x00的16进制数据
    let buffer = new ArrayBuffer(1)
    let dataView = new DataView(buffer)
    dataView.setUint8(0, Math.random() * 255 | 0)
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._characteristicId,
      value: buffer,
      success: (res) => {
        console.log('写入成功', res)
      },
      fail: (err) => {
        console.error('写入失败', err)
      }
    })
  },
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  },
  gotoabout: function () {
      wx.navigateTo({
        url: '/pages/about/about',
      })
  },
  // 修改匹配UUID按钮的点击事件，显示密码输入弹窗
  gotosetuuid(){
    // 检查是否被禁止访问
    if (this.data.accessRestricted) {
      const now = new Date().getTime();
      const remainingTime = Math.ceil((this.data.restrictionEndTime - now) / (1000 * 60 * 60)); // 剩余小时数
      wx.showModal({
        title: '访问受限',
        content: `由于连续输入错误密码，您已被禁止访问此功能。请在${remainingTime}小时后重试。`,
        showCancel: false,
        confirmText: '确定'
      });
      return;
    }
    
    this.setData({
      showPasswordModal: true,
      passwordInput: '',
      passwordError: false
    });
  },
  // 密码输入事件处理
  onPasswordInput: function(e) {
    this.setData({
      passwordInput: e.detail.value
    });
  },
  // 取消密码输入
  cancelPassword: function() {
    this.setData({
      showPasswordModal: false,
      passwordInput: '',
      passwordError: false
    });
  },
  // 确认密码输入
  confirmPassword: function() {
    // 验证密码是否正确（密码为200513）
    if (this.data.passwordInput === '200513') {
      // 密码正确，重置错误计数
      this.setData({
        passwordErrorCount: 0,
        showPasswordModal: false,
        passwordInput: '',
        passwordError: false
      });
      // 清除本地存储中的错误计数
      wx.removeStorageSync('passwordErrorCount');
      wx.removeStorageSync('restrictionEndTime');
      
      wx.navigateTo({
        url: '/pages/setuuid/setuuid',
      });
    } else {
      // 密码错误，增加错误计数
      const newErrorCount = this.data.passwordErrorCount + 1;
      this.setData({
        passwordErrorCount: newErrorCount,
        passwordError: true
      });
      
      // 保存错误计数到本地存储
      wx.setStorageSync('passwordErrorCount', newErrorCount);
      
      // 如果错误次数达到3次，设置24小时限制
      if (newErrorCount >= 3) {
        const restrictionEnd = new Date().getTime() + (24 * 60 * 60 * 1000); // 24小时后
        wx.setStorageSync('restrictionEndTime', restrictionEnd);
        this.setData({
          accessRestricted: true,
          restrictionEndTime: restrictionEnd
        });
        
        // 显示限制提示
        wx.showModal({
          title: '访问受限',
          content: '由于连续输入错误密码3次，您已被禁止访问此功能24小时。',
          showCancel: false,
          confirmText: '确定'
        });
      }
      
      // 1秒后清除错误提示
      setTimeout(() => {
        this.setData({
          passwordError: false
        });
      }, 1000);
    }
  },
  // 页面卸载时清理资源
  onUnload() {
    wx.offBluetoothDeviceFound();
    wx.offBLECharacteristicValueChange();
    wx.offBluetoothAdapterStateChange();
    this.stopBluetoothDevicesDiscovery();
  }
})