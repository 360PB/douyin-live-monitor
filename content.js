// =============================================================================
// 千川监控助手 - Content Script v3.10.0
// 新增：曝光观看率、互动率数据抓取
// =============================================================================

// =============================================================================
// 日志管理工具
// =============================================================================
const Logger = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 1,
  
  debug(...args) {
    if (this.level <= this.DEBUG) console.log('[DEBUG]', ...args);
  },
  info(...args) {
    if (this.level <= this.INFO) console.log('[INFO]', ...args);
  },
  warn(...args) {
    if (this.level <= this.WARN) console.warn('[WARN]', ...args);
  },
  error(...args) {
    if (this.level <= this.ERROR) console.error('[ERROR]', ...args);
  }
};

// =============================================================================
// 扩展上下文保护
// =============================================================================
let isExtensionValid = true;
let lastExtensionCheckTime = 0;
const EXTENSION_CHECK_INTERVAL = 30000;

function checkExtensionValid() {
  const now = Date.now();
  if (now - lastExtensionCheckTime < EXTENSION_CHECK_INTERVAL && isExtensionValid) {
    return true;
  }
  
  try {
    if (!chrome.runtime.id) {
      isExtensionValid = false;
      return false;
    }
    lastExtensionCheckTime = now;
    return true;
  } catch (e) {
    isExtensionValid = false;
    Logger.warn('[扩展检查] 扩展上下文丢失:', e.message);
    return false;
  }
}

// =============================================================================
// 自动刷新配置
// =============================================================================
let autoRefreshTimer = null;
let pageLoadTime = Date.now();
let refreshScheduled = false;

async function initAutoRefresh() {
  try {
    const config = await chrome.storage.sync.get({
      autoRefreshEnabled: false,
      autoRefreshInterval: 10
    });
    
    if (config.autoRefreshEnabled) {
      startAutoRefresh(config.autoRefreshInterval);
    } else {
      stopAutoRefresh();
    }
  } catch (e) {
    console.warn('[自动刷新] 初始化失败:', e.message);
  }
}

function startAutoRefresh(intervalMinutes) {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  
  refreshScheduled = false;
  const intervalMs = intervalMinutes * 60 * 1000;
  
  autoRefreshTimer = setInterval(async () => {
    try {
      if (refreshScheduled) {
        Logger.debug('[自动刷新] 已调度刷新任务,跳过');
        return;
      }
      
      const now = new Date();
      const isVisible = !document.hidden;
      const runtimeMinutes = (Date.now() - pageLoadTime) / 60000;
      
      Logger.debug(`[自动刷新] 检查: 时间=${now.toLocaleTimeString('zh-CN')}, 页面可见=${isVisible}, 运行时长=${runtimeMinutes.toFixed(1)}分钟`);
      
      if (!isVisible && runtimeMinutes > 10) {
        console.log('[自动刷新] ✅ 触发刷新!');
        refreshScheduled = true;
        
        try {
          if (checkExtensionValid()) {
            await chrome.runtime.sendMessage({
              type: 'AUTO_REFRESH_NOTIFICATION',
              data: { message: `页面将在30秒后自动刷新,以保持数据最新` }
            });
          }
        } catch (e) {
          Logger.warn('[自动刷新] 发送通知失败:', e.message);
        }
        
        setTimeout(() => {
          console.log('[自动刷新] 🔄 执行刷新!');
          location.reload();
        }, 30000);
      } else if (isVisible) {
        Logger.debug('[自动刷新] ⏭️ 页面可见,跳过刷新');
      } else if (runtimeMinutes <= 10) {
        Logger.debug('[自动刷新] ⏭️ 运行时间太短,跳过刷新');
      }
    } catch (error) {
      Logger.error('[自动刷新] 异常:', error.message);
    }
  }, intervalMs);
  
  console.log(`[自动刷新] 已启动,每${intervalMinutes}分钟检查一次`);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
    refreshScheduled = false;
    console.log('[自动刷新] 已停止');
  }
}

// 监听配置变化
try {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.autoRefreshEnabled || changes.autoRefreshInterval)) {
      console.log('[自动刷新] 配置已更改,重新初始化');
      stopAutoRefresh();
      initAutoRefresh();
    }
  });
} catch (e) {
  Logger.warn('[自动刷新] 监听配置失败:', e.message);
}

