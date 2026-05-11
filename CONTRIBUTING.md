# 贡献指南

感谢您对千川监控助手的关注！本文档将帮助您了解如何参与项目贡献。

---

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
  - [报告问题](#报告问题)
  - [提交功能建议](#提交功能建议)
  - [提交代码](#提交代码)
- [开发环境](#开发环境)
- [代码规范](#代码规范)
- [提交规范](#提交规范)

---

## 📜 行为准则

参与本项目即表示您同意遵守以下准则：

- 尊重所有参与者，保持友善和建设性
- 接受建设性的批评，并以优雅的态度回应
- 关注对社区最有利的事情
- 禁止任何形式的骚扰、歧视或攻击性行为

---

## 🚀 如何贡献

### 报告问题

如果您发现了 bug 或有改进建议，请通过 [GitHub Issues](https://github.com/360PB/douyin-live-monitor/issues) 提交。

**提交 Issue 前请确认：**

- [ ] 已搜索现有 Issue，避免重复提交
- [ ] 使用最新版本复现了问题
- [ ] 提供了清晰的标题和描述

**Bug 报告模板：**

```markdown
**描述问题**
清晰简洁地描述 bug 是什么。

**复现步骤**
1. 打开 '...'
2. 点击 '...'
3. 滚动到 '...'
4. 出现错误

**期望行为**
清晰描述您期望发生的情况。

**实际行为**
清晰描述实际发生的情况。

**环境信息**
- Chrome 版本: [e.g. 120.0.6099.130]
- 扩展版本: [e.g. 2.7.0]
- 操作系统: [e.g. Windows 11]

**截图**
如果适用，添加截图帮助说明问题。

**附加信息**
任何其他上下文信息。
```

### 提交功能建议

- 使用标题 `[Feature Request]` 开头
- 清晰描述功能的使用场景
- 说明该功能将解决什么问题

### 提交代码

#### 工作流程

```bash
# 1. Fork 本仓库

# 2. 克隆您的 Fork
git clone https://github.com/YOUR_USERNAME/douyin-live-monitor.git

# 3. 创建功能分支
git checkout -b feature/your-feature-name

# 4. 进行修改并提交
git add .
git commit -m "feat: add some feature"

# 5. 推送到您的 Fork
git push origin feature/your-feature-name

# 6. 创建 Pull Request
```

#### Pull Request 规范

- PR 标题使用 [提交规范](#提交规范) 格式
- 在 PR 描述中关联相关 Issue（如有）
- 确保代码通过本地测试
- 保持 PR 的单一职责，一个 PR 只解决一个问题

---

## 🛠️ 开发环境

### 前置要求

- Chrome 浏览器（推荐最新稳定版）
- Git
- 文本编辑器（推荐 VS Code）

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/360PB/douyin-live-monitor.git
cd douyin-live-monitor

# 在 Chrome 中加载扩展
# 1. 打开 chrome://extensions/
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择项目文件夹
```

### 调试

| 组件 | 调试方式 |
|------|----------|
| Background Script | 扩展管理页 → Service Worker → Inspect |
| Content Script | 目标页面 → DevTools → Console |
| Side Panel | 侧边栏内 → 右键 → 检查 |

---

## 📐 代码规范

### JavaScript

- 使用 ES6+ 语法
- 使用 `const` / `let`，避免 `var`
- 异步操作使用 `async/await`
- 函数使用驼峰命名（camelCase）
- 常量使用全大写下划线命名（UPPER_SNAKE_CASE）

### 代码组织

```javascript
// =============================================================================
// 文件说明 - 简短描述文件用途
// =============================================================================

// 常量定义（顶部）
const MAX_RETRIES = 3;

// 工具函数
function helper() { }

// 核心逻辑
async function main() { }

// 事件监听（底部）
chrome.runtime.onMessage.addListener(() => { });
```

### 注释规范

```javascript
// 单行注释：说明"为什么"

/**
 * 函数注释
 * @param {string} param1 - 参数说明
 * @param {number} param2 - 参数说明
 * @returns {Promise<boolean>} 返回值说明
 */
async function example(param1, param2) {
  // ...
}
```

### CSS

- 使用 CSS 变量管理主题色
- 类名使用 kebab-case
- 避免使用 `!important`

---

## 📝 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能）|
| `refactor` | 代码重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |

### 示例

```bash
feat: add ROI threshold alert feature

fix(background): resolve alarm sync issue
docs: update installation guide
style(sidebar): improve button hover effects
refactor(content): optimize data extraction logic
```

---

## 📄 许可证

通过提交代码，您同意您的贡献将在 [CC BY-NC-SA 4.0](LICENSE) 协议下发布。

---

## 💬 联系方式

如有疑问，欢迎通过以下方式联系：

- [GitHub Issues](https://github.com/360PB/douyin-live-monitor/issues)

感谢您的贡献！🎉
