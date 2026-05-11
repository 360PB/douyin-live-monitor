// =============================================================================
// 千川监控助手 - Sidebar Script v2.7.0
// 新增：曝光观看率、互动率 XPath 配置，使用说明链接
// =============================================================================

// DOM 缓存
const domCache = {};

function cacheDOM() {
  domCache.currentData = document.getElementById('currentData');
  domCache.currentExposureRate = document.getElementById('currentExposureRate');
  domCache.currentInteractionRate = document.getElementById('currentInteractionRate');
  domCache.periodicInterval = document.getElementById('periodicInterval');
  domCache.customIntervalGroup = document.getElementById('customIntervalGroup');
  domCache.resetXpath = document.getElementById('resetXpath');
  domCache.xpathToggle = document.getElementById('xpathToggle');
  domCache.xpathContent = document.getElementById('xpathContent');
  domCache.xpathArrow = document.getElementById('xpathArrow');
  domCache.liveStatusXpathToggle = document.getElementById('liveStatusXpathToggle');
  domCache.liveStatusXpathContent = document.getElementById('liveStatusXpathContent');
  domCache.liveStatusXpathArrow = document.getElementById('liveStatusXpathArrow');
  domCache.autoRefreshEnabled = document.getElementById('autoRefreshEnabled');
  domCache.autoRefreshIntervalGroup = document.getElementById('autoRefreshIntervalGroup');
  domCache.webhook = document.getElementById('webhook');
  domCache.closeSidebar = document.getElementById('closeSidebar');
  domCache.notificationToggle = document.getElementById('notificationToggle');
  domCache.notificationPanel = document.getElementById('notificationPanel');
  domCache.systemToggle = document.getElementById('systemToggle');
  domCache.systemPanel = document.getElementById('systemPanel');
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[千川监控] 侧边栏加载完成 v2.7.0');
  cacheDOM();
  
  await loadConfig();
  await loadCurrentData();
  setupXpathPanel();
  setupLiveStatusPanel();
  setupPanelToggles(); // 修复折叠功能
  setupButtonListeners();
  setupCloseButton();
  setupStorageListener();
  
  // 定期刷新数据
  setInterval(() => {
    loadCurrentData();
  }, 30000);
});

// 修复后的 setupPanelToggles 函数片段（替换原有函数）
function setupPanelToggles() {
  console.log('[侧边栏] 初始化面板切换');
  
  // 通知与预警配置面板
  domCache.notificationToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isCollapsed = domCache.notificationPanel.classList.contains('collapsed');
    console.log('[侧边栏] 通知面板点击，当前折叠状态:', isCollapsed);
    
    if (isCollapsed) {
      // 展开
      domCache.notificationPanel.classList.remove('collapsed');
      domCache.notificationToggle.classList.remove('collapsed');
      domCache.notificationToggle.querySelector('.panel-toggle-icon').textContent = '▼';
      console.log('[侧边栏] 通知面板展开');
    } else {
      // 折叠
      domCache.notificationPanel.classList.add('collapsed');
      domCache.notificationToggle.classList.add('collapsed');
      domCache.notificationToggle.querySelector('.panel-toggle-icon').textContent = '▶';
      console.log('[侧边栏] 通知面板折叠');
    }
  });
  
  // 系统与高级设置面板
  domCache.systemToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isCollapsed = domCache.systemPanel.classList.contains('collapsed');
    console.log('[侧边栏] 系统面板点击，当前折叠状态:', isCollapsed);
    
    if (isCollapsed) {
      // 展开
      domCache.systemPanel.classList.remove('collapsed');
      domCache.systemToggle.classList.remove('collapsed');
      domCache.systemToggle.querySelector('.panel-toggle-icon').textContent = '▼';
      console.log('[侧边栏] 系统面板展开');
    } else {
      // 折叠
      domCache.systemPanel.classList.add('collapsed');
      domCache.systemToggle.classList.add('collapsed');
      domCache.systemToggle.querySelector('.panel-toggle-icon').textContent = '▶';
      console.log('[侧边栏] 系统面板折叠');
    }
  });
}