document.addEventListener('visibilitychange', () => {
  Logger.debug(`[页面可见性] 变为: ${document.hidden ? '隐藏' : '可见'}`);
  if (!document.hidden && refreshScheduled) {
    console.log('[自动刷新] 页面变为可见,取消刷新');
    refreshScheduled = false;
  }
});

window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
  Logger.debug('[页面卸载] 资源已清理');
});

// =============================================================================
// XPath 配置
// =============================================================================
const DEFAULT_XPATH = {
  consumption: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[2]/div/div[1]/div/div[2]/text()',
  gpm: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[3]/div/div[1]/div/div[2]/text()',
  onlineUsers: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[8]/div/div[1]/div/div[2]',
  totalAmount: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[2]/div[1]/div[1]/div[2]',
  refundAmount: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[12]/div/div[1]/div/div[2]',
  liveStatus: '//*[@id="scaleContainer"]/div[1]/div/span[3]/span[2]/span[2]/span[2]/text()[3]',
  exposureViewRate: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[9]/div/div[1]/div/div[2]',
  interactionRate: '//*[@id="fullpage"]/div/div[1]/div/div/div[1]/div[1]/div/div[4]/div/div[10]/div/div[1]/div/div[2]'
};

let currentXpath = { ...DEFAULT_XPATH };
let liveStatusConfig = {
  enabled: true,
  liveKeyword: '已开播',
  stopKeyword: '共'
};

async function loadXpathConfig() {
  try {
    const config = await chrome.storage.sync.get({
      xpathConsumption: '',
      xpathGPM: '',
      xpathOnlineUsers: '',
      xpathTotalAmount: '',
      xpathRefundAmount: '',
      xpathLiveStatus: '',
      xpathExposureViewRate: '',
      xpathInteractionRate: '',
      liveStatusEnabled: true,
      liveStatusLiveKeyword: '已开播',
      liveStatusStopKeyword: '共'
    });
    
    currentXpath.consumption = config.xpathConsumption || DEFAULT_XPATH.consumption;
    currentXpath.gpm = config.xpathGPM || DEFAULT_XPATH.gpm;
    currentXpath.onlineUsers = config.xpathOnlineUsers || DEFAULT_XPATH.onlineUsers;
    currentXpath.totalAmount = config.xpathTotalAmount || DEFAULT_XPATH.totalAmount;
    currentXpath.refundAmount = config.xpathRefundAmount || DEFAULT_XPATH.refundAmount;
    currentXpath.liveStatus = config.xpathLiveStatus || DEFAULT_XPATH.liveStatus;
    currentXpath.exposureViewRate = config.xpathExposureViewRate || DEFAULT_XPATH.exposureViewRate;
    currentXpath.interactionRate = config.xpathInteractionRate || DEFAULT_XPATH.interactionRate;
    
    liveStatusConfig.enabled = config.liveStatusEnabled !== false;
    liveStatusConfig.liveKeyword = config.liveStatusLiveKeyword || '已开播';
    liveStatusConfig.stopKeyword = config.liveStatusStopKeyword || '共';
    
    console.log('[千川监控] XPath配置已加载:', currentXpath);
    console.log('[千川监控] 直播状态检测配置:', liveStatusConfig);
  } catch (error) {
    console.warn('[千川监控] 加载XPath配置失败，使用默认值:', error.message);
    currentXpath = { ...DEFAULT_XPATH };
  }
}

// =============================================================================
// 直播状态检测
// =============================================================================
function getLiveStatus() {
  try {
    const result = document.evaluate(
      currentXpath.liveStatus,
      document,
      null,
      XPathResult.STRING_TYPE,
      null
    );
    const statusText = result.stringValue.trim();
    
    console.log('[千川监控] 检测到直播状态文本:', statusText);
    
    if (statusText.includes(liveStatusConfig.liveKeyword)) {
      return { isLive: true, text: statusText };
    } else if (statusText.includes(liveStatusConfig.stopKeyword)) {
      return { isLive: false, text: statusText };
    } else {
      console.log('[千川监控] 未识别的直播状态:', statusText);
      return { isLive: null, text: statusText };
    }
  } catch (e) {
    console.warn('[千川监控] 获取直播状态失败:', e.message);
    return { isLive: null, text: '', error: e.message };
  }
}

