// =============================================================================
// 千川监控助手 - Background Service Worker v2.7.0
// 新增：曝光观看率、互动率数据抓取与推送，使用说明链接
// =============================================================================

async function saveState(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function getState(key, defaultValue = null) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? defaultValue;
}

function getNextAlignedTime(intervalMinutes, seconds = 1) {
  const now = new Date();
  const nextTime = new Date(now);
  
  const minutes = now.getMinutes();
  const remainder = minutes % intervalMinutes;
  const minutesToAdd = intervalMinutes - remainder;
  
  nextTime.setMinutes(minutes + minutesToAdd, seconds, 0);
  
  if (remainder === 0 && (now.getSeconds() > seconds)) {
    nextTime.setMinutes(nextTime.getMinutes() + intervalMinutes);
  }
  
  return nextTime;
}

// 添加：跟踪侧边栏状态
let sidebarOpenWindowId = null;

// 添加：广播消息给所有罗盘页面
async function broadcastToCompassTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://compass.jinritemai.com/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch(e) {
        // 忽略未注入脚本的页面错误
      }
    }
  } catch (e) {
    console.error('[广播] 失败:', e.message);
  }
}

// =============================================================================
// 插件安装/更新时初始化
// =============================================================================
chrome.runtime.onInstalled.addListener(async () => {
  try {
    console.log('[千川监控] 插件安装/更新 v2.7.0');
    
    // 设置侧边栏行为：点击图标打开侧边栏
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch(error => console.error('[侧边栏] 设置行为失败:', error));
    
    const config = await getConfig();
    const intervalMinutes = config.periodicInterval || 5;
    
    const now = new Date();
    const nextAlarmTime = getNextAlignedTime(intervalMinutes, 1);
    const delayInMinutes = (nextAlarmTime - now) / (1000 * 60);
    
    console.log(`[千川监控] 当前时间: ${now.toLocaleTimeString('zh-CN')}`);
    console.log(`[千川监控] 首次推送时间: ${nextAlarmTime.toLocaleTimeString('zh-CN')} (${delayInMinutes.toFixed(1)}分钟后)`);
    
    chrome.alarms.create('PERIODIC_PUSH', { 
      periodInMinutes: intervalMinutes,
      delayInMinutes: delayInMinutes
    });
    
    chrome.alarms.create('HEARTBEAT', { periodInMinutes: 1, delayInMinutes: 0.1 });
    chrome.alarms.create('THRESHOLD_CHECK', { periodInMinutes: 1, delayInMinutes: 0.2 });
    chrome.alarms.create('HEALTH_CHECK', { periodInMinutes: 2, delayInMinutes: 0.3 });
    
    // 初始化状态数据
    const stateInitMap = {
      'lastPushTime': Date.now(),
      'lastTotalAmount': 0,
      'lastAmountChangePushTime': Date.now(),
      'lastOnlineUsersPushTime': Date.now(),
      'lastLowOnlineUsersPushTime': 0,
      'lowOnlineUsersCheckStartTime': 0,
      'lastThresholdCheckTime': Date.now(),
      'lastROIPushTime': 0,
      'sidebarOpen': false,
      'dataHistory': []
    };
    
    for (const [key, defaultValue] of Object.entries(stateInitMap)) {
      if (!await getState(key)) {
        await saveState(key, defaultValue);
      }
    }
  
    // 向已打开的罗盘页面注入脚本
    const tabs = await chrome.tabs.query({ url: 'https://compass.jinritemai.com/*' });
    let successCount = 0;
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        successCount++;
      } catch (e) {
        console.warn(`[千川监控] 注入脚本失败: ${e.message}`);
      }
    }
  
    console.log(`[千川监控] ✅ 初始化完成，向${successCount}个页面注入脚本`);
    console.log(`[千川监控] ⏰ 推送间隔: ${intervalMinutes}分钟，已对齐到整点01秒`);
    console.log(`[千川监控] 👥 在线人数预警: ${config.onlineUsersThresholdEnabled ? '已启用' : '已禁用'}，阈值: ${config.onlineUsersThreshold}人`);
    console.log(`[千川监控] 📡 直播状态检测: ${config.liveStatusEnabled !== false ? '已启用' : '已禁用'}`);
  } catch (error) {
    console.error('[千川监控] ❌ 初始化失败:', error.message);
  }
});

// =============================================================================
// 监听新页面加载并注入脚本
// =============================================================================
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.url && details.url.includes('compass.jinritemai.com')) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['content.js']
      });
      console.log(`[千川监控] ✅ 新标签页已注入脚本: ${details.tabId}`);
    } catch (e) {
      console.warn(`[千川监控] 注入失败: ${e.message}`);
    }
  }
}, { url: [{ urlContains: 'compass.jinritemai.com' }] });