// 关闭侧边栏按钮
function setupCloseButton() {
  domCache.closeSidebar.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'SIDEBAR_CLOSING' });
    } catch (e) {
      console.warn('[侧边栏] 关闭通知发送失败:', e.message);
    }
    window.close();
  });
}

// 设置 storage 监听器（响应双击悬浮按钮关闭）
function setupStorageListener() {
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.sidebarCloseRequest) {
        const newValue = changes.sidebarCloseRequest.newValue;
        const oldValue = changes.sidebarCloseRequest.oldValue;
        
        if (newValue && (Date.now() - newValue) < 3000 && newValue !== oldValue) {
          console.log('[侧边栏] 收到关闭请求，准备关闭');
          chrome.runtime.sendMessage({ type: 'SIDEBAR_CLOSING' }).catch(() => {});
          setTimeout(() => window.close(), 100);
        }
      }
    });
    
    window.addEventListener('beforeunload', () => {
      chrome.storage.local.set({ sidebarOpen: false }).catch(() => {});
      chrome.runtime.sendMessage({ type: 'SIDEBAR_CLOSING' }).catch(() => {});
    });
  } catch (e) {
    console.warn('[侧边栏] 设置 storage 监听失败:', e.message);
  }
}

// =============================================================================
// 按钮事件监听器绑定
// =============================================================================
function setupButtonListeners() {
  document.getElementById('save').addEventListener('click', onSaveConfig);
  document.getElementById('test').addEventListener('click', onTestPush);
  document.getElementById('resync').addEventListener('click', onResyncTime);
  document.getElementById('forcePush').addEventListener('click', onForcePush);
  
  // 数据卡片点击刷新
  domCache.currentData.addEventListener('click', async () => {
    if (domCache.currentData.classList.contains('loading')) return;
    
    domCache.currentData.classList.add('loading');
    try {
      await loadCurrentData();
    } finally {
      domCache.currentData.classList.remove('loading');
    }
  });
  
  // 推送间隔选择
  domCache.periodicInterval.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      domCache.customIntervalGroup.classList.add('show');
    } else {
      domCache.customIntervalGroup.classList.remove('show');
    }
  });
  
  // XPath重置按钮
  domCache.resetXpath.addEventListener('click', resetXpathToDefault);

  // 低在线预警立即推送模式切换
  const lowOnlineImmediateCheckbox = document.getElementById('lowOnlineUsersImmediate');
  const lowOnlineDurationGroup = document.getElementById('lowOnlineDurationGroup');
  if (lowOnlineImmediateCheckbox && lowOnlineDurationGroup) {
    lowOnlineImmediateCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        lowOnlineDurationGroup.classList.add('disabled');
        document.getElementById('lowOnlineUsersDuration').value = '0';
      } else {
        lowOnlineDurationGroup.classList.remove('disabled');
        document.getElementById('lowOnlineUsersDuration').value = '3';
      }
    });
  }
  
  // 自动刷新切换
  domCache.autoRefreshEnabled.addEventListener('change', (e) => {
    document.getElementById('autoRefreshIntervalGroup').style.display = e.target.checked ? 'block' : 'none';
  });
}

// 设置XPath折叠面板（内部折叠）
function setupXpathPanel() {
  domCache.xpathToggle.addEventListener('click', () => {
    domCache.xpathContent.classList.toggle('show');
    domCache.xpathArrow.classList.toggle('rotate');
  });
}

function setupLiveStatusPanel() {
  domCache.liveStatusXpathToggle.addEventListener('click', () => {
    domCache.liveStatusXpathContent.classList.toggle('show');
    domCache.liveStatusXpathArrow.classList.toggle('rotate');
  });
}