// =============================================================================
// 核心数据抓取
// =============================================================================
function getCompassData() {
  try {
    console.log('[千川监控] 开始抓取完整数据 v3.10.0...');
    console.log('[千川监控] 使用XPath配置:', currentXpath);
    
    const data = {
      consumption: null,
      gpm: null,
      totalAmount: null,
      refundAmount: null,
      onlineUsers: null,
      netAmount: 0,
      netROI: 0,
      pageUrl: window.location.href,
      liveStatus: null,
      isLive: null,
      exposureViewRate: null,
      interactionRate: null
    };
    
    // 获取直播状态
    const liveResult = getLiveStatus();
    data.liveStatus = liveResult.text;
    data.isLive = liveResult.isLive;
    
    if (liveResult.error) {
      console.warn('[千川监控] ⚠️ 直播状态检测错误:', liveResult.error);
    }
    
    if (liveResult.isLive === true) {
      console.log('[千川监控] ✅ 直播进行中，将继续推送数据');
    } else if (liveResult.isLive === false) {
      console.log('[千川监控] ⏸️ 直播未开始或已结束，将停止推送数据');
    } else {
      console.log('[千川监控] ⚠️ 无法确定直播状态，默认允许推送');
    }
    
    console.log('[千川监控] 当前页面URL:', data.pageUrl);
    
    // XPath 抓取
    data.gpm = getValueByXPath(currentXpath.gpm, 'number');
    data.consumption = getValueByXPath(currentXpath.consumption, 'number');
    data.onlineUsers = getValueByXPath(currentXpath.onlineUsers, 'integer');
    data.totalAmount = getValueByXPath(currentXpath.totalAmount, 'number');
    data.refundAmount = getValueByXPath(currentXpath.refundAmount, 'number');
    data.exposureViewRate = getValueByXPath(currentXpath.exposureViewRate, 'number');
    data.interactionRate = getValueByXPath(currentXpath.interactionRate, 'number');
    
    console.log('[千川监控] XPath抓取结果:', {
      consumption: data.consumption,
      totalAmount: data.totalAmount,
      onlineUsers: data.onlineUsers,
      refundAmount: data.refundAmount,
      gpm: data.gpm,
      exposureViewRate: data.exposureViewRate,
      interactionRate: data.interactionRate
    });
    
    // 备用标签匹配
    if (!data.consumption || !data.totalAmount || !data.onlineUsers) {
      console.log('[千川监控] === 开始标签匹配（备用方案） ===');
      const fieldMatches = findFieldsByLabel();
      
      if (data.totalAmount === null && fieldMatches.totalAmount !== null) {
        data.totalAmount = fieldMatches.totalAmount;
        console.log('[千川监控] ✅ 成交金额 (标签): ¥' + data.totalAmount);
      }
      
      if (data.refundAmount === null && fieldMatches.refundAmount !== null) {
        data.refundAmount = fieldMatches.refundAmount;
        console.log('[千川监控] ✅ 退款金额 (标签): ¥' + data.refundAmount);
      }
      
      if (data.consumption === null && fieldMatches.consumption !== null) {
        data.consumption = fieldMatches.consumption;
        console.log('[千川监控] ✅ 投放消耗 (标签): ¥' + data.consumption);
      }
      
      if (data.gpm === null && fieldMatches.gpm !== null) {
        data.gpm = fieldMatches.gpm;
        console.log('[千川监控] ✅ GPM (标签): ¥' + data.gpm);
      }
      
      if (data.onlineUsers === null && fieldMatches.onlineUsers !== null) {
        data.onlineUsers = fieldMatches.onlineUsers;
        console.log('[千川监控] ✅ 在线人数 (标签): ' + data.onlineUsers);
      }
      
      if (data.exposureViewRate === null && fieldMatches.exposureViewRate !== null) {
        data.exposureViewRate = fieldMatches.exposureViewRate;
        console.log('[千川监控] ✅ 曝光观看率 (标签): ' + data.exposureViewRate);
      }
      
      if (data.interactionRate === null && fieldMatches.interactionRate !== null) {
        data.interactionRate = fieldMatches.interactionRate;
        console.log('[千川监控] ✅ 互动率 (标签): ' + data.interactionRate);
      }
    }
    
    // 数据验证和修正
    if (data.refundAmount === null) {
      data.refundAmount = 0;
      console.log('[千川监控] ℹ️ 退款金额未找到,设为0');
    }
    
    // 验证金额数据是否异常（过滤科学计数法等异常值）
    if (data.consumption !== null && !isValidAmount(data.consumption)) {
      console.warn('[千川监控] ⚠️ 投放消耗数据异常:', data.consumption, '重置为null');
      data.consumption = null;
    }
    
    if (data.totalAmount !== null && !isValidAmount(data.totalAmount)) {
      console.warn('[千川监控] ⚠️ 成交金额数据异常:', data.totalAmount, '重置为null');
      data.totalAmount = null;
    }
    
    if (data.refundAmount !== null && !isValidAmount(data.refundAmount)) {
      console.warn('[千川监控] ⚠️ 退款金额数据异常:', data.refundAmount, '重置为0');
      data.refundAmount = 0;
    }
    
    if (data.gpm !== null && !isValidAmount(data.gpm)) {
      console.warn('[千川监控] ⚠️ GPM数据异常:', data.gpm, '重置为null');
      data.gpm = null;
    }
    
    if (data.consumption !== null && data.consumption < 0) {
      console.warn('[千川监控] ⚠️ 投放消耗为负数,取绝对值:', data.consumption);
      data.consumption = Math.abs(data.consumption);
    }
    
    if (data.totalAmount !== null && data.totalAmount < 0) {
      console.warn('[千川监控] ⚠️ 成交金额为负数,取绝对值:', data.totalAmount);
      data.totalAmount = Math.abs(data.totalAmount);
    }
    
    if (data.refundAmount < 0) {
      console.warn('[千川监控] ⚠️ 退款金额为负数,取绝对值:', data.refundAmount);
      data.refundAmount = Math.abs(data.refundAmount);
    }
    
    if (data.totalAmount !== null && data.refundAmount > data.totalAmount) {
      console.warn('[千川监控] ⚠️ 退款金额异常(大于成交金额),重置为0');
      data.refundAmount = 0;
    }
    
    // 计算净ROI
    if (data.consumption !== null && data.consumption > 0) {
      data.netAmount = (data.totalAmount || 0) - data.refundAmount;
      data.netROI = data.netAmount / data.consumption;
      console.log('[千川监控] ✅ 净ROI计算:', data.netROI.toFixed(2));
    } else {
      console.warn('[千川监控] ⚠️ 消耗无效,无法计算ROI:', data.consumption);
    }
    
    console.log('[千川监控] === 最终数据 ===', {
      消耗: data.consumption,
      GPM: data.gpm,
      成交: data.totalAmount,
      退款: data.refundAmount,
      净额: data.netAmount,
      ROI: data.netROI,
      在线人数: data.onlineUsers,
      曝光观看率: data.exposureViewRate,
      互动率: data.interactionRate,
      直播状态: data.liveStatus,
      是否直播中: data.isLive,
      页面URL: data.pageUrl
    });
    
    return data;
    
  } catch (error) {
    console.error('[千川监控] 抓取异常:', error);
    return null;
  }
}

