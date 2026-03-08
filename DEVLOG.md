# Tab Manager 开发日志

## 项目信息
- **项目名**: 智能标签管理器
- **技术栈**: Chrome Extension + JavaScript
- **开始日期**: 2026-03-08
- **当前版本**: v0.1.0-alpha

---

## 开发进度追踪

### ✅ 已完成
- [x] 项目初始化
- [x] 需求分析

### 🚧 进行中
- [ ] MVP架构设计（当前）

### 📋 待办
- [ ] Week 1: 基础架构
- [ ] Week 2: 智能化
- [ ] Week 3: 优化迭代

---

## 开发会话记录

### Session: 2026-03-08 晚上（第二次迭代）
**时长**: 1.5小时
**重大更新**: AI智能分类功能

**完成**:
- ✅ 删除所有硬编码分类
- ✅ 集成 DeepSeek API
- ✅ 实现智能分类按钮
- ✅ 智能缓存机制
- ✅ API配置界面

**技术改进**:
- 重写 service-worker.js，轻量化架构
- 重写 popup.js，支持AI分类
- 添加设置对话框
- 实现基于 URL+title 的缓存

**核心功能**:
- 用户点击 🤖 按钮触发分类
- AI返回分类路径（如：AI > LLM > 智谱）
- 自动创建分类树结构
- 缓存结果，避免重复调用API

**API用量控制**:
- 只有手动点击才调用API
- 相同网页自动跳过
- 预估成本：100次分类 ≈ 1.4分

**下一步**:
- 用户测试 DeepSeek 分类效果
- 根据反馈优化 prompt
- 可选支持其他 LLM 提供商

---

### 下次开发清单
1. 阅读: `lib/tree.js` - 检查树形结构实现
2. 阅读: `lib/storage.js` - 确认存储API
3. 实现: popup.html基础UI
4. 测试: 创建分类功能

---

## 技术债务
*记录需要重构或优化的代码*

- [ ] 暂无

---

## Bug列表
*记录发现的bug*

- [ ] 暂无

---

## 学习笔记

### Chrome Extension MV3 关键点
- 使用service-worker替代background page
- 不再支持XMLHttpRequest，使用fetch
- 存储API: chrome.storage.sync（限制100KB）

### 树形数据结构
- 深度优先搜索用于查找节点
- 递归实现简单但注意性能
- 可考虑扁平化映射提高查询速度

---

## 资源链接

### 官方文档
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [MV3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating/)

### 参考项目
- [Tab Organizer](https://github.com/example/tab-organizer)
- [Session Buddy](https://sessionbuddy.com/)

### 工具
- [Extension Reloader](chrome://extensions/) - 开发时重载
- [CRXJS Vite Plugin](https://crxjs.dev/) - 热更新

---

## 维护检查清单

**每次开发前（5分钟）**:
1. 阅读上次会话记录
2. 检查"下次开发清单"
3. 查看"阻塞问题"
4. 运行测试（如有）

**每次开发结束（5分钟）**:
1. 更新开发进度
2. 记录重要决策
3. 列出下一步任务
4. 记录阻塞问题
5. 提交git commit

**每周维护（30分钟）**:
1. 整理技术债务
2. 回顾bug列表
3. 更新学习笔记
4. 规划下周任务

---

## 配置文件示例

### manifest.json (v0.1.0)
```json
{
  "manifest_version": 3,
  "name": "Smart Tab Manager",
  "version": "0.1.0",
  "description": "层级化管理浏览器标签",
  "permissions": [
    "tabs",
    "storage"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## 测试策略

### 单元测试
- 使用Jest测试lib/*.js
- 重点测试树形结构操作

### 集成测试
- 手动测试核心流程
- 使用Chrome DevTools调试

### 测试用例清单
- [ ] 创建分类
- [ ] 删除分类
- [ ] 移动分类
- [ ] 添加标签到分类
- [ ] 移除标签
- [ ] 自动归类
- [ ] 数据持久化

---

## 性能指标

### 目标
- 弹窗打开: <100ms
- 分类查询: <50ms
- 存储操作: <200ms
- 内存占用: <50MB

### 当前测量
- 弹窗打开: 未测量
- 分类查询: 未测量
- 存储操作: 未测量
- 内存占用: 未测量

---

## Git提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
refactor: 重构
test: 测试
chore: 构建/工具

示例:
feat: 实现树形分类结构
fix: 修复分类删除bug
docs: 更新开发日志
```