// =============================================================================
// 配置验证工具
// =============================================================================
const ConfigValidator = {
  validateWebhook(url) {
    if (!url) return { valid: false, error: 'Webhook URL 不能为空' };
    if (!url.includes('qyapi.weixin.qq.com')) {
      return { valid: false, error: 'Webhook URL 必须来自企业微信' };
    }
    return { valid: true };
  },
  
  validateInterval(value) {
    const num = parseInt(value);
    if (isNaN(num) || num < 1) return { valid: false, error: '间隔必须是正整数' };
    if (num > 1440) return { valid: false, error: '间隔不能超过1440分钟' };
    return { valid: true };
  }
};

// =============================================================================
// 加载配置
// =============================================================================
async function loadConfig() {
  const config = await chrome.storage.sync.get({
    webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xx',
    thresholdEnabled: true,
    threshold: 4,
    periodicEnabled: true,
    periodicInterval: 5,
    amountChangePushEnabled: true,
    onlineUsersThresholdEnabled: true,
    onlineUsersThreshold: 10,
    lowOnlineUsersEnabled: true,
    lowOnlineUsersImmediate: false,
    lowOnlineUsersThreshold: 2,
    lowOnlineUsersDuration: 3,
    roiThresholdEnabled: true,
    roiThreshold: 10.0,
    roiPushInterval: 30,
    roiThresholdEnabled: false,
    roiThreshold: 1.0,
    autoRefreshEnabled: true,
    autoRefreshInterval: 10,
    liveStatusEnabled: true,
    xpathLiveStatus: '',
    liveStatusLiveKeyword: '已开播',
    liveStatusStopKeyword: '共',
    xpathConsumption: '',
    xpathGPM: '',
    xpathOnlineUsers: '',
    xpathTotalAmount: '',
    xpathRefundAmount: '',
    xpathExposureViewRate: '',
    xpathInteractionRate: ''
  });
  
  // 填充表单
  domCache.webhook.value = config.webhookUrl;
  setElementChecked('thresholdEnabled', config.thresholdEnabled);
  setElementValue('threshold', config.threshold);
  setElementChecked('periodicEnabled', config.periodicEnabled);
  setElementChecked('amountChangePushEnabled', config.amountChangePushEnabled);
  setElementChecked('onlineUsersThresholdEnabled', config.onlineUsersThresholdEnabled);
  setElementValue('onlineUsersThreshold', config.onlineUsersThreshold);
  
  setElementChecked('lowOnlineUsersEnabled', config.lowOnlineUsersEnabled);
  setElementChecked('lowOnlineUsersImmediate', config.lowOnlineUsersImmediate);
  setElementValue('lowOnlineUsersThreshold', config.lowOnlineUsersThreshold);
  setElementValue('lowOnlineUsersDuration', config.lowOnlineUsersDuration);

  const lowOnlineDurationGroup = document.getElementById('lowOnlineDurationGroup');
  if (lowOnlineDurationGroup && (config.lowOnlineUsersImmediate || config.lowOnlineUsersDuration === 0)) {
    lowOnlineDurationGroup.classList.add('disabled');
  }
  
  setElementChecked('roiThresholdEnabled', config.roiThresholdEnabled);
  setElementValue('roiThreshold', config.roiThreshold);
  setElementValue('roiPushInterval', config.roiPushInterval || 30);
  
  setElementChecked('liveStatusEnabled', config.liveStatusEnabled);
  setElementValue('xpathLiveStatus', config.xpathLiveStatus);
  setElementValue('liveStatusLiveKeyword', config.liveStatusLiveKeyword);
  setElementValue('liveStatusStopKeyword', config.liveStatusStopKeyword);
  
  setElementValue('xpathConsumption', config.xpathConsumption);
  setElementValue('xpathGPM', config.xpathGPM);
  setElementValue('xpathOnlineUsers', config.xpathOnlineUsers);
  setElementValue('xpathTotalAmount', config.xpathTotalAmount);
  setElementValue('xpathRefundAmount', config.xpathRefundAmount);
  setElementValue('xpathExposureViewRate', config.xpathExposureViewRate);
  setElementValue('xpathInteractionRate', config.xpathInteractionRate);
  
  // 推送间隔
  if ([5, 10, 15, 20].includes(config.periodicInterval)) {
    domCache.periodicInterval.value = config.periodicInterval;
  } else {
    domCache.periodicInterval.value = 'custom';
    document.getElementById('customIntervalValue').value = config.periodicInterval;
    domCache.customIntervalGroup.classList.add('show');
  }
  
  setElementChecked('autoRefreshEnabled', config.autoRefreshEnabled);
  setElementValue('autoRefreshInterval', config.autoRefreshInterval);
  document.getElementById('autoRefreshIntervalGroup').style.display = config.autoRefreshEnabled ? 'block' : 'none';
}