// =============================================================================
// 智能标签匹配（备用方案）
// =============================================================================
function findFieldsByLabel() {
  const result = {
    totalAmount: null,
    refundAmount: null,
    consumption: null,
    gpm: null,
    onlineUsers: null,
    exposureViewRate: null,
    interactionRate: null
  };
  
  try {
    // 通过特定类名查找成交金额（针对Odometer组件）
    const hugeNumberContainers = document.querySelectorAll('[class*=\"hugeNumberContainer\"]');
    console.log('[千川监控] 扫描 hugeNumberContainer 元素数量:', hugeNumberContainers.length);
    
    hugeNumberContainers.forEach((container, index) => {
      // 检查是否包含 ¥ 符号，通常是金额
      if (container.textContent.includes('¥')) {
        const value = parseOdometerValue(container);
        if (value !== null) {
          // 通常第一个 hugeNumberContainer 是成交金额
          if (result.totalAmount === null && index === 0) {
            result.totalAmount = value;
            console.log('[千川监控] ✅ 通过类名找到成交金额:', value);
          }
        }
      }
    });
  } catch (e) {
    console.warn('[千川监控] 类名查找失败:', e.message);
  }
  
  return result;
}

// =============================================================================
// Odometer 数字解析（关键修复）
// =============================================================================

// 常量定义
const MAX_VALID_AMOUNT = 100000000; // 最大有效金额 1亿
const MAX_ODOMETER_DIGITS = 15; // Odometer 最大位数限制

