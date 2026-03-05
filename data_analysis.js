var app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    deviceInfo: '',
    temp: {
      value: null,
      unit: '℃',
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    humi: {
      value: null,
      unit: '%',
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    adc: {
      value: null,
      unit: '',
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    volt: {
      value: null,
      unit: 'V',
      time: '',
      max: null,
      min: null,
      avg: null,
      history: []
    },
    exportStatus: '',
    showCharts: false,
    isLoading: false,
    updateTimer: null,
    refreshRate: 500, // 500ms刷新频率，平衡性能和实时性
    canvasContexts: {}, // Canvas上下文缓存
    lastUpdateTime: 0 // 上次更新时间
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (app.globalData.ble_device) {
      this.setData({
        deviceInfo: app.globalData.ble_device.name || '未知设备'
      });
    }

    // 从本地存储读取图表显示状态
    const savedShowCharts = wx.getStorageSync('showCharts');
    if (savedShowCharts !== '') {
      this.setData({
        showCharts: savedShowCharts
      });
    }

    // 初始化Canvas上下文
    this.initCanvasContexts();
  },

  /**
   * 初始化Canvas上下文
   */
  initCanvasContexts: function() {
    const canvasIds = {
      temp: 'tempChart',
      humi: 'humiChart', 
      adc: 'adcChart',
      volt: 'voltChart'
    };
    
    const contexts = {};
    Object.keys(canvasIds).forEach(type => {
      try {
        contexts[type] = wx.createCanvasContext(canvasIds[type]);
      } catch (error) {
        console.warn(`创建${canvasIds[type]}上下文失败:`, error);
      }
    });
    
    this.setData({
      canvasContexts: contexts
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.updateDataFromGlobal();
    this.startDataListening();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    this.stopDataListening();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    this.stopDataListening();
  },

  /**
   * 从全局数据更新当前页面数据
   */
  updateDataFromGlobal: function() {
    if (app.globalData.analysisData) {
      const globalData = app.globalData.analysisData;

      // 深拷贝数据以避免引用问题
      const newTemp = {...this.data.temp, ...globalData.temp, history: [...(globalData.temp.history || [])]};
      const newHumi = {...this.data.humi, ...globalData.humi, history: [...(globalData.humi.history || [])]};
      const newAdc = {...this.data.adc, ...globalData.adc, history: [...(globalData.adc.history || [])]};
      const newVolt = {...this.data.volt, ...globalData.volt, history: [...(globalData.volt.history || [])]};

      this.setData({
        temp: newTemp,
        humi: newHumi,
        adc: newAdc,
        volt: newVolt,
        lastUpdateTime: Date.now()
      });

      // 如果显示图表，更新图表
      if (this.data.showCharts) {
        this.updateAllCharts();
      }
    }
  },

  /**
   * 启动数据监听
   */
  startDataListening: function() {
    if (this.data.updateTimer) {
      clearInterval(this.data.updateTimer);
      this.data.updateTimer = null;
    }

    console.log('开始数据监听，刷新频率：' + this.data.refreshRate + 'ms');
    const that = this;

    this.data.updateTimer = setInterval(() => {
      try {
        that.updateDataFromGlobal();
      } catch (error) {
        console.error('数据更新失败:', error);
      }
    }, this.data.refreshRate);
  },

  /**
   * 停止数据监听
   */
  stopDataListening: function() {
    if (this.data.updateTimer) {
      clearInterval(this.data.updateTimer);
      this.data.updateTimer = null;
    }
  },

  /**
   * 更新所有图表
   */
  updateAllCharts: function() {
    if (!this.data.showCharts || this.data.isLoading) {
      return;
    }

    // 绘制所有类型的图表
    this.drawLineChart('temp', '#FF4500', '温度');
    this.drawLineChart('humi', '#1E90FF', '湿度');
    this.drawLineChart('adc', '#32CD32', 'ADC值');
    this.drawLineChart('volt', '#FFD700', '电压');
  },

  /**
   * 绘制折线图 - 全新简洁实现
   */
  drawLineChart: function(dataType, color, title) {
    const ctx = this.data.canvasContexts[dataType];
    const dataObj = this.data[dataType];
    
    if (!ctx || !dataObj || !dataObj.history || dataObj.history.length === 0) {
      return;
    }

    const history = dataObj.history;
    const canvasWidth = 300;
    const canvasHeight = 200;
    const padding = { top: 25, right: 15, bottom: 40, left: 35 }; // 减少左边距，让纵坐标轴更靠左

    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 数据处理 - 最多显示30个点，保证性能
    const maxPoints = 30;
    let displayData = history;
    if (history.length > maxPoints) {
      const step = Math.floor(history.length / maxPoints);
      displayData = history.filter((_, index) => index % step === 0);
      // 确保包含最新数据点
      if (displayData[displayData.length - 1] !== history[history.length - 1]) {
        displayData.push(history[history.length - 1]);
      }
    }

    // 计算数据范围
    const values = displayData.map(item => item.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = Math.max(maxValue - minValue, 1); // 避免除零
    const padding_y = valueRange * 0.1; // 10%边距

    const yMin = minValue - padding_y;
    const yMax = maxValue + padding_y;
    const yRange = yMax - yMin;

    // 时间范围
    const times = displayData.map(item => new Date(item.time).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeRange = Math.max(maxTime - minTime, 1000); // 避免除零

    // 绘制背景和边框
    ctx.setFillStyle('#f8f9fa');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.setStrokeStyle('#e9ecef');
    ctx.setLineWidth(1);
    ctx.strokeRect(padding.left, padding.top, canvasWidth - padding.left - padding.right, canvasHeight - padding.top - padding.bottom);

    // 绘制标题 
    ctx.setFillStyle('#2c3e50'); // 更深的颜色
    ctx.setFontSize(16); // 增大字体
    ctx.setTextAlign('left');
    const titleText = dataObj.unit ? `${title} (${dataObj.unit})` : title;
    ctx.fillText(titleText, padding.left, 18);

    // 绘制网格线和坐标轴
    this.drawGridAndAxes(ctx, canvasWidth, canvasHeight, padding, yMin, yMax, yRange, displayData, minTime, timeRange);

    // 绘制折线
    this.drawLine(ctx, displayData, canvasWidth, canvasHeight, padding, yMin, yRange, minTime, timeRange, color);

    // 绘制数据点
    this.drawDataPoints(ctx, displayData, canvasWidth, canvasHeight, padding, yMin, yRange, minTime, timeRange, color);

    // 渲染到画布
    ctx.draw();
  },

  /**
   * 绘制网格线和坐标轴
   */
  drawGridAndAxes: function(ctx, canvasWidth, canvasHeight, padding, yMin, yMax, yRange, displayData, minTime, timeRange) {
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    // 绘制Y轴网格线和标签
    ctx.setStrokeStyle('#e9ecef');
    ctx.setLineWidth(0.5);
    ctx.setFillStyle('#666');
    ctx.setFontSize(10);
    ctx.setTextAlign('right');

    const yGridCount = 4;
    for (let i = 0; i <= yGridCount; i++) {
      const y = padding.top + (i * chartHeight / yGridCount);
      const value = yMax - (i * yRange / yGridCount);
      
      // 网格线
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvasWidth - padding.right, y);
      ctx.stroke();
      
      // Y轴标签 - 调整位置到左边缘
      ctx.fillText(value.toFixed(1), padding.left - 3, y + 3);
    }

    // 绘制X轴标签（时间）
    ctx.setTextAlign('center');
    const xGridCount = Math.min(4, displayData.length - 1);
    for (let i = 0; i <= xGridCount; i++) {
      const dataIndex = Math.floor(i * (displayData.length - 1) / xGridCount);
      const time = new Date(displayData[dataIndex].time);
      const x = padding.left + (i * chartWidth / xGridCount);
      
      const timeStr = time.getHours().toString().padStart(2, '0') + ':' + 
                     time.getMinutes().toString().padStart(2, '0');
      
      ctx.fillText(timeStr, x, canvasHeight - padding.bottom + 15);
    }
  },

  /**
   * 绘制折线
   */
  drawLine: function(ctx, displayData, canvasWidth, canvasHeight, padding, yMin, yRange, minTime, timeRange, color) {
    if (displayData.length < 2) return;

    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    ctx.setStrokeStyle(color);
    ctx.setLineWidth(2);
    ctx.beginPath();

    displayData.forEach((item, index) => {
      const x = padding.left + ((new Date(item.time).getTime() - minTime) / timeRange) * chartWidth;
      const y = padding.top + chartHeight - ((item.value - yMin) / yRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  },

  /**
   * 绘制数据点
   */
  drawDataPoints: function(ctx, displayData, canvasWidth, canvasHeight, padding, yMin, yRange, minTime, timeRange, color) {
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    ctx.setFillStyle(color);

    displayData.forEach((item, dataIndex) => {
      const x = padding.left + ((new Date(item.time).getTime() - minTime) / timeRange) * chartWidth;
      const y = padding.top + chartHeight - ((item.value - yMin) / yRange) * chartHeight;

      ctx.beginPath();
      
    
      if (dataIndex === displayData.length - 1) {
        // 最新数据点：红色大圆点（半径4px）
        ctx.setFillStyle('#ff0000');
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // 添加白色边框增强对比度
        ctx.setStrokeStyle('#ffffff');
        ctx.setLineWidth(1.5);
        ctx.stroke();
      } else {
        // 历史数据点：对应颜色小圆点（半径2.5px）
        ctx.setFillStyle(color);
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
        
        // 添加细边框增强对比度
        ctx.setStrokeStyle('#ffffff');
        ctx.setLineWidth(0.8);
        ctx.stroke();
      }
    });
  },

  /**
   * 切换图表显示状态
   */
  toggleCharts: function() {
    const newState = !this.data.showCharts;
    this.setData({
      showCharts: newState
    });

    // 保存图表显示状态到本地存储
    wx.setStorageSync('showCharts', newState);

    // 如果切换到显示状态，立即更新图表
    if (newState) {
      setTimeout(() => {
        this.updateAllCharts();
      }, 100);
    }
  },

  /**
   * 导出历史数据
   */
  exportHistoryData: function() {
    this.setData({ exportStatus: '正在导出...' });

    try {
      let csvContent = '数据类型,数值,时间\n';

      this.data.temp.history.forEach(item => {
        csvContent += `温度,${item.value}${this.data.temp.unit},${item.time}\n`;
      });

      this.data.humi.history.forEach(item => {
        csvContent += `湿度,${item.value}${this.data.humi.unit},${item.time}\n`;
      });

      this.data.adc.history.forEach(item => {
        csvContent += `ADC,${item.value}${this.data.adc.unit},${item.time}\n`;
      });

      this.data.volt.history.forEach(item => {
        csvContent += `电压,${item.value}${this.data.volt.unit},${item.time}\n`;
      });

      wx.setClipboardData({
        data: csvContent,
        success: () => {
          this.setData({ exportStatus: '导出成功' });
          wx.showToast({
            title: '数据已复制到剪贴板',
            icon: 'success',
            duration: 2000
          });
          setTimeout(() => {
            this.setData({ exportStatus: '' });
          }, 3000);
        },
        fail: () => {
          this.setData({ exportStatus: '导出失败，请重试' });
        }
      });
    } catch (error) {
      console.error('导出数据失败:', error);
      this.setData({ exportStatus: '导出失败，请重试' });
    }
  },

  /**
   * 清空历史数据
   */
  clearHistoryData: function() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有历史数据吗？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          const types = ['temp', 'humi', 'adc', 'volt'];
          const updateData = {};

          types.forEach(type => {
            updateData[type] = {
              ...this.data[type],
              history: [],
              max: null,
              min: null,
              avg: null
            };
          });

          this.setData(updateData);
          wx.showToast({
            title: '历史数据已清空',
            icon: 'success',
            duration: 2000
          });

          // 清空全局数据
          if (app.globalData.analysisData) {
            types.forEach(type => {
              if (app.globalData.analysisData[type]) {
                app.globalData.analysisData[type].history = [];
                app.globalData.analysisData[type].max = null;
                app.globalData.analysisData[type].min = null;
                app.globalData.analysisData[type].avg = null;
              }
            });
          }

          // 清空图表
          if (this.data.showCharts) {
            this.updateAllCharts();
          }
        }
      }
    });
  },

  /**
   * 返回蓝牙通信页面
   */
  goBack: function() {
    wx.navigateBack();
  }
});