// =============================================================================
// 加载当前数据
// =============================================================================
async function loadCurrentData() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://compass.jinritemai.com/*' });
    let targetTab = tabs.find(t => t.active) || tabs[0];
    
    if (!targetTab) {
      showCurrentData({
        consumption: '请打开抖音罗盘',
        roi: '--',
        online: '未连接',
        liveStatus: '未连接'
      }, 'warning');
      return;
    }
    
    let response;
    try {
      response = await chrome.tabs.sendMessage(targetTab.id, { type: 'GET_CONSUMPTION_NOW' });
    } catch (error) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = await chrome.tabs.sendMessage(targetTab.id, { type: 'GET_CONSUMPTION_NOW' });
      } catch (e) {
        throw new Error('无法连接罗盘页面');
      }
    }
    
    if (response && response.consumption !== null) {
      const netROI = response.consumption > 0 ? 
        ((response.totalAmount || 0) - (response.refundAmount || 0)) / response.consumption : 0;
      
      let liveStatusText = '未知';
      let liveStatusClass = 'unknown';
      if (response.isLive === true) {
        liveStatusText = '🔴 直播中';
        liveStatusClass = 'live';
      } else if (response.isLive === false) {
        liveStatusText = '⚫ 未开播';
        liveStatusClass = 'offline';
      } else {
        liveStatusText = '⚪ 检测中';
      }
      
      const exposureViewRateText = response.exposureViewRate !== null && !isNaN(response.exposureViewRate) 
        ? `${response.exposureViewRate.toFixed(2)}%` 
        : '--';
      const interactionRateText = response.interactionRate !== null && !isNaN(response.interactionRate) 
        ? `${response.interactionRate.toFixed(2)}%` 
        : '--';
      
      showCurrentData({
        consumption: `¥${response.consumption.toFixed(2)}`,
        roi: netROI.toFixed(2),
        online: `${response.onlineUsers || 0}人`,
        exposureViewRate: exposureViewRateText,
        interactionRate: interactionRateText,
        liveStatus: liveStatusText,
        liveStatusClass: liveStatusClass
      }, 'success');
    } else {
      showCurrentData({
        consumption: '等待数据...',
        roi: '--',
        online: '--',
        exposureViewRate: '--',
        interactionRate: '--',
        liveStatus: '初始化'
      }, 'warning');
    }
  } catch (error) {
    console.error('获取当前数据失败:', error);
    showCurrentData({
      consumption: '连接失败',
      roi: '--',
      online: '--',
      exposureViewRate: '--',
      interactionRate: '--',
      liveStatus: '错误'
    }, 'error');
  }
}

function showCurrentData(data, status) {
  domCache.currentData.style.display = 'block';
  document.getElementById('currentConsumption').textContent = data.consumption;
  document.getElementById('currentROI').textContent = data.roi;
  document.getElementById('currentOnline').textContent = data.online;
  
  if (domCache.currentExposureRate) {
    domCache.currentExposureRate.textContent = data.exposureViewRate || '--';
  }
  if (domCache.currentInteractionRate) {
    domCache.currentInteractionRate.textContent = data.interactionRate || '--';
  }
  
  const liveStatusEl = document.getElementById('currentLiveStatus');
  if (data.liveStatus) {
    liveStatusEl.innerHTML = `<span class="live-status-indicator ${data.liveStatusClass || 'unknown'}">${data.liveStatus}</span>`;
  } else {
    liveStatusEl.textContent = '--';
  }
}