function isValidAmount(value) {
  // 验证金额是否有效
  if (value === null || value === undefined) return false;
  if (isNaN(value)) return false;
  if (value < 0) return false;
  if (value > MAX_VALID_AMOUNT) return false;
  // 检查是否为科学计数法（异常大数）
  if (value.toString().includes('e')) return false;
  return true;
}

function parseOdometerValue(element) {
  if (!element) return null;
  
  try {
    // 方法1: 查找所有 .odometer-value 元素（当前显示的数字）
    const valueElements = element.querySelectorAll('.odometer-value');
    
    if (valueElements.length > 0 && valueElements.length <= MAX_ODOMETER_DIGITS) {
      let numberStr = '';
      valueElements.forEach(el => {
        const digit = el.textContent.trim();
        if (digit && /^[0-9]$/.test(digit)) {
          numberStr += digit;
        }
      });
      
      if (numberStr !== '' && numberStr.length <= MAX_ODOMETER_DIGITS) {
        const value = parseFloat(numberStr);
        if (isValidAmount(value)) {
          console.log('[千川监控] ✅ Odometer解析成功:', value);
          return value;
        } else {
          console.warn('[千川监控] ⚠️ Odometer解析值异常:', value);
        }
      }
    } else if (valueElements.length > MAX_ODOMETER_DIGITS) {
      console.warn('[千川监控] ⚠️ Odometer元素数量过多:', valueElements.length, '跳过方法1');
    }
    
    // 方法2: 查找 .odometer-formatted-value（完整格式化后的值）
    const formattedEl = element.querySelector('.odometer-formatted-value');
    if (formattedEl) {
      const text = formattedEl.textContent.trim().replace(/[¥,]/g, '');
      const value = parseFloat(text);
      if (isValidAmount(value)) {
        console.log('[千川监控] ✅ Odometer格式化值解析:', value);
        return value;
      } else {
        console.warn('[千川监控] ⚠️ Odometer格式化值异常:', text, '→', value);
      }
    }
    
    // 方法3: 从整个元素的文本中提取数字
    const text = element.textContent.trim();
    // 匹配 ¥3,634 或 ¥3634 格式
    const match = text.match(/¥\s*([\d,]+)/);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (isValidAmount(value)) {
        console.log('[千川监控] ✅ 文本提取金额:', value);
        return value;
      } else {
        console.warn('[千川监控] ⚠️ 文本提取金额异常:', match[1], '→', value);
      }
    }
    
  } catch (e) {
    console.warn('[千川监控] Odometer解析失败:', e.message);
  }
  
  return null;
}

// =============================================================================
// 通用值解析（优化版）
// =============================================================================
function parseValueFromElement(target, type) {
  if (!target) return null;
  
  let element = target;
  
  // 如果是文本节点，先尝试直接解析文本
  if (target.nodeType === Node.TEXT_NODE) {
    const text = target.textContent.trim();
    if (type === 'number') {
      const numMatch = text.match(/([\d,]+\.?\d*)/);
      if (numMatch) {
        const value = parseFloat(numMatch[1].replace(/,/g, ''));
        if (isValidAmount(value)) {
          return value;
        }
      }
    }
    // 如果文本节点解析失败，使用其父元素
    element = target.parentElement;
    if (!element) return null;
  }
  
  // 如果是元素节点
  if (element.nodeType === Node.ELEMENT_NODE) {
    // 检查是否包含 odometer 相关类名或子元素
    const isOdometer = element.querySelector('.odometer-value') || 
                       element.querySelector('.odometer') ||
                       element.classList.contains('odometer') ||
                       element.closest('.odometer');
    
    if (isOdometer) {
      return parseOdometerValue(element);
    }
    
    // 普通文本解析
    const text = element.textContent.trim();
    
    if (type === 'number') {
      const match = text.match(/^[¥￥]?\s*([\d,]+\.?\d*)$/);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (isValidAmount(value)) {
          return value;
        }
      }
      // 宽松匹配：只要包含数字就提取
      const looseMatch = text.match(/([\d,]+\.?\d*)/);
      if (looseMatch) {
        const value = parseFloat(looseMatch[1].replace(/,/g, ''));
        if (isValidAmount(value)) {
          return value;
        }
      }
    } else if (type === 'integer') {
      const match = text.match(/^(\d+)$/);
      if (match) {
        const value = parseInt(match[1], 10);
        if (!isNaN(value) && value >= 0 && value <= 1000000) {
          return value;
        }
      }
      // 宽松匹配整数
      const looseIntMatch = text.match(/(\d+)/);
      if (looseIntMatch) {
        const value = parseInt(looseIntMatch[1], 10);
        if (!isNaN(value) && value >= 0 && value <= 1000000) {
          return value;
        }
      }
    }
  }
  
  return null;
}

