<div align="center">

# 📊 千川监控助手

[![Version](https://img.shields.io/badge/version-2.7.0-blue.svg)](https://github.com/360PB/douyin-live-monitor)
[![Chrome Extension](https://img.shields.io/badge/platform-Chrome%20Extension-green.svg)](https://www.google.com/chrome/)
[![License](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-orange.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-stable-brightgreen.svg)]()

**实时监控抖音电商罗盘千川投放数据，智能预警，一键推送**

[功能特性](#功能特性) · [安装指南](#安装指南) · [使用文档](#使用文档) · [技术架构](#技术架构) · [更新日志](CHANGELOG.md)

</div>

---

## 📌 项目简介

千川监控助手是一款专为抖音电商罗盘千川投放场景设计的 Chrome 浏览器扩展。它能够自动抓取页面核心数据指标，通过企业微信机器人定时推送数据报告，并在异常情况时实时预警，帮助运营团队及时掌握直播间投放动态。

> ⚠️ **本项目采用 [CC BY-NC-SA 4.0](LICENSE) 协议，禁止商业用途。**

---

## ✨ 功能特性

### 核心监控
| 功能 | 说明 |
|------|------|
| 📊 **实时数据抓取** | 自动抓取千川消耗、成交金额、GPM、在线人数、ROI、曝光观看率、互动率等核心指标 |
| 📡 **定时数据推送** | 按设定间隔（支持 1-60 分钟）推送格式化数据报告到企业微信 |
| 📺 **直播状态检测** | 智能识别直播间开播/停播状态，未开播时自动暂停推送 |

### 智能预警
| 预警类型 | 触发条件 | 推送方式 |
|----------|----------|----------|
| ⚠️ **消耗阈值预警** | 每分钟消耗超过设定金额 | 即时推送 |
| 👥 **在线人数预警** | 在线人数超过设定阈值 | 即时推送 |
| 📉 **低在线预警** | 在线人数低于设定值并持续一段时间 | 即时/延时推送 |
| 📈 **ROI 异常预警** | ROI 低于设定阈值 | 按间隔推送 |
| 💰 **成交变动推送** | 成交金额发生变化时 | 即时推送 |

### 高级功能
- 🔧 **XPath 自定义** — 支持自定义数据抓取规则，适配页面布局变化
- 🔄 **自动刷新** — 页面隐藏时自动刷新，保持数据最新
- 📱 **侧边栏模式** — Chrome 原生侧边栏，悬浮按钮一键展开/收起
- 📈 **数据历史** — 保留最近 100 条数据记录
- ⏰ **时间对齐** — 推送时间自动对齐到整点，便于对比分析

---

## 📥 安装指南

### 方式一：开发者模式加载（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/360PB/douyin-live-monitor.git

# 2. 打开 Chrome 扩展管理页面
# 访问: chrome://extensions/

# 3. 开启右上角"开发者模式"

# 4. 点击"加载已解压的扩展程序"
# 选择 douyin-live-monitor 文件夹
```

### 方式二：直接下载

1. 访问 [Releases](https://github.com/360PB/douyin-live-monitor/releases) 页面
2. 下载最新版本的 `.zip` 文件
3. 解压后按方式一加载

### 安装后配置

1. 固定扩展图标到工具栏
2. 打开 [抖音电商罗盘](https://compass.jinritemai.com/) 千川页面
3. 点击扩展图标打开侧边栏进行配置

---

## 📖 使用文档

### 快速开始

#### 1. 配置企业微信 Webhook

```
1. 在企业微信群中 → 群设置 → 添加群机器人
2. 复制 Webhook 地址
3. 在插件侧边栏「基础配置」中粘贴并保存
```

#### 2. 开启数据监控

- 打开抖音电商罗盘千川页面
- 插件自动抓取数据并显示在侧边栏
- 数据将按设定间隔自动推送到企业微信

#### 3. 设置预警规则

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 消耗阈值 | 4 元/分钟 | 超过此值触发预警 |
| 在线人数阈值 | 10 人 | 超过此值触发预警 |
| 低在线阈值 | 2 人 | 低于此值触发预警 |
| 低在线持续时长 | 3 分钟 | 持续低于阈值后推送 |
| ROI 预警阈值 | 10.0 | 低于此值触发预警 |
| ROI 推送间隔 | 30 分钟 | 避免频繁推送 |

### 侧边栏操作

| 按钮 | 功能 |
|------|------|
| 🧪 **测试** | 立即发送一条测试消息到企业微信 |
| ⏰ **同步** | 重新对齐推送时间到整点 |
| ⚡ **推送** | 立即触发一次数据推送 |
| 💾 **保存** | 保存当前所有配置 |

### 悬浮按钮操作

- **单击** — 打开侧边栏
- **3秒内双击** — 关闭侧边栏
- **拖拽** — 调整按钮位置

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Browser                           │
│  ┌─────────────────────┐    ┌───────────────────────────┐  │
│  │ 抖音电商罗盘页面     │    │      扩展侧边栏            │  │
│  │ ┌───────────────┐   │    │   ┌───────────────────┐   │  │
│  │ │ content.js    │   │    │   │  sidebar.html     │   │  │
│  │ │ 页面数据抓取   │   │    │   │  sidebar.js       │   │  │
│  │ │ floating-btn  │   │    │   │  配置面板/UI      │   │  │
│  │ └───────┬───────┘   │    │   └───────────────────┘   │  │
│  └─────────┼───────────┘    └───────────────────────────┘  │
│            │ Chrome Message API                              │
│            ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           background.js (Service Worker)             │   │
│  │  ├─ 数据处理 & 本地存储 (chrome.storage)              │   │
│  │  ├─ 定时任务调度 (chrome.alarms)                     │   │
│  │  ├─ 阈值检查 & 预警逻辑                              │   │
│  │  ├─ 企业微信消息推送                                 │   │
│  │  └─ 健康检查 & 状态监控                              │   │
│  └────────────────────────┬────────────────────────────┘   │
│                           │ HTTPS POST                      │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              企业微信机器人 API                      │   │
│  │         (qyapi.weixin.qq.com)                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 数据抓取策略

1. **XPath 定位**（主要方式）
   - 精确匹配罗盘页面 DOM 结构
   - 支持用户自定义 XPath 规则

2. **智能标签匹配**（备用方式）
   - XPath 失效时自动降级
   - 支持 Odometer 数字组件解析

3. **多层数据校验**
   - 过滤科学计数法等异常值
   - 金额上限校验（1 亿）
   - 逻辑合理性检查（退款 ≤ 成交）

---

## 📁 项目结构

```
douyin-live-monitor/
├── manifest.json          # Chrome 扩展清单 (Manifest V3)
├── background.js          # Service Worker - 核心后台逻辑
├── content.js             # 内容脚本 - 页面数据抓取
├── sidebar.html           # 侧边栏配置页面
├── sidebar.js             # 侧边栏交互逻辑
├── floating-btn.css       # 悬浮按钮样式
├── icon16.png             # 扩展图标
├── icon48.png
├── icon128.png
├── LICENSE                # CC BY-NC-SA 4.0 许可证
├── CHANGELOG.md           # 更新日志
├── CONTRIBUTING.md        # 贡献指南
├── .gitignore             # Git 忽略规则
└── README.md              # 项目说明
```

---

## 🔒 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 保存用户配置和数据历史 |
| `alarms` | 定时推送和阈值检查任务 |
| `notifications` | 系统通知提醒 |
| `scripting` | 向罗盘页面注入数据抓取脚本 |
| `webNavigation` | 监听页面加载并自动注入脚本 |
| `tabs` / `activeTab` | 标签页管理和数据通信 |
| `sidePanel` | Chrome 原生侧边栏功能 |

---

## 🛠️ 开发说明

### 本地开发

```bash
# 克隆项目
git clone https://github.com/360PB/douyin-live-monitor.git
cd douyin-live-monitor

# 在 Chrome 中加载扩展（开发者模式）
# 修改代码后点击扩展卡片上的刷新按钮即可生效
```

### 调试技巧

- **Background Script**：扩展管理页面 → Service Worker → Inspect
- **Content Script**：罗盘页面 → DevTools → Console（过滤 `[千川监控]`）
- **Side Panel**：侧边栏页面 → 右键 → 检查

---

## 📋 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)

### v2.7.0 (最新)
- ✨ 新增曝光观看率、互动率数据抓取
- 🔧 优化侧边栏状态同步机制
- 🛡️ 增强数据校验和异常值过滤
- 🐛 修复自动刷新功能

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！详见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## ⚖️ 开源协议

本作品采用 [知识共享署名-非商业性使用-相同方式共享 4.0 国际许可协议](https://creativecommons.org/licenses/by-nc-sa/4.0/) 进行许可。

- ✅ 允许自由使用、修改、分享
- ✅ 修改后需以相同协议开源
- ❌ **禁止用于商业目的**

[![CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

---

<div align="center">

**Made with ❤️ by 千尺浪**

[GitHub](https://github.com/360PB/douyin-live-monitor) · [Issues](https://github.com/360PB/douyin-live-monitor/issues)

</div>