// =============================================================================
// XPath重置
// =============================================================================
function resetXpathToDefault() {
  const defaults = {
    xpathConsumption: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[2]/div/div[1]/div/div[2]/text()',
    xpathGPM: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[3]/div/div[1]/div/div[2]/text()',
    xpathOnlineUsers: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[8]/div/div[1]/div/div[2]',
    xpathTotalAmount: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[2]/div[2]/div/div[1]/div/div[2]',
    xpathRefundAmount: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[12]/div/div[1]/div/div[2]',
    xpathExposureViewRate: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[9]/div/div[1]/div/div[2]',
    xpathInteractionRate: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[10]/div/div[1]/div/div[2]'
  };
  
  setElementValue('xpathConsumption', defaults.xpathConsumption);
  setElementValue('xpathGPM', defaults.xpathGPM);
  setElementValue('xpathOnlineUsers', defaults.xpathOnlineUsers);
  setElementValue('xpathTotalAmount', defaults.xpathTotalAmount);
  setElementValue('xpathRefundAmount', defaults.xpathRefundAmount);
  setElementValue('xpathExposureViewRate', defaults.xpathExposureViewRate);
  setElementValue('xpathInteractionRate', defaults.xpathInteractionRate);
  
  showStatus('✅ XPath已恢复为默认值，点击保存后生效', 'info');
}

// =============================================================================
// 保存配置
// =============================================================================
async function onSaveConfig() {
  try {
    const webhookUrl = getElementValue('webhook', '').trim();
    const thresholdEnabled = getElementChecked('thresholdEnabled', true);
    const threshold = parseFloat(getElementValue('threshold', '4'));
    const periodicEnabled = getElementChecked('periodicEnabled', true);
    const amountChangePushEnabled = getElementChecked('amountChangePushEnabled', true);
    const onlineUsersThresholdEnabled = getElementChecked('onlineUsersThresholdEnabled', true);
    const onlineUsersThreshold = parseInt(getElementValue('onlineUsersThreshold', '10'), 10);
    
    const liveStatusEnabled = getElementChecked('liveStatusEnabled', true);
    const xpathLiveStatus = getElementValue('xpathLiveStatus', '').trim();
    const liveStatusLiveKeyword = getElementValue('liveStatusLiveKeyword', '已开播').trim();
    const liveStatusStopKeyword = getElementValue('liveStatusStopKeyword', '共').trim();
    
    const xpathConfig = {
      xpathConsumption: getElementValue('xpathConsumption', '').trim(),
      xpathGPM: getElementValue('xpathGPM', '').trim(),
      xpathOnlineUsers: getElementValue('xpathOnlineUsers', '').trim(),
      xpathTotalAmount: getElementValue('xpathTotalAmount', '').trim(),
      xpathRefundAmount: getElementValue('xpathRefundAmount', '').trim(),
      xpathExposureViewRate: getElementValue('xpathExposureViewRate', '').trim(),
      xpathInteractionRate: getElementValue('xpathInteractionRate', '').trim(),
      xpathLiveStatus: xpathLiveStatus,
      liveStatusEnabled: liveStatusEnabled,
      liveStatusLiveKeyword: liveStatusLiveKeyword || '已开播',
      liveStatusStopKeyword: liveStatusStopKeyword || '共'
    };
    
    const intervalValue = getElementValue('periodicInterval', '5');
    let periodicInterval = intervalValue === 'custom' 
      ? parseInt(getElementValue('customIntervalValue', '5'), 10)
      : parseInt(intervalValue, 10);
    
    const autoRefreshEnabled = getElementChecked('autoRefreshEnabled', true);
    const autoRefreshInterval = parseInt(getElementValue('autoRefreshInterval', '10'), 10);
    
    const lowOnlineUsersEnabled = getElementChecked('lowOnlineUsersEnabled', true);
    const lowOnlineUsersImmediate = getElementChecked('lowOnlineUsersImmediate', false);
    const lowOnlineUsersThreshold = parseInt(getElementValue('lowOnlineUsersThreshold', '2'), 10);
    let lowOnlineUsersDuration = parseInt(getElementValue('lowOnlineUsersDuration', '3'), 10);

    if (lowOnlineUsersImmediate) {
      lowOnlineUsersDuration = 0;
    }
    
    const roiThresholdEnabled = getElementChecked('roiThresholdEnabled', true);
    const roiThreshold = parseFloat(getElementValue('roiThreshold', '10.0'));
    const roiPushInterval = parseInt(getElementValue('roiPushInterval', '30'), 10);
    
    // 验证
    const webhookValidation = ConfigValidator.validateWebhook(webhookUrl);
    if (!webhookValidation.valid) {
      showStatus(webhookValidation.error, 'error');
      return;
    }
    
    if (onlineUsersThreshold < 1 || onlineUsersThreshold > 10000) {
      showStatus('在线人数阈值必须在1-10000之间', 'error');
      return;
    }
    
    if (lowOnlineUsersThreshold < 1 || lowOnlineUsersThreshold > 100) {
      showStatus('低在线人数阈值必须在1-100之间', 'error');
      return;
    }
    
    if (lowOnlineUsersDuration < 0 || lowOnlineUsersDuration > 30) {
      showStatus('低在线预警时长必须在0-30分钟之间（0表示立即推送）', 'error');
      return;
    }
    
    if (roiThreshold < 0.1 || roiThreshold > 100) {
      showStatus('ROI预警阈值必须在0.1-100之间', 'error');
      return;
    }
    
    if (roiPushInterval < 5 || roiPushInterval > 180) {
      showStatus('ROI推送间隔必须在5-180分钟之间', 'error');
      return;
    }
    
    // 保存配置
    await chrome.storage.sync.set({
      webhookUrl: webhookUrl,
      thresholdEnabled: thresholdEnabled,
      threshold: threshold,
      periodicEnabled: periodicEnabled,
      periodicInterval: periodicInterval,
      amountChangePushEnabled: amountChangePushEnabled,
      onlineUsersThresholdEnabled: onlineUsersThresholdEnabled,
      onlineUsersThreshold: onlineUsersThreshold,
      lowOnlineUsersEnabled: lowOnlineUsersEnabled,
      lowOnlineUsersImmediate: lowOnlineUsersImmediate,
      lowOnlineUsersThreshold: lowOnlineUsersThreshold,
      lowOnlineUsersDuration: lowOnlineUsersDuration,
      roiThresholdEnabled: roiThresholdEnabled,
      roiThreshold: roiThreshold,
      roiPushInterval: roiPushInterval,
      autoRefreshEnabled: autoRefreshEnabled,
      autoRefreshInterval: autoRefreshInterval,
      ...xpathConfig
    });
    
    // 通知罗盘页面更新配置
    const tabs = await chrome.tabs.query({ url: 'https://compass.jinritemai.com/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          type: 'XPATH_CONFIG_UPDATED',
          data: xpathConfig
        });
      } catch (e) {}
    }
    
    // 更新推送间隔
    if (periodicEnabled) {
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_INTERVAL',
          interval: periodicInterval
        });
      } catch (e) {}
    }
    
    showStatus('✅ 配置保存成功！', 'success');
  } catch (error) {
    console.error('保存配置时出错:', error);
    showStatus('❌ 保存配置失败: ' + error.message, 'error');
  }
}

