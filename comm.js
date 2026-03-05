var app = getApp();
var timer;
var autoTimer;

// 工具函数保持不变
function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2) + " "
    }
  )
  return (hexArr.join('')).toUpperCase();
}

function ab2Str(arrayBuffer) {
  let unit8Arr = new Uint8Array(arrayBuffer);
  let encodedString = String.fromCharCode.apply(null, unit8Arr);
  return encodedString;
}

function stringToBytes(str) {
  var ch, st, re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i);
    st = [];
    do {
      st.push(ch & 0xFF);
      ch = ch >> 8;
    } while (ch);
    re = re.concat(st.reverse());
  }
  return re;
}

Page({
  data: {
    // 原有数据保持不变
    device: null,
    connected: false,
    readyRec: false,
    hexSend: false,
    hexRec: false,
    chs: [],
    deviceadd: "  ",
    windowHeight: 0,
    navbarHeight: 0,
    headerHeight: 0,
    scrollViewHeight: 300,
    recdata: "",
    rxCount: 0,
    txCount: 0,
    rxRate: 0,
    txRate: 0,
    connectState: "正在连接",
    reconnect: "连接中...",
    timRX: 0,
    timTX: 0,
    sendText: "",
    autoSendInv: 50,
    autosendEn: false,
    autosendText: "自动发送",
    showModal: false,
    showModalStatus: false,
    showTips: "",
    animationData: {},
    keyboardVisible: false,
    scrollToView: '',
    
    // 数据分析相关数据
    temp: {
      value: null,
      unit: "℃",
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    humi: {
      value: null,
      unit: "%",
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    adc: {
      value: null,
      unit: "",
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    volt: {
      value: null,
      unit: "V",
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    dataHistoryLimit: 100,  // 历史数据上限
    dataAnalysisReady: false, // 数据分析按钮是否就绪
    dataAnalysisTimer: null,  // 数据分析初始化定时器
    dataAnalysisCountdown: 4  // 倒计时秒数
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    app.readSetting()
    this.data.device = app.globalData.ble_device
    this.data.readyRec = false
    this.setData({
      autoSendInv: app.globalData.mautoSendInv,
      sendText: app.globalData.msendText,
      showModal: false,
      keyboardVisible: false,
      dataAnalysisReady: false,
      dataAnalysisCountdown: 4
    })

    // 启动数据分析按钮的4秒倒计时
    this.startDataAnalysisCountdown();
    
    // 蓝牙连接状态监听 - 移除自动重连逻辑
    wx.onBLEConnectionStateChange((res) => {
      console.log(`蓝牙连接状态变化: ${res.connected}`)
      // 更新全局连接状态
      app.globalData.isConnected = res.connected;
      if (!res.connected && this.data.device && this.data.device.deviceId === res.deviceId) {
        this.setData({
          connected: false,
          connectState: "已断开",
          reconnect: "重新连接"
        })
        wx.setNavigationBarTitle({
          title: "已断开 " + this.data.device.name
        })
      } else if (res.connected && this.data.device && this.data.device.deviceId === res.deviceId) {
        this.setData({
          connected: true,
          connectState: "已连接",
          reconnect: "断开连接"
        })
        wx.setNavigationBarTitle({
          title: "已连接 " + this.data.device.name
        })
      }
    })
    
    if (this.data.device == null) {
      this.calScrolHigh()
      return
    }
    
    const deviceId = this.data.device.deviceId
    this.setData({
      deviceadd: "MAC " + deviceId
    })
    this.calScrolHigh()
    const name = this.data.device.name
    console.log("device = ", this.data.device)
    this.serviceu = app.globalData.mserviceuuid.toUpperCase()
    this.txdu = app.globalData.mtxduuid.toUpperCase()
    this.rxdu = app.globalData.mrxduuid.toUpperCase()
    console.log("target uuids = ", this.serviceu, this.txdu, this.rxdu)
    wx.setNavigationBarTitle({
      title: "正在连接 " + this.data.device.name
    })
    
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        // 保存设备信息到全局
        app.globalData.ble_device = this.data.device;
        
        this.setData({
          connected: true,
          name,
          deviceId,
          connectState: "读取服务",
          reconnect: "断开连接"
        })
        wx.setNavigationBarTitle({
          title: "已连接 " + this.data.device.name
        })
        // 更新全局连接状态
        app.globalData.isConnected = true;
        
        this.Countdown();
        this.getBLEDeviceServices(deviceId)
      }
    })
  },

  /**
   * 跳转到数据分析页面
   */
  toggleDataAnalysis: function() {
    if (!this.data.dataAnalysisReady) {
      this.showModalTips("数据初始化中，请等待 " + this.data.dataAnalysisCountdown + " 秒");
      return;
    }

    // 确保数据已更新到全局
    this.updateGlobalAnalysisData();
    
    wx.navigateTo({
      url: '/pages/data_analysis/data_analysis'
    });
  },

  /**
   * 启动数据分析按钮的倒计时
   */
  startDataAnalysisCountdown: function() {
    const that = this;
    let countdown = this.data.dataAnalysisCountdown;

    this.data.dataAnalysisTimer = setInterval(function() {
      countdown--;
      that.setData({
        dataAnalysisCountdown: countdown
      });

      if (countdown <= 0) {
        clearInterval(that.data.dataAnalysisTimer);
        that.setData({
          dataAnalysisReady: true
        });
      }
    }, 1000);
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    if (this.data.dataAnalysisTimer) {
      clearInterval(this.data.dataAnalysisTimer);
    }
  },

  /**
   * 更新全局数据分析数据
   */
  updateGlobalAnalysisData: function() {
    if (!app.globalData.analysisData) {
      app.globalData.analysisData = {};
    }
    
    app.globalData.analysisData = {
      temp: this.data.temp,
      humi: this.data.humi,
      adc: this.data.adc,
      volt: this.data.volt
    };
  },

  /**
   * 数据解析和过滤核心函数 - 修改为无冒号格式
   */
  parseAndFilterData: function(rawData) {
    if (this.data.hexRec) return;

    const lines = rawData.split('\n');
    const now = new Date();
    const timestamp = now.getHours().toString().padStart(2, '0') + ':' +
                      now.getMinutes().toString().padStart(2, '0') + ':' +
                      now.getSeconds().toString().padStart(2, '0');
    const dateStr = now.toLocaleDateString() + ' ' + timestamp;

    lines.forEach(line => {
      // 温度数据解析 - 匹配格式: temp13.7
      if (line.includes('temp')) {
        const tempMatch = line.match(/temp([\d.]+)/);
        if (tempMatch && tempMatch[1]) {
          this.updateData('temp', parseFloat(tempMatch[1]), timestamp, dateStr);
        }
      }
      // 湿度数据解析 - 匹配格式: humi12.5
      else if (line.includes('humi')) {
        const humiMatch = line.match(/humi([\d.]+)/);
        if (humiMatch && humiMatch[1]) {
          this.updateData('humi', parseFloat(humiMatch[1]), timestamp, dateStr);
        }
      }
      // ADC数据解析 - 匹配格式: ADC1056
      else if (line.includes('ADC')) {
        const adcMatch = line.match(/ADC(\d+)/);
        if (adcMatch && adcMatch[1]) {
          this.updateData('adc', parseInt(adcMatch[1]), timestamp, dateStr);
        }
      }
      // 电压数据解析 - 匹配格式: volt2.5
      else if (line.includes('volt')) {
        const voltMatch = line.match(/volt([\d.]+)/);
        if (voltMatch && voltMatch[1]) {
          this.updateData('volt', parseFloat(voltMatch[1]), timestamp, dateStr);
        }
      }
    });
  },

  /**
   * 更新数据并计算统计值
   */
  updateData: function(type, value, time, dateStr) {
    const data = this.data[type];
    const newHistory = [...data.history];
    
    // 检查是否为重复数据（相同时间戳和值）
    const lastItem = newHistory[newHistory.length - 1];
    if (!(lastItem && lastItem.time === dateStr && lastItem.value === value)) {
      // 添加新数据到历史记录
      newHistory.push({
        value: value,
        time: dateStr
      });
      
      // 限制历史记录长度
      if (newHistory.length > this.data.dataHistoryLimit) {
        newHistory.shift(); // 移除最旧的数据
      }
    }
    
    // 计算最大值、最小值和平均值
    const values = newHistory.map(item => item.value);
    const max = values.length > 0 ? Math.max(...values) : null;
    const min = values.length > 0 ? Math.min(...values) : null;
    const avg = values.length > 0 ? (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2) : null;
    
    // 更新数据
    this.setData({
      [type]: {
        ...data,
        value: value,
        time: time,
        max: max,
        min: min,
        avg: avg,
        history: newHistory
      }
    });

    // 实时更新全局数据
    this.updateGlobalAnalysisData();
  },

  // 以下为原有函数，保持不变
  onInputFocus: function() {
    this.setData({
      keyboardVisible: true
    });
  },
  
  onInputBlur: function() {
    this.setData({
      keyboardVisible: false
    });
  },
  
  goclear: function() {
    this.setData({
      recdata: "",
      rxCount: 0,
      txCount: 0,
    })
  },
  
  Countdown: function() {
    var that = this;
    timer = setTimeout(function() {
      that.setData({
        rxRate: that.data.timRX * 2,
        txRate: that.data.timTX * 2,
      })
      that.setData({
        timRX: 0,
        timTX: 0,
      })
      that.Countdown();
    }, 500);
  },
  
  autoSend: function() {
    var that = this;
    if (this.data.connected) {
      this.data.autosendEn = true
      autoTimer = setTimeout(function() {
        that.autoSend();
        that.gosend();
      }, this.data.autoSendInv);
    } else {
      this.data.autosendEn = false
      clearTimeout(autoTimer);
      this.setData({
        autosendText: "自动发送"
      })
    }
  },
  
  preventTouchMove: function() {},
  
  goautosend: function() {
    if (!this.data.connected) {
      this.showModalTips("请先连接BLE设备...")
      return
    }
    if (!this.data.autosendEn) {
      this.autoSend();
      this.setData({
        autosendText: "停止发送"
      })
    } else {
      this.data.autosendEn = false
      clearTimeout(autoTimer);
      this.setData({
        autosendText: "自动发送"
      })
    }
  },
  
  voteTitle: function(e) {
    this.data.sendText = e.detail.value;
  },
  
  onHide: function() {
    console.warn("onHide - preserving Bluetooth connection")
  },
  
  onUnload: function() {
    app.saveSetting(this.data.autoSendInv, this.data.sendText)
    if (this.data.connected) {
      wx.closeBLEConnection({
        deviceId: this.data.deviceId
      })
      console.warn("DisConnect ", this.data.deviceId)
      this.data.connected = false
    }
  },
  
  calScrolHigh: function() {
    var that = this
    wx.getSystemInfo({
      success: function(res) {
        that.setData({
          windowHeight: res.windowHeight
        });
      }
    });
    
    let query = wx.createSelectorQuery().in(this);
    query.select('#v1').boundingClientRect();
    query.select('#v2').boundingClientRect();
    query.select('#v3').boundingClientRect();
    query.select('#v4').boundingClientRect();
    query.select('#v5').boundingClientRect();
    query.select('#v6').boundingClientRect();
    // 如果显示数据分析面板，需要计算其高度
    if (this.data.showDataAnalysis) {
      query.select('#dataAnalysisPanel').boundingClientRect();
    }
    
    query.exec((res) => {
      let index = 0;
      let navbarHeight = res[index++].height + res[4].height;
      let headerHeight = res[index++].height + res[index++].height + res[index++].height + 15;
      
      // 如果显示数据分析面板，加上其高度
      if (this.data.showDataAnalysis) {
        headerHeight += res[index++].height;
      }
      
      let scrollViewHeight = this.data.windowHeight - navbarHeight - headerHeight;
      this.setData({
        scrollViewHeight: scrollViewHeight > 0 ? scrollViewHeight : 100 // 确保最小高度
      });
    });
  },
  
  getBLEDeviceServices: function(deviceId) {
    var that = this
    this.data.readyRec = false
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        var isService = false
        console.log("service size = ", res.services.length)
        for (let i = 0; i < res.services.length; i++) {
          if (this.serviceu == res.services[i].uuid) {
            isService = true
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            this.setData({
              connectState: "获取特征值"
            })
          }
        }
        if (!isService) {
          this.setData({
            connectState: "UUID错误"
          })
          this.showModalTips(this.serviceu + "\r找不到目标服务UUID  请确认UUID是否设置正确或重新连接")
        }
      }
    })
  },
  
  getBLEDeviceCharacteristics: function(deviceId, serviceId) {
    const that = this
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        var ismy_service = false
        console.log("compute ", serviceId, this.serviceu)
        if (serviceId == this.serviceu) {
          ismy_service = true
          console.warn("this is my service ")
        }
        console.log('getBLEDeviceCharacteristics success', res.characteristics)
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          if (ismy_service) {
            console.log("-----------------------")
          }
          console.log("this properties = ", item.properties)
          if (item.properties.read) {
            console.log("[Read]", item.uuid)
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
            console.log("[Write]", item.uuid)
            this._deviceId = deviceId
            if (ismy_service && (this.txdu == item.uuid)) {
              console.warn("find write uuid  ready to ", item.uuid)
              this._characteristicId = item.uuid
              this._serviceId = serviceId
            }
          }
          if (item.properties.notify || item.properties.indicate) {
            console.log("[Notify]", item.uuid)
            if (ismy_service && (this.rxdu == item.uuid)) {
              console.warn("find notity uuid try enablec....", item.uuid)
              wx.notifyBLECharacteristicValueChange({
                deviceId,
                serviceId,
                characteristicId: item.uuid,
                state: true,
                success(res) {
                  console.warn('notifyBLECharacteristicValueChange success', res.errMsg)
                  that.setData({
                    connectState: "连接成功"
                  })
                  that.data.readyRec = true
                }
              })
            }
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res)
      }
    })
    
    wx.onBLECharacteristicValueChange((characteristic) => {
      var buf = new Uint8Array(characteristic.value)
      var nowrecHEX = ab2hex(characteristic.value)
      console.warn("rec: ", nowrecHEX, characteristic.characteristicId)
      var recStr = ab2Str(characteristic.value)
      console.warn("recstr: ", recStr, characteristic.characteristicId)
      if (this.rxdu != characteristic.characteristicId) {
        console.error("no same : ", this.rxdu, characteristic.characteristicId)
        return
      }
      if (!this.data.readyRec) return
      var mrecstr
      if (this.data.hexRec) {
        mrecstr = nowrecHEX
      } else {
        mrecstr = recStr
      }
      if (this.data.recdata.length > 3000) {
        this.data.recdata = this.data.recdata.substring(mrecstr.length, this.data.recdata.length)
      }
      console.warn("RXlen: ", buf.length)
      // 更新数据并设置自动滚动到底部
      // 使用交替的ID值确保每次都能触发滚动
      const scrollToViewId = this.data.scrollToView === 'bottom-anchor' ? 'bottom-anchor-2' : 'bottom-anchor';
      
      this.setData({
        recdata: this.data.recdata + mrecstr,
        rxCount: this.data.rxCount + buf.length,
        timRX: this.data.timRX + buf.length,
        scrollToView: scrollToViewId
      })

      // 调用数据解析和过滤函数
      this.parseAndFilterData(mrecstr);
    })
  },
  
  writeBLECharacteristicValue: function() {
    let buffer = new ArrayBuffer(1)
    let dataView = new DataView(buffer)
    dataView.setUint8(0, Math.random() * 255 | 0)
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._deviceId,
      characteristicId: this._characteristicId,
      value: buffer,
    })
  },
  
  gotoback: function() {
    if (this.data.device == null) {
      wx.navigateTo({
        url: '/pages/index/index',
      })
      return
    }
    clearTimeout(timer)
    wx.closeBLEConnection({
      deviceId: this.data.deviceId,
      success: () => {
        console.log("蓝牙连接已断开")
      },
      fail: (res) => {
        console.error("断开蓝牙连接失败:", res)
      }
    })
    this.setData({
      connected: false,
      chs: [],
    })
    // 使用reLaunch替换navigateBack，确保首页完全重新加载并触发onLoad和onShow
    wx.reLaunch({
      url: '/pages/index/index',
    })
  },
  
  gosend: function() {
    if (!this.data.connected) {
      this.showModalTips("请先连接BLE设备...")
      return
    }
    var that = this;
    var hex = this.data.sendText
    var buffer1
    if (this.data.hexSend) {
      var typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(function(h) {
        return parseInt(h, 16)
      }))
      console.log("hextobyte ", typedArray)
      buffer1 = typedArray.buffer
    } else {
      var strbuf = new Uint8Array(stringToBytes(hex))
      console.log("strtobyte ", strbuf)
      buffer1 = strbuf.buffer
    }
    console.log("Txbuf = ", buffer1)
    if (buffer1 == null) return
    const txlen = buffer1.byteLength
    wx.writeBLECharacteristicValue({
      deviceId: that._deviceId,
      serviceId: that._serviceId,
      characteristicId: that._characteristicId,
      value: buffer1,
      success: function(res) {
        that.setData({
          txCount: that.data.txCount + txlen,
          timTX: that.data.timTX + txlen
        })
        console.log(res);
      },
      fail: function(res) {
        console.log(res);
      },
      complete: function(res) {}
    })
  },
  
  hexsend: function(e) {
    console.log("checking ", e.detail.value)
    var selected = e.detail.value.length > 0
    this.setData({
      hexSend: selected,
    })
    console.log("hexsend ", this.data.hexSend)
  },
  
  hexrec: function(e) {
    console.log("checking ", e.detail.value)
    var selected = e.detail.value.length > 0
    this.setData({
      hexRec: selected,
    })
    console.log("hexRec = ", this.data.hexRec)
  },
  
  godisconnect: function() {
    if (this.data.connected) {
      wx.closeBLEConnection({
        deviceId: this.data.deviceId
      })
      this.setData({
        connected: false,
        reconnect: "重新连接",
        connectState: "已断开",
      })
      wx.setNavigationBarTitle({
        title: "已断开 " + this.data.device.name
      })
      this.showModalTips(this.data.device.name + "已断开连接...")
    } else {
      wx.setNavigationBarTitle({
        title: "正在连接 " + this.data.device.name
      })
      this.setData({
        connectState: "正在连接",
        reconnect: "连接中...",
      })
      wx.createBLEConnection({
        deviceId: this.data.deviceId,
        success: (res) => {
          this.setData({
            connected: true,
            connectState: "读取服务",
            reconnect: "断开连接",
            recdata: "",
            rxCount: 0,
            txCount: 0,
          })
          wx.setNavigationBarTitle({
            title: "已连接 " + this.data.device.name
          })
          this.getBLEDeviceServices(this.data.deviceId)
        }
      })
    }
  },
  
  settime: function() {
    console.log("Click Time set");
    if (this.data.autosendEn) {
      this.data.autosendEn = false
      clearTimeout(autoTimer);
      this.setData({
        autosendText: "自动发送"
      })
    }
    
    this.setData({
      showModal: true,
      keyboardVisible: false
    });
  },
  
  timeinputChange: function(e) {
    this.autoC = true
    this.inputinv = e.detail.value;
    console.log("minputC", this.inputinv)
    
    if (this.inputinv === "") {
      this.setData({
        autoSendInv: ""
      });
    } else {
      this.setData({
        autoSendInv: parseInt(this.inputinv) || ""
      });
    }
  },
  
  hideModal: function() {
    this.setData({
      showModal: false,
      keyboardVisible: false
    }, () => {
      console.log("弹窗已关闭，状态:", this.data.showModal);
    });
  },
  
  onCancel: function() {
    this.hideModal();
  },
  
  onConfirm: function() {
    let newInv = parseInt(this.inputinv) || 50;
    newInv = Math.min(Math.max(newInv, 10), 5000);
    
    this.setData({
      autoSendInv: newInv,
      showModal: false,
      keyboardVisible: false
    })
    console.log("时间设置为:", newInv);
  },
  
  showModalTips: function(str) {
    var that = this
    this.setData({
      showTips: str,
      showModalStatus: true
    })
    
    setTimeout(function() {
      that.hideModalTips();
    }, 2500)
  },
  
  hideModalTips: function() {
    this.setData({
      showModalStatus: false
    })
  },

  onShow: function() {
    this.setData({
      showModal: false,
      keyboardVisible: false
    });
  },

  /**
   * 跳转到功能按键页面
   */
  gotoFunctionButtons: function() {
    wx.navigateTo({
      url: '../function_buttons/function_buttons'
    });
  },

})