// =============================================================================
// 消息处理器映射（修复：添加 sender 参数）
// =============================================================================
const messageHandlers = new Map([
  ['COMPASS_DATA', async (message, sender, sendResponse) => {
    try {
      await handleCompassData(message.data);
    } catch (error) {
      console.error('[消息处理] COMPASS_DATA 错误:', error.message);
    }
  }],
  ['GET_CURRENT_CONSUMPTION', async (message, sender, sendResponse) => {
    try {
      const data = await getState('currentData');
      sendResponse(data);
    } catch (error) {
      console.error('[消息处理] GET_CURRENT_CONSUMPTION 错误:', error.message);
      sendResponse(null);
    }
  }],
  ['GET_CONFIG', async (message, sender, sendResponse) => {
    try {
      const config = await getConfig();
      sendResponse(config);
    } catch (error) {
      console.error('[消息处理] GET_CONFIG 错误:', error.message);
      sendResponse(null);
    }
  }],
  ['AUTO_REFRESH_NOTIFICATION', async (message, sender, sendResponse) => {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: '页面即将自动刷新',
        message: message.data.message,
        priority: 1
      });
    } catch (error) {
      console.error('[消息处理] AUTO_REFRESH_NOTIFICATION 错误:', error.message);
    }
  }],
  ['UPDATE_INTERVAL', async (message, sender, sendResponse) => {
    try {
      chrome.alarms.clear('PERIODIC_PUSH');
      const intervalMinutes = message.interval;
      const now = new Date();
      const nextAlarmTime = getNextAlignedTime(intervalMinutes, 1);
      const delayInMinutes = (nextAlarmTime - now) / (1000 * 60);
      
      chrome.alarms.create('PERIODIC_PUSH', { 
        periodInMinutes: intervalMinutes,
        delayInMinutes: delayInMinutes
      });
      
      console.log(`[千川监控] ⏰ 推送间隔已更新为 ${intervalMinutes}分钟`);
      sendResponse({ success: true });
    } catch (error) {
      console.error('[消息处理] UPDATE_INTERVAL 错误:', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }],
  ['RESYNC_ALARM', async (message, sender, sendResponse) => {
    try {
      chrome.alarms.clear('PERIODIC_PUSH');
      const config = await getConfig();
      const intervalMinutes = config.periodicInterval || 5;
      const now = new Date();
      const nextAlarmTime = getNextAlignedTime(intervalMinutes, 1);
      const delayInMinutes = (nextAlarmTime - now) / (1000 * 60);
      
      chrome.alarms.create('PERIODIC_PUSH', { 
        periodInMinutes: intervalMinutes,
        delayInMinutes: delayInMinutes
      });
      
      console.log(`[千川监控] ⏰ 推送时间已重对齐到: ${nextAlarmTime.toLocaleTimeString('zh-CN')}`);
      sendResponse({ success: true });
    } catch (error) {
      console.error('[消息处理] RESYNC_ALARM 错误:', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }],
  ['FORCE_PERIODIC_PUSH', async (message, sender, sendResponse) => {
    try {
      console.log('[千川监控] 🚀 收到立即推送请求，触发定期推送...');
      await performPeriodicPush();
      sendResponse({ success: true, message: '已触发立即推送' });
    } catch (error) {
      console.error('[消息处理] FORCE_PERIODIC_PUSH 错误:', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }],
  ['GET_DATA_HISTORY', async (message, sender, sendResponse) => {
    try {
      const hours = message.hours || 24;
      const history = await getDataHistory(hours);
      sendResponse({ success: true, data: history });
    } catch (error) {
      console.error('[消息处理] GET_DATA_HISTORY 错误:', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }],
  ['REBUILD_ALARMS', async (message, sender, sendResponse) => {
    try {
      console.log('[千川监控] 🔧 收到重建定时任务请求...');
      chrome.alarms.clearAll();
      
      const config = await getConfig();
      const intervalMinutes = config.periodicInterval || 5;
      
      const now = new Date();
      const nextAlarmTime = getNextAlignedTime(intervalMinutes, 1);
      const delayInMinutes = (nextAlarmTime - now) / (1000 * 60);
      
      chrome.alarms.create('PERIODIC_PUSH', { 
        periodInMinutes: intervalMinutes,
        delayInMinutes: delayInMinutes
      });
      
      chrome.alarms.create('HEARTBEAT', { periodInMinutes: 1, delayInMinutes: 0.1 });
      chrome.alarms.create('THRESHOLD_CHECK', { periodInMinutes: 1, delayInMinutes: 0.2 });
      chrome.alarms.create('HEALTH_CHECK', { periodInMinutes: 2, delayInMinutes: 0.3 });
      
      console.log(`[千川监控] ✅ 定时任务已重建，推送间隔: ${intervalMinutes}分钟，下次推送: ${nextAlarmTime.toLocaleTimeString('zh-CN')}`);
      sendResponse({ success: true, message: '定时任务已重建' });
    } catch (error) {
      console.error('[消息处理] REBUILD_ALARMS 错误:', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }],
  
  // 修复：打开侧边栏 - 添加状态跟踪和广播
  ['OPEN_SIDEBAR', async (message, sender, sendResponse) => {
    try {
      if (sender.tab && sender.tab.windowId) {
        await chrome.sidePanel.open({ windowId: sender.tab.windowId });
        sidebarOpenWindowId = sender.tab.windowId;
        
        // 保存状态到 storage，并广播给所有页面
        await chrome.storage.local.set({ sidebarOpen: true, sidebarWindowId: sender.tab.windowId });
        await broadcastToCompassTabs({ type: 'SIDEBAR_STATE_CHANGED', isOpen: true });
        
        console.log('[侧边栏] 已在窗口', sender.tab.windowId, '打开');
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: '无法获取窗口ID' });
      }
    } catch (error) {
      console.error('[侧边栏] 打开失败:', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }],
  
  // 修复：关闭侧边栏 - 使用 storage 信号机制
  ['CLOSE_SIDEBAR', async (message, sender, sendResponse) => {
    try {
      // 通过 storage 触发侧边栏自我关闭（因为无法直接从外部关闭 side panel）
      await chrome.storage.local.set({ 
        sidebarCloseRequest: Date.now(),
        sidebarOpen: false 
      });
      
      sidebarOpenWindowId = null;
      await broadcastToCompassTabs({ type: 'SIDEBAR_STATE_CHANGED', isOpen: false });
      
      console.log('[侧边栏] 已发送关闭请求');
      sendResponse({ success: true, note: '侧边栏将在接下来关闭' });
    } catch (error) {
      console.error('[侧边栏] 关闭失败:', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }],
  
  // 修复：侧边栏心跳检测
  ['PING_SIDEBAR', async (message, sender, sendResponse) => {
    sendResponse({ alive: true, timestamp: Date.now() });
  }],
  
  // 修复：侧边栏即将关闭通知
  ['SIDEBAR_CLOSING', async (message, sender, sendResponse) => {
    console.log('[千川监控] 侧边栏即将关闭');
    sidebarOpenWindowId = null;
    
    // 更新 storage 并广播
    await chrome.storage.local.set({ sidebarOpen: false });
    await broadcastToCompassTabs({ type: 'SIDEBAR_STATE_CHANGED', isOpen: false });
    
    sendResponse({ received: true });
  }]
]);

// 监听来自 content script 的数据
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers.get(message.type);
  if (handler) {
    try {
      const result = handler(message, sender, sendResponse);
      if (result instanceof Promise) {
        result.catch(err => {
          console.error(`[消息处理] ${message.type} 异常:`, err.message);
          sendResponse({ success: false, error: err.message });
        });
      }
    } catch (error) {
      console.error(`[消息处理] ${message.type} 异常:`, error.message);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  console.warn(`[消息处理] 未知消息类型: ${message.type}`);
});

// =============================================================================
// 处理罗盘数据
// =============================================================================
async function handleCompassData(data) {
  try {
    if (!data) {
      console.warn('[处理数据] 接收的数据为空');
      return;
    }
    
    await saveState('currentData', data);
    await saveState('lastCheckTime', data.timestamp);
    
    // 保存当前页面URL
    if (data.pageUrl) {
      await saveState('currentPageUrl', data.pageUrl);
      console.log(`[千川监控] 📍 页面URL: ${data.pageUrl}`);
    }
    
    // 保存直播状态
    if (data.isLive !== undefined) {
      await saveState('isLive', data.isLive);
      await saveState('liveStatus', data.liveStatus);
      
      if (data.isLive === true) {
        console.log(`[千川监控] 📡 直播状态: 直播中 (${data.liveStatus})`);
      } else if (data.isLive === false) {
        console.log(`[千川监控] 📡 直播状态: 未开播/已结束 (${data.liveStatus})`);
      } else {
        console.log(`[千川监控] 📡 直播状态: 未知 (${data.liveStatus || '未获取'})`);
      }
    }
    
    const lastPeriodicData = await getState('lastPeriodicData');
    if (!lastPeriodicData || lastPeriodicData.consumption === null) {
      await saveState('lastPeriodicData', data);
      console.log('[千川监控] 📝 初始化基准数据和推送时间');
    }
    
    const lastThresholdCheckData = await getState('lastThresholdCheckData');
    if (!lastThresholdCheckData) {
      await saveState('lastThresholdCheckData', data);
      await saveState('lastThresholdCheckTime', Date.now());
      console.log('[千川监控] 📝 初始化阈值检查基准');
    }
    
    console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 📥 收到数据: 消耗¥${data.consumption}, ROI=${data.netROI?.toFixed(2)}, 成交¥${data.totalAmount || 0}, 在线${data.onlineUsers || 0}人, 直播状态:${data.isLive === true ? '直播中' : (data.isLive === false ? '未开播' : '未知')}`);
    
    // 记录历史数据（保留最近100条）
    await recordDataHistory(data);
    
    await Promise.all([
      checkAmountChange(data),
      checkOnlineUsersThreshold(data),
      checkLowOnlineUsers(data),
      checkROIThreshold(data),
    ]);
  } catch (error) {
    console.error('[处理数据] 异常:', error.message);
  }
}

// =============================================================================
// 数据历史记录
// =============================================================================
const MAX_HISTORY_ITEMS = 100;

async function recordDataHistory(data) {
  try {
    if (!data || data.consumption === null) return;
    
    const history = await getState('dataHistory', []);
    const record = {
      timestamp: Date.now(),
      consumption: data.consumption,
      totalAmount: data.totalAmount || 0,
      netROI: data.netROI || 0,
      onlineUsers: data.onlineUsers || 0,
      exposureViewRate: data.exposureViewRate || 0,
      interactionRate: data.interactionRate || 0,
      isLive: data.isLive
    };
    
    history.push(record);
    
    // 只保留最近100条
    if (history.length > MAX_HISTORY_ITEMS) {
      history.shift();
    }
    
    await saveState('dataHistory', history);
  } catch (e) {
    console.warn('[历史记录] 保存失败:', e.message);
  }
}

async function getDataHistory(hours = 24) {
  try {
    const history = await getState('dataHistory', []);
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return history.filter(item => item.timestamp >= cutoffTime);
  } catch (e) {
    console.warn('[历史记录] 获取失败:', e.message);
    return [];
  }
}

// =============================================================================
// 成交金额变动检测
// =============================================================================
const MAX_VALID_AMOUNT_BG = 100000000;

function isValidAmountBg(value) {
  if (value === null || value === undefined) return false;
  if (isNaN(value)) return false;
  if (value < 0) return false;
  if (value > MAX_VALID_AMOUNT_BG) return false;
  if (value.toString().includes('e')) return false;
  return true;
}

async function checkAmountChange(currentData) {
  const config = await getConfig();
  if (!config.amountChangePushEnabled) return;
  
  if (config.liveStatusEnabled !== false && currentData.isLive === false) {
    console.log(`[成交变动] ⏸️ 直播未进行，跳过成交变动检测`);
    return;
  }
  
  if (!isValidAmountBg(currentData.totalAmount)) {
    console.warn(`[成交变动] ⚠️ 成交金额数据异常，跳过:`, currentData.totalAmount);
    return;
  }
  
  const lastTotalAmount = await getState('lastTotalAmount', 0);
  const lastAmountChangePushTime = await getState('lastAmountChangePushTime', 0);
  
  if (!currentData.totalAmount || currentData.totalAmount === lastTotalAmount) return;
  
  const timeSinceLastPush = (Date.now() - lastAmountChangePushTime) / 1000;
  if (timeSinceLastPush < 5) {
    console.log(`[成交变动] ⏭️ 距离上次推送仅${timeSinceLastPush.toFixed(0)}秒，跳过`);
    return;
  }
  
  const amountDiff = currentData.totalAmount - lastTotalAmount;
  console.log(`[成交变动] ✅ 检测到成交金额变化: ¥${lastTotalAmount} → ¥${currentData.totalAmount} (变动: ¥${amountDiff.toFixed(2)})`);
  
  const success = await sendAmountChangeNotification({
    oldAmount: lastTotalAmount,
    newAmount: currentData.totalAmount,
    diffAmount: amountDiff,
    timestamp: new Date().toLocaleString('zh-CN')
  }, config.webhookUrl);
  
  if (success) {
    await saveState('lastTotalAmount', currentData.totalAmount);
    await saveState('lastAmountChangePushTime', Date.now());
    console.log('[成交变动] ✅ 推送完成，更新基准金额');
  }
}

// =============================================================================
// 在线人数阈值预警
// =============================================================================
async function checkOnlineUsersThreshold(currentData) {
  const config = await getConfig();
  if (!config.onlineUsersThresholdEnabled) return;
  
  if (config.liveStatusEnabled !== false && currentData.isLive === false) {
    console.log(`[在线人数] ⏸️ 直播未进行，跳过在线人数预警`);
    return;
  }
  
  const lastOnlineUsersPushTime = await getState('lastOnlineUsersPushTime', 0);
  const timeSinceLastPush = (Date.now() - lastOnlineUsersPushTime) / 1000;
  
  if (timeSinceLastPush < 10) {
    console.log(`[在线人数] ⏭️ 距离上次推送仅${timeSinceLastPush.toFixed(0)}秒，跳过`);
    return;
  }
  
  const onlineUsers = currentData.onlineUsers || 0;
  const threshold = config.onlineUsersThreshold || 10;
  
  if (onlineUsers > threshold) {
    console.log(`[在线人数] ✅ 检测到在线人数超过阈值: ${onlineUsers}人 > ${threshold}人`);
    
    const success = await sendOnlineUsersThresholdNotification({
      onlineUsers: onlineUsers,
      threshold: threshold,
      timestamp: new Date().toLocaleString('zh-CN')
    }, config.webhookUrl);
    
    if (success) {
      await saveState('lastOnlineUsersPushTime', Date.now());
      console.log('[在线人数] ✅ 预警推送完成');
    }
  }
}

// =============================================================================
// 低在线人数预警
// =============================================================================
async function checkLowOnlineUsers(currentData) {
  const config = await getConfig();
  if (!config.lowOnlineUsersEnabled) return;
  
  if (config.liveStatusEnabled !== false && currentData.isLive === false) {
    await saveState('lowOnlineUsersCheckStartTime', 0);
    return;
  }
  
  const onlineUsers = currentData.onlineUsers || 0;
  const threshold = config.lowOnlineUsersThreshold || 2;
  const immediateMode = config.lowOnlineUsersImmediate === true || config.lowOnlineUsersDuration === 0;
  
  const lastLowOnlineUsersPushTime = await getState('lastLowOnlineUsersPushTime', 0);
  const timeSinceLastPush = (Date.now() - lastLowOnlineUsersPushTime) / 1000;
  
  if (timeSinceLastPush < 60) {
    return;
  }
  
  if (onlineUsers <= threshold) {
    const checkStartTime = await getState('lowOnlineUsersCheckStartTime', 0);
    const now = Date.now();
    
    if (checkStartTime === 0) {
      await saveState('lowOnlineUsersCheckStartTime', now);
      
      if (immediateMode) {
        const success = await sendLowOnlineUsersNotification({
          onlineUsers: onlineUsers,
          threshold: threshold,
          duration: 0,
          timestamp: new Date().toLocaleString('zh-CN'),
          immediate: true
        }, config.webhookUrl);
        
        if (success) {
          await saveState('lastLowOnlineUsersPushTime', Date.now());
        }
      }
      return;
    }
    
    const elapsedTime = (now - checkStartTime) / 1000 / 60;
    const durationMinutes = config.lowOnlineUsersDuration || 3;
    
    if (elapsedTime >= durationMinutes) {
      const success = await sendLowOnlineUsersNotification({
        onlineUsers: onlineUsers,
        threshold: threshold,
        duration: Math.floor(elapsedTime),
        timestamp: new Date().toLocaleString('zh-CN')
      }, config.webhookUrl);
      
      if (success) {
        await saveState('lastLowOnlineUsersPushTime', Date.now());
        await saveState('lowOnlineUsersCheckStartTime', 0);
      }
    }
  } else {
    await saveState('lowOnlineUsersCheckStartTime', 0);
  }
}

// =============================================================================
// ROI 异常预警
// =============================================================================
async function checkROIThreshold(currentData) {
  try {
    const config = await getConfig();
    if (!config.roiThresholdEnabled) return;
    
    if (config.liveStatusEnabled !== false && currentData.isLive === false) {
      return;
    }
    
    // 只在有消耗且有ROI数据时检测
    if (!currentData.consumption || currentData.consumption < 10) return;
    if (currentData.netROI === null || currentData.netROI === undefined) return;
    
    const roiThreshold = config.roiThreshold || 10.0;
    const roiPushInterval = (config.roiPushInterval || 30) * 60; // 转换为秒
    const netROI = currentData.netROI;
    
    const lastROIPushTime = await getState('lastROIPushTime', 0);
    const timeSinceLastPush = (Date.now() - lastROIPushTime) / 1000;
    
    // 根据配置的间隔推送
    if (timeSinceLastPush < roiPushInterval) return;
    
    if (netROI < roiThreshold) {
      console.warn(`[ROI预警] 检测到ROI低于阈值: ${netROI.toFixed(2)} < ${roiThreshold}`);
      
      const success = await sendROIThresholdNotification({
        roi: netROI,
        threshold: roiThreshold,
        consumption: currentData.consumption,
        totalAmount: currentData.totalAmount || 0,
        timestamp: new Date().toLocaleString('zh-CN')
      }, config.webhookUrl, config.roiPushInterval || 30);
      
      if (success) {
        await saveState('lastROIPushTime', Date.now());
        console.log('[ROI预警] ✅ 推送完成');
      }
    }
  } catch (error) {
    console.error('[ROI预警] 异常:', error.message);
  }
}

async function sendROIThresholdNotification(data, webhookUrl, pushInterval) {
  const intervalText = pushInterval || 30;
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `⚠️ **ROI 异常预警**
      
**当前ROI**: ${data.roi.toFixed(2)}
**预警阈值**: ${data.threshold}
**当前消耗**: ¥${data.consumption.toFixed(2)}
**成交金额**: ¥${(data.totalAmount || 0).toFixed(2)}
**触发时间**: ${data.timestamp}

🔴 **ROI低于预警阈值，请关注投放效果！**
⏰ ${intervalText}分钟内不会重复推送`
    }
  };
  
  return await sendToWechat(message, webhookUrl);
}

// =============================================================================
// 监听 alarms
// =============================================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    const now = new Date();
    
    try {
      if (alarm.name === 'PERIODIC_PUSH') {
        console.log(`\n[⏰ ALARM触发] 时间: ${now.toLocaleTimeString('zh-CN')}, 名称: PERIODIC_PUSH`);
        await performPeriodicPush();
        
      } else if (alarm.name === 'HEARTBEAT') {
        const currentData = await getState('currentData');
        console.log(`[${now.toLocaleTimeString('zh-CN')}] 💓 心跳正常 | 消耗: ¥${currentData?.consumption || 0}`);
        
      } else if (alarm.name === 'THRESHOLD_CHECK') {
        await checkThreshold();
        
      } else if (alarm.name === 'HEALTH_CHECK') {
        await performHealthCheck();
      }
    } catch (taskError) {
      console.error(`[ALARM执行] ${alarm.name} 任务异常:`, taskError.message);
    }
  } catch (error) {
    console.error(`[ALARM处理] 外层异常:`, error.message);
  }
});

// =============================================================================
// 执行定期推送
// =============================================================================
async function performPeriodicPush() {
  try {
    const config = await getConfig();
    if (!config.webhookUrl || !config.periodicEnabled) {
      console.log('[推送检查] ⏭️ 配置不完整或未启用定期推送');
      return;
    }
    
    const currentData = await getState('currentData');
    if (!validateData(currentData)) {
      console.log('[推送检查] ❌ 当前数据无效，跳过推送');
      return;
    }
    
    if (config.liveStatusEnabled !== false && currentData.isLive === false) {
      console.log('[推送检查] ⏸️ 直播未进行，跳过定期推送');
      return;
    }
    
    const lastPeriodicData = await getState('lastPeriodicData');
    if (!lastPeriodicData || lastPeriodicData.consumption === null) {
      console.log('[推送检查] 📝 首次记录基准数据');
      await saveState('lastPeriodicData', currentData);
      await saveState('lastPushTime', Date.now());
      return;
    }
    
    console.log('[推送检查] ✅ 条件满足，准备推送...');
    
    const report = calculateReport(currentData, lastPeriodicData);
    
    console.log(`[推送执行] 💬 发送报告: 消耗变化¥${report.diffConsumption.toFixed(2)}, 净成交变化¥${report.diffNetAmount.toFixed(2)}`);
    
    const success = await sendEnhancedReport(report, config.webhookUrl);
    
    if (success) {
      await saveState('lastPeriodicData', currentData);
      await saveState('lastPushTime', Date.now());
      console.log('[推送执行] ✅ 推送完成，更新基准数据和推送时间\n');
    } else {
      console.error('[推送执行] ❌ 推送失败，保持原基准数据\n');
    }
  } catch (error) {
    console.error('[定期推送] 异常:', error.message);
  }
}

// =============================================================================
// 消耗阈值预警检查
// =============================================================================
async function checkThreshold() {
  try {
    const config = await getConfig();
    if (!config.webhookUrl || !config.thresholdEnabled) {
      console.log('[阈值检查] ⏭️ 消耗阈值预警未启用');
      return;
    }
    
    const currentData = await getState('currentData');
    const lastThresholdCheckTime = await getState('lastThresholdCheckTime', 0);
    const lastThresholdCheckData = await getState('lastThresholdCheckData');
    
    if (!currentData || !lastThresholdCheckData) {
      console.log('[阈值检查] 📝 初始化阈值检查基准');
      await saveState('lastThresholdCheckData', currentData);
      await saveState('lastThresholdCheckTime', Date.now());
      return;
    }
    
    if (config.liveStatusEnabled !== false && currentData.isLive === false) {
      console.log('[阈值检查] ⏸️ 直播未进行，跳过阈值检查');
      return;
    }
    
    const timeDiff = (Date.now() - lastThresholdCheckTime) / 60000;
    if (timeDiff < 1) {
      console.log(`[阈值检查] ⏭️ 距离上次检查仅${timeDiff.toFixed(1)}分钟，跳过`);
      return;
    }
    
    const consumptionDiff = currentData.consumption - lastThresholdCheckData.consumption;
    const consumptionPerMinute = consumptionDiff / timeDiff;
    
    console.log(`[⚠️ 阈值检查] 速度: ¥${consumptionPerMinute.toFixed(2)}/分钟 | 阈值: ¥${config.threshold}/分钟 | 时间差: ${timeDiff.toFixed(1)}分钟`);
    
    if (consumptionPerMinute > config.threshold) {
      console.warn(`[⚠️ 阈值预警] 触发预警！速度: ¥${consumptionPerMinute.toFixed(2)}/分钟`);
      
      const currentNetAmount = (currentData.totalAmount || 0) - (currentData.refundAmount || 0);
      const currentNetROI = currentData.consumption > 0 ? currentNetAmount / currentData.consumption : 0;
      
      const lastNetAmount = (lastThresholdCheckData.totalAmount || 0) - (lastThresholdCheckData.refundAmount || 0);
      const lastNetROI = lastThresholdCheckData.consumption > 0 ? lastNetAmount / lastThresholdCheckData.consumption : 0;
      const roiChange = currentNetROI - lastNetROI;
      
      await sendWechatNotification({
        consumption: currentData.consumption,
        consumptionPerMinute: consumptionPerMinute,
        threshold: config.threshold,
        timeSinceLastCheck: timeDiff,
        timestamp: new Date().toLocaleString('zh-CN'),
        totalAmount: currentData.totalAmount || 0,
        refundAmount: currentData.refundAmount || 0,
        roiChange: roiChange
      }, config.webhookUrl);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: '千川消耗预警',
        message: `每分钟消耗 ¥${consumptionPerMinute.toFixed(2)}，超过阈值 ¥${config.threshold}`,
        priority: 2
      });
    } else {
      console.log(`[阈值检查] ✅ 正常，未超过阈值`);
    }
    
    await saveState('lastThresholdCheckData', currentData);
    await saveState('lastThresholdCheckTime', Date.now());
    console.log('[阈值检查] 📝 更新阈值检查基准数据');
  } catch (error) {
    console.error('[阈值检查] 异常:', error.message);
  }
}

// =============================================================================
// 健康检查
// =============================================================================
async function performHealthCheck() {
  try {
    const config = await getConfig();
    const currentData = await getState('currentData');
    const lastCheckTime = await getState('lastCheckTime', 0);
    const lastPushTime = await getState('lastPushTime', 0);
    
    const timeSinceLastData = (Date.now() - lastCheckTime) / 1000;
    const timeSinceLastPush = (Date.now() - lastPushTime) / 1000;
    
    if (currentData && validateData(currentData)) {
      console.log(`[健康检查] ✅ 系统正常 | 最后更新: ${timeSinceLastData.toFixed(0)}秒前 | 上次推送: ${timeSinceLastPush.toFixed(0)}秒前`);
      
      // 检测推送是否卡住（超过30分钟未推送且直播进行中）
      if (timeSinceLastPush > 1800 && currentData.isLive === true && config.periodicEnabled) {
        console.warn('[健康检查] ⚠️ 直播进行中但超过30分钟未推送，尝试恢复推送...');
        await performPeriodicPush();
      }
    } else if (timeSinceLastData > 600) {
      console.warn('[健康检查] ⚠️ 超过10分钟未收到数据，请检查罗盘页面是否打开');
    } else {
      console.log('[健康检查] ℹ️ 等待数据更新...');
    }
  } catch (error) {
    console.error('[健康检查] 异常:', error.message);
  }
}

function validateData(data) {
  if (!data) {
    console.warn('[数据验证] 数据为空');
    return false;
  }
  
  if (data.consumption === null || data.consumption === undefined || isNaN(data.consumption)) {
    console.warn('[数据验证] 消耗字段无效');
    return false;
  }
  
  if (data.consumption < 0 || data.consumption > 10000000) {
    console.warn('[数据验证] 消耗数值异常:', data.consumption);
    return false;
  }
  
  const consumptionStr = data.consumption.toString();
  if (consumptionStr.includes('e') || consumptionStr.includes('E')) {
    console.warn('[数据验证] 消耗数值为科学计数法，视为异常:', data.consumption);
    return false;
  }
  
  if (data.totalAmount !== null && data.totalAmount !== undefined) {
    const totalAmountStr = data.totalAmount.toString();
    if (totalAmountStr.includes('e') || totalAmountStr.includes('E') || data.totalAmount > 100000000) {
      console.warn('[数据验证] 成交金额异常:', data.totalAmount);
      return false;
    }
  }
  
  return true;
}

// =============================================================================
// 计算报告
// =============================================================================
function calculateReport(currentData, lastData) {
  const diffConsumption = currentData.consumption - lastData.consumption;
  const netAmount = (currentData.totalAmount || 0) - (currentData.refundAmount || 0);
  const lastNetAmount = (lastData.totalAmount || 0) - (lastData.refundAmount || 0);
  const diffNetAmount = netAmount - lastNetAmount;
  
  return {
    currentData: currentData,
    lastData: lastData,
    diffConsumption: diffConsumption,
    diffNetAmount: diffNetAmount,
    timestamp: new Date().toLocaleString('zh-CN')
  };
}

// =============================================================================
// 推送函数
// =============================================================================
async function sendEnhancedReport(report, webhookUrl) {
  const { currentData, lastData, diffConsumption, diffNetAmount, timestamp } = report;
  const config = await getConfig();
  
  const formatValue = (value, prefix = '¥') => {
    if (value === null || value === undefined || isNaN(value)) {
      return `${prefix}0.00`;
    }
    const valueStr = value.toString();
    if (valueStr.includes('e') || valueStr.includes('E') || Math.abs(value) > 100000000) {
      console.warn('[定期推送] ⚠️ 金额格式化时检测到异常值:', value);
      return `${prefix}0.00`;
    }
    return `${prefix}${value.toFixed(2)}`;
  };
  
  const formatNumber = (num) => {
    return num !== null && num !== undefined ? num : 0;
  };
  
  const netAmount = (currentData.totalAmount || 0) - (currentData.refundAmount || 0);
  const netROI = currentData.consumption > 0 ? netAmount / currentData.consumption : 0;
  
  const lastNetAmount = (lastData.totalAmount || 0) - (lastData.refundAmount || 0);
  const lastNetROI = lastData.consumption > 0 ? lastNetAmount / lastData.consumption : 0;
  const roiChange = netROI - lastNetROI;
  
  const interval = config.periodicInterval || 5;
  const currentPageUrl = await getState('currentPageUrl', 'https://compass.jinritemai.com/');

  const message = {
    msgtype: 'template_card',
    template_card: {
      card_type: 'text_notice',
      main_title: {
        title: `${timestamp}`,
        desc: `千次支付: ¥${currentData.gpm !== null && !isNaN(currentData.gpm) ? currentData.gpm.toFixed(2) : '0.00'}`
      },
      sub_title_text: `👁️ 曝光观看率: ${currentData.exposureViewRate !== null && !isNaN(currentData.exposureViewRate) ? currentData.exposureViewRate.toFixed(2) : '0.00'}% |互动率: ${currentData.interactionRate !== null && !isNaN(currentData.interactionRate) ? currentData.interactionRate.toFixed(2) : '0.00'}%`,
      horizontal_content_list: [
        {
          keyname: '💰 当前消耗',
          value: formatValue(currentData.consumption)
        },
        {
          keyname: `📊 ${interval}分钟消耗`,
          value: `${formatValue(diffConsumption)} (${formatValue(diffConsumption / interval)}/分)`
        },
        {
          keyname: '💎 成交金额',
          value: `${formatValue(currentData.totalAmount)} (净${formatValue(netAmount)})`
        },
        {
          keyname: '📈 净ROI',
          value: `${netROI.toFixed(2)} (${roiChange >= 0 ? '+' : ''}${roiChange.toFixed(2)})`
        },
        {
          keyname: '👥 在线人数',
          value: `${formatNumber(currentData.onlineUsers)}人`
        }
      ],
      jump_list: [
        {
          type: 1,
          title: '🚀 查看当前直播间',
          url: currentPageUrl
        }
      ],
      card_action: {
        type: 1,
        url: currentPageUrl
      }
    }
  };
  
  return await sendToWechat(message, webhookUrl);
}

async function sendAmountChangeNotification(data, webhookUrl) {
  const formatValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '¥0.00';
    }
    const valueStr = value.toString();
    if (valueStr.includes('e') || valueStr.includes('E') || Math.abs(value) > 100000000) {
      return '¥0.00';
    }
    return `¥${value.toFixed(2)}`;
  };
  
  const direction = data.diffAmount > 0 ? '📈' : '📉';
  const changeType = data.diffAmount > 0 ? '增加' : '减少';
  
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `💰 **成交金额变动通知** ${direction}
      
**⏰ 时间:** ${data.timestamp}

**💎 成交金额变动**
• 变动前: ${formatValue(data.oldAmount)}
• 变动后: ${formatValue(data.newAmount)}
• 变动金额: ${direction} ${formatValue(Math.abs(data.diffAmount))}
• 变动类型: ${changeType}

---
🔔 实时监控 | 成交动态提醒`
    }
  };
  
  return await sendToWechat(message, webhookUrl);
}

async function sendOnlineUsersThresholdNotification(data, webhookUrl) {
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `👥 **在线人数预警**
      
**实时在线人数**: ${data.onlineUsers}人
**预警阈值**: ${data.threshold}人
**触发时间**: ${data.timestamp}

🔥 **直播间人气火爆，请立即关注互动和转化！**`
    }
  };
  
  return await sendToWechat(message, webhookUrl);
}

async function sendLowOnlineUsersNotification(data, webhookUrl) {
  const isImmediate = data.immediate === true;
  const title = isImmediate ? '🚨 低在线人数预警（立即）' : '📉 低在线人数预警';
  const warningText = isImmediate 
    ? `⚠️ **警告：在线人数立即低于阈值！**`
    : `⚠️ **警告：在线人数低于阈值，已持续 ${data.duration} 分钟！**`;
  const durationText = isImmediate ? '立即检测' : `${data.duration}分钟`;
  
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `${title}
      
**实时在线人数**: ${data.onlineUsers}人
**预警阈值**: ${data.threshold}人
**持续时长**: ${durationText}
**触发时间**: ${data.timestamp}

${warningText}
请立即检查直播内容质量、互动效果或推广情况，及时提高人气！`
    }
  };
  
  return await sendToWechat(message, webhookUrl);
}

async function sendWechatNotification(data, webhookUrl) {
  const currentNetAmount = (data.totalAmount || 0) - (data.refundAmount || 0);
  const currentNetROI = data.consumption > 0 ? currentNetAmount / data.consumption : 0;
  
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `⚠️ **千川消耗预警**
      
💰 **当前消耗**: ¥${data.consumption.toFixed(2)}
⚡ **消耗速度**: ¥${data.consumptionPerMinute.toFixed(2)}/分钟
🎯 **预警阈值**: ¥${data.threshold}/分钟
⏱️ **统计时长**: ${data.timeSinceLastCheck.toFixed(1)}分钟
⏰ **触发时间**: ${data.timestamp}
📈 **净ROI**: ${currentNetROI.toFixed(2)}${data.roiChange !== undefined ? ` (${data.roiChange > 0 ? '+' : ''}${data.roiChange.toFixed(2)})` : ''}

⚠️ **消耗速度异常，请立即前往直播间检查投放情况！**`
    }
  };
  
  return await sendToWechat(message, webhookUrl);
}

async function sendToWechat(message, webhookUrl, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
      
      if (response.ok) {
        const msgType = message.msgtype;
        let action = '[未知]';
        
        if (msgType === 'markdown') {
          const content = message.markdown.content;
          if (content.includes('成交金额变动')) action = '[成交变动]';
          else if (content.includes('千川数据')) action = '[定期推送-卡片]';
          else if (content.includes('在线人数')) action = '[在线人数预警]';
          else if (content.includes('消耗预警')) action = '[阈值预警]';
          else if (content.includes('ROI')) action = '[ROI预警]';
          else action = '[Markdown消息]';
        } else if (msgType === 'text') {
          action = '[文本消息]';
        } else if (msgType === 'template_card') {
          action = '[卡片消息]';
        }
        
        console.log(`[千川监控] ✅ ${action}消息发送成功 (尝试 ${attempt}/${maxRetries})`);
        return true;
      }
      
      lastError = `HTTP ${response.status}`;
      console.warn(`[千川监控] ⚠️ 发送失败: ${lastError} (尝试 ${attempt}/${maxRetries})`);
      
    } catch (error) {
      lastError = error.message;
      console.warn(`[千川监控] ⚠️ 发送异常: ${lastError} (尝试 ${attempt}/${maxRetries})`);
    }
    
    if (attempt < maxRetries) {
      await sleep(1000 * attempt);
    }
  }
  
  console.error('[千川监控] ❌ 所有重试均失败:', lastError);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: '推送失败',
    message: '企业微信消息发送失败: ' + lastError
  });
  
  return false;
}

// =============================================================================
// 配置管理
// =============================================================================
async function getConfig() {
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
    xpathInteractionRate: '',
    roiThresholdEnabled: true,
    roiThreshold: 10.0,
    roiPushInterval: 30
  });
  return config;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}