// =============================================================================
// 测试推送
// =============================================================================
async function onTestPush() {
  const webhookUrl = getElementValue('webhook', '').trim();
  
  if (!webhookUrl || !webhookUrl.includes('qyapi.weixin.qq.com')) {
    showStatus('请输入正确的Webhook地址', 'error');
    return;
  }
  
  showStatus('正在获取数据...', 'info');
  
  try {
    const tabs = await chrome.tabs.query({ url: 'https://compass.jinritemai.com/*' });
    if (tabs.length === 0) {
      showStatus('❌ 未找到罗盘页面，请先打开抖音罗盘', 'error');
      return;
    }
    
    const targetTab = tabs.find(t => t.active) || tabs[0];
    
    let response;
    try {
      response = await chrome.tabs.sendMessage(targetTab.id, { type: 'GET_CONSUMPTION_NOW' });
    } catch (error) {
      showStatus('❌ 无法获取数据，请刷新罗盘页面后重试', 'error');
      return;
    }
    
    if (!response || response.consumption === null) {
      showStatus('❌ 数据未就绪，请等待页面完全加载', 'error');
      return;
    }
    
    const netAmount = (response.totalAmount || 0) - (response.refundAmount || 0);
    const netROI = response.consumption > 0 ? netAmount / response.consumption : 0;
    
    const liveStatusText = response.isLive === true ? '直播中' : 
                          (response.isLive === false ? '未开播' : '未知');
    
    const exposureViewRateText = response.exposureViewRate !== null && !isNaN(response.exposureViewRate) 
      ? `${response.exposureViewRate.toFixed(2)}%` 
      : '--';
    const interactionRateText = response.interactionRate !== null && !isNaN(response.interactionRate) 
      ? `${response.interactionRate.toFixed(2)}%` 
      : '--';
    
    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `🔔 **千川监控测试报告**
**⏰ 时间:** ${new Date().toLocaleString('zh-CN')}
**💰 消耗:** ¥${(response.consumption || 0).toFixed(2)}
**💎 成交:** ¥${(response.totalAmount || 0).toFixed(2)}
**🎯 净ROI:** ${netROI.toFixed(2)}
**👥 在线:** ${response.onlineUsers || 0}人
**👁️ 曝光观看率:** ${exposureViewRateText}
**💬 互动率:** ${interactionRateText}
**📡 状态:** ${liveStatusText}
✅ 测试成功！`
      }
    };
    
    showStatus('正在发送...', 'info');
    
    const fetchResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (fetchResponse.ok) {
      showStatus('✅ 测试消息发送成功！请检查企业微信群', 'success');
    } else {
      showStatus(`❌ 发送失败: HTTP ${fetchResponse.status}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ 测试失败: ${error.message}`, 'error');
  }
}

// =============================================================================
// 时间同步
// =============================================================================
async function onResyncTime() {
  showStatus('正在重新对齐推送时间...', 'info');
  
  try {
    await chrome.runtime.sendMessage({ type: 'RESYNC_ALARM' });
    showStatus('✅ 时间重对齐已设置，下次推送将在整点01秒触发', 'success');
  } catch (error) {
    showStatus('❌ 重对齐失败', 'error');
  }
}

// =============================================================================
// 立即推送
// =============================================================================
async function onForcePush() {
  showStatus('正在触发立即推送...', 'info');
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'FORCE_PERIODIC_PUSH' });
    if (resp && resp.success) {
      showStatus('✅ 已触发立即推送', 'success');
    } else {
      showStatus(`❌ 推送失败: ${resp?.error || '未知错误'}`, 'error');
    }
  } catch (e) {
    showStatus('❌ 推送异常，请检查页面是否已加载', 'error');
  }
}

// =============================================================================
// 显示状态消息
// =============================================================================
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type} show`;
  status.style.whiteSpace = 'pre-line';
  
  setTimeout(() => {
    status.className = 'status';
  }, 5000);
}

// =============================================================================
// DOM辅助函数
// =============================================================================
function getElementValue(id, defaultValue = '') {
  const element = document.getElementById(id);
  return element && element.value ? element.value : defaultValue;
}

function getElementChecked(id, defaultValue = false) {
  const element = document.getElementById(id);
  return element && element.checked !== undefined ? element.checked : defaultValue;
}

function setElementValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function setElementChecked(id, checked) {
  const element = document.getElementById(id);
  if (element) element.checked = checked;
}