function getValueByXPath(xpath, type) {
  try {
    if (!xpath || xpath.trim() === '') {
      console.warn('[千川监控] XPath 为空');
      return null;
    }
    
    const result = document.evaluate(
      xpath, 
      document, 
      null, 
      XPathResult.FIRST_ORDERED_NODE_TYPE, 
      null
    );
    
    const node = result.singleNodeValue;
    
    if (!node) {
      console.warn(`[千川监控] XPath未找到元素: ${xpath}`);
      return null;
    }
    
    const value = parseValueFromElement(node, type);
    
    if (value !== null) {
      return value;
    }
    
  } catch (e) {
    console.warn(`[千川监控] XPath执行失败 [${xpath}]:`, e.message);
  }
  
  return null;
}

// =============================================================================
// 发送数据
// =============================================================================
function sendCompassData() {
  // 检查扩展是否有效
  if (!checkExtensionValid()) {
    console.warn('[千川监控] ⚠️ 扩展上下文已失效，跳过发送');
    showExtensionWarning();
    return;
  }
  
  const data = getCompassData();
  
  if (!data) {
    console.error('[千川监控] ❌ 抓取失败,数据为空');
    return;
  }
  
  // 检查直播状态 - 总是发送数据给后台，由 background 决定是否推送
  if (liveStatusConfig.enabled) {
    if (data.isLive === false) {
      console.log('[千川监控] ⏸️ 直播未开始或已结束，但仍发送数据供后台记录');
      // 不返回，继续发送数据，由 background 决定是否推送
    } else if (data.isLive === null) {
      console.log('[千川监控] ⚠️ 无法确定直播状态，继续推送数据');
    } else {
      console.log('[千川监控] ✅ 直播进行中，正常推送数据');
    }
  }
  
  if (data.consumption === null || isNaN(data.consumption) || data.consumption < 0) {
    console.error('[千川监控] ❌ 消耗数据无效,不发送:', data.consumption);
    return;
  }
  
  console.log('[千川监控] ✉️ 发送数据到background:', {
    consumption: data.consumption,
    netROI: data.netROI?.toFixed(2),
    onlineUsers: data.onlineUsers,
    exposureViewRate: data.exposureViewRate,
    interactionRate: data.interactionRate,
    pageUrl: data.pageUrl,
    isLive: data.isLive,
    timestamp: new Date().toLocaleTimeString('zh-CN')
  });
  
  try {
    chrome.runtime.sendMessage({
      type: 'COMPASS_DATA',
      data: {
        ...data,
        timestamp: Date.now()
      }
    }, (response) => {
      // 检查发送回调错误
      if (chrome.runtime.lastError) {
        console.warn('[千川监控] ⚠️ 发送消息失败:', chrome.runtime.lastError.message);
        if (chrome.runtime.lastError.message.includes('context invalidated')) {
          isExtensionValid = false;
          showExtensionWarning();
        }
      }
    });
  } catch (error) {
    console.error('[千川监控] ❌ 发送消息异常:', error.message);
    if (error.message.includes('Extension context invalidated')) {
      isExtensionValid = false;
      showExtensionWarning();
    }
  }
}

// 显示扩展失效警告（不依赖 chrome API）
function showExtensionWarning() {
  if (document.getElementById('qianchuan-ext-warning')) return;
  
  const warning = document.createElement('div');
  warning.id = 'qianchuan-ext-warning';
  warning.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #dc3545;
    color: white;
    padding: 12px;
    text-align: center;
    font-size: 14px;
    z-index: 99999;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  warning.innerHTML = `
    <strong>⚠️ 千川监控助手需要刷新</strong>
    <span style="margin: 0 10px;">|</span>
    扩展已更新或重新加载，请刷新页面以继续使用
    <button onclick=\"location.reload()\" style="
      margin-left: 10px;
      padding: 4px 12px;
      background: white;
      color: #dc3545;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    ">立即刷新</button>
  `;
  
  if (document.body) {
    document.body.appendChild(warning);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(warning);
    });
  }
}

// =============================================================================
// 定时发送
// =============================================================================
let sendCompassDataInterval = setInterval(() => {
  if (isExtensionValid) {
    sendCompassData();
  }
}, 30000);

// =============================================================================
// 页面加载完成后初始化
// =============================================================================
window.addEventListener('load', async () => {
  console.log('[千川监控] 页面加载完成 v3.9.5');
  
  try {
    await loadXpathConfig();
    initAutoRefresh();
    
    // 多次尝试发送数据
    sendCompassData();
    setTimeout(() => isExtensionValid && sendCompassData(), 3000);
    setTimeout(() => isExtensionValid && sendCompassData(), 6000);
    setTimeout(() => isExtensionValid && sendCompassData(), 10000);
  } catch (e) {
    console.error('[千川监控] 初始化失败:', e.message);
  }
});

// =============================================================================
// 监听来自 popup 的实时查询
// =============================================================================
try {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.type === 'GET_CONSUMPTION_NOW') {
        const data = getCompassData();
        console.log('[千川监控] 实时查询返回:', data);
        sendResponse(data);
      } else if (request.type === 'XPATH_CONFIG_UPDATED') {
        console.log('[千川监控] 收到XPath配置更新:', request.data);
        loadXpathConfig();
      } else if (request.type === 'SIDEBAR_STATE_CHANGED') {
        // 修复：处理侧边栏状态变化广播
        const btn = document.getElementById('qianchuan-floating-btn');
        if (btn) {
          updateSidebarState(request.isOpen === true, btn);
          sidebarOpen = request.isOpen === true;
          console.log('[千川监控] 收到侧边栏状态广播:', request.isOpen);
        }
      }
    } catch (e) {
      console.error('[千川监控] 消息处理失败:', e);
    }
    return true;
  });
} catch (e) {
  console.warn('[千川监控] 消息监听失败:', e.message);
}

// =============================================================================
// 页面卸载前清理
// =============================================================================
window.addEventListener('beforeunload', () => {
  try {
    stopAutoRefresh();
    if (sendCompassDataInterval !== null && sendCompassDataInterval !== undefined) {
      clearInterval(sendCompassDataInterval);
      sendCompassDataInterval = null;
      console.log('[千川监控] ✅ 已清理数据发送定时器');
    }
    console.log('[千川监控] 页面卸载，资源已清理');
  } catch (e) {
    console.error('[千川监控] 页面卸载清理异常:', e.message);
  }
});

// =============================================================================
// 千川监控助手 - 悬浮按钮与侧边栏控制 v2.6.1 (修复版)
// 修复：删除重复函数定义，优化状态同步
// =============================================================================

// 全局状态
let sidebarOpen = false;
let sidebarCheckInterval = null;

// 创建悬浮按钮（唯一版本，删除之前的重复定义）
function createFloatingButton() {
  if (document.getElementById('qianchuan-floating-btn')) {
    return;
  }
  
  const btn = document.createElement('div');
  btn.id = 'qianchuan-floating-btn';
  btn.innerHTML = `
    <span class="icon">📊</span>
    <span class="tooltip">千川监控助手</span>
  `;
  
  // 点击处理：单击打开，双击关闭（3秒内）
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 如果正在拖拽，不触发点击
    if (btn.classList.contains('dragging')) {
      return;
    }
    
    const now = Date.now();
    const lastClick = parseInt(btn.dataset.lastClick || '0');
    const timeDiff = now - lastClick;
    btn.dataset.lastClick = now.toString();
    
    // 3秒内重复点击且侧边栏已打开 -> 关闭
    if (timeDiff < 3000 && sidebarOpen) {
      console.log('[千川监控] 双击检测，请求关闭侧边栏');
      try {
        await chrome.runtime.sendMessage({ type: 'CLOSE_SIDEBAR' });
        // 立即更新UI状态（乐观更新）
        updateSidebarState(false, btn);
        sidebarOpen = false;
      } catch (e) {
        console.warn('[千川监控] 关闭侧边栏失败:', e.message);
      }
      return;
    }
    
    // 单击打开
    if (!sidebarOpen) {
      try {
        await chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' });
        updateSidebarState(true, btn);
        sidebarOpen = true;
        console.log('[千川监控] 打开侧边栏');
      } catch (error) {
        console.warn('[千川监控] 打开侧边栏失败:', error.message);
        showExtensionWarning();
      }
    } else {
      // 已打开状态的单击，给出提示
      showTooltipTemp(btn, '再次点击关闭');
    }
  });
  
  // 拖拽功能
  let isDragging = false;
  let hasMoved = false;
  let startX, startY, initialRight, initialBottom;
  
  btn.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tooltip')) return;
    
    isDragging = false;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = btn.getBoundingClientRect();
    initialRight = window.innerWidth - rect.right;
    initialBottom = window.innerHeight - rect.bottom;
    
    btn.style.transition = 'none';
    
    const handleMouseMove = (e) => {
      const deltaX = startX - e.clientX;
      const deltaY = startY - e.clientY;
      
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        isDragging = true;
        hasMoved = true;
        btn.classList.add('dragging');
      }
      
      if (isDragging) {
        const newRight = Math.max(0, Math.min(window.innerWidth - 51, initialRight + deltaX));
        const newBottom = Math.max(0, Math.min(window.innerHeight - 51, initialBottom + deltaY));
        
        btn.style.right = newRight + 'px';
        btn.style.bottom = newBottom + 'px';
        btn.style.left = 'auto';
        btn.style.top = 'auto';
      }
    };
    
    const handleMouseUp = () => {
      btn.style.transition = '';
      btn.classList.remove('dragging');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // 如果拖拽过，重置点击时间防止误触发
      if (hasMoved) {
        btn.dataset.lastClick = '0';
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });
  
  document.body.appendChild(btn);
  console.log('[千川监控] 悬浮按钮已创建 (v2.6.1 修复版)');
  
  // 检查初始状态
  checkInitialSidebarState(btn);
}

// 检查初始侧边栏状态
async function checkInitialSidebarState(btn) {
  try {
    const result = await chrome.storage.local.get(['sidebarOpen']);
    if (result.sidebarOpen) {
      updateSidebarState(true, btn);
      sidebarOpen = true;
    }
  } catch (e) {}
}

// 更新按钮状态
function updateSidebarState(isOpen, btn) {
  sidebarOpen = isOpen;
  const tooltip = btn.querySelector('.tooltip');
  
  if (isOpen) {
    btn.classList.add('active');
    tooltip.innerHTML = '双击关';
  } else {
    btn.classList.remove('active');
    tooltip.innerHTML = '千川监控助手';
  }
}

// 临时显示提示
function showTooltipTemp(btn, text) {
  const tooltip = btn.querySelector('.tooltip');
  const originalHTML = tooltip.innerHTML;
  tooltip.innerHTML = text;
  tooltip.style.opacity = '1';
  tooltip.style.visibility = 'visible';
  
  setTimeout(() => {
    tooltip.innerHTML = originalHTML;
    tooltip.style.opacity = '';
    tooltip.style.visibility = '';
  }, 2000);
}

// 初始化：页面加载完成后创建按钮
if (location.href.includes('compass.jinritemai.com')) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(createFloatingButton, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(createFloatingButton, 1000);
    });
  }
}

// =============================================================================
// 修复：监听来自 background 的状态更新（通过 storage）
// =============================================================================
try {
  // 监听 storage 变化（侧边栏状态变化）
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      // 处理侧边栏打开状态变化
      if (changes.sidebarOpen !== undefined) {
        const btn = document.getElementById('qianchuan-floating-btn');
        if (btn) {
          const shouldBeOpen = changes.sidebarOpen.newValue === true;
          updateSidebarState(shouldBeOpen, btn);
          sidebarOpen = shouldBeOpen;
          console.log('[千川监控] 侧边栏状态已同步:', shouldBeOpen);
        }
      }
      
      // 处理关闭请求（如果当前页面是侧边栏，会在 sidebar.js 中处理）
      if (changes.sidebarCloseRequest !== undefined) {
        // content script 不需要处理关闭请求，只接收状态变化即可
        console.log('[千川监控] 检测到关闭请求');
      }
    }
  });
  
  // 定期检查 storage 中的状态（防止漏掉消息）
  setInterval(async () => {
    try {
      if (!isExtensionValid) return;
      const result = await chrome.storage.local.get(['sidebarOpen']);
      const btn = document.getElementById('qianchuan-floating-btn');
      if (btn && sidebarOpen !== result.sidebarOpen) {
        updateSidebarState(result.sidebarOpen === true, btn);
        sidebarOpen = result.sidebarOpen === true;
      }
    } catch (e) {}
  }, 5000); // 每5秒检查一次
  
} catch (e) {
  console.warn('[千川监控] 监听状态失败:', e.message);
}