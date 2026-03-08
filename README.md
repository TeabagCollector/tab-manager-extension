# Tab Manager v0.2.0 - AI智能分类版

## 🎉 重大更新

**删除了所有硬编码分类，实现AI智能分类！**

---

## 🚀 核心功能

### **AI智能分类**
- 点击未分类标签右侧的 🤖 按钮
- DeepSeek AI 自动分析网页内容
- 返回分类路径并自动创建分类树

### **API用量控制**
- ✅ 只有用户主动点击才调用API
- ✅ 智能缓存，相同网页不重复调用
- ✅ 基于 URL + title 的指纹识别
- ✅ 完全手动控制，无自动分类

---

## 📋 使用步骤

### **Step 1: 配置API**

```
1. 点击扩展图标
2. 点击右上角 ⚙️ 设置按钮
3. 填写：
   - DeepSeek API Key (从 https://platform.deepseek.com 获取)
   - API Endpoint (默认已填写)
   - 模型 (默认 deepseek-chat)
4. 点击"保存"
```

### **Step 2: 智能分类**

```
1. 打开任意网页
2. 点击扩展图标
3. 在"未分类"区域找到该网页
4. 点击标签右侧的 🤖 按钮
5. 等待AI分析（约1-2秒）
6. 自动创建分类并归档
```

---

## 💡 分类示例

**AI可能返回的分类路径：**

```
输入：https://open.bigmodel.cn
标题：智谱AI开放平台
输出：人工智能 > LLM提供商 > 智谱

输入：https://github.com
标题：GitHub: Let's build from here
输出：开发工具 > 代码托管 > GitHub

输入：https://www.kaggle.com
标题：Kaggle: Your Machine Learning Community
输出：人工智能 > 机器学习平台 > Kaggle
```

---

## 🎯 缓存机制

### **避免重复调用API**

系统会自动缓存已分类的网页：

```javascript
缓存Key = Base64(URL + Title).substring(0, 32)

例如：
https://open.bigmodel.cn + 智谱AI开放平台
→ 缓存Key: aHR0cHM6Ly9vcGVuLmJp
→ 分类结果: 人工智能 > LLM提供商 > 智谱

下次打开相同网页：
→ 直接从缓存读取，不调用API ✅
```

### **何时会重新调用API？**

- ✅ URL改变
- ✅ 标题改变
- ✅ 手动清除缓存

---

## 📊 API用量估算

### **DeepSeek 价格**
```
模型: deepseek-chat
输入: ¥0.001 / 1K tokens
输出: ¥0.002 / 1K tokens

每次分类大约：
- 输入: ~100 tokens (网页标题+URL)
- 输出: ~20 tokens (分类路径)
- 成本: ~¥0.00014 ≈ 0.014分

100次分类 ≈ 1.4分 💰
```

### **节省策略**
- 相同网页只调用1次
- 分类100个不同网页 ≈ 1.4分
- 大部分日常使用几乎免费

---

## 🔧 高级配置

### **自定义API Endpoint**

```
支持兼容OpenAI格式的API：
- DeepSeek: https://api.deepseek.com/v1/chat/completions
- OpenAI: https://api.openai.com/v1/chat/completions
- 本地部署: http://localhost:8000/v1/chat/completions
```

### **模型选择**

```
DeepSeek:
- deepseek-chat (推荐，性价比高)
- deepseek-coder (代码相关)

OpenAI:
- gpt-3.5-turbo (快速)
- gpt-4 (精准但贵)
```

---

## 🐛 故障排查

### **分类失败**

**错误1: "请先配置 DeepSeek API Key"**
```
解决：设置 → 填写API Key → 保存
```

**错误2: "API请求失败: 401"**
```
解决：API Key 错误，检查是否正确复制
```

**错误3: "AI返回格式错误"**
```
解决：模型返回非JSON格式，尝试其他模型
```

### **缓存问题**

**想重新分类：**

```javascript
// 在扩展的 DevTools Console 中执行
chrome.storage.sync.get('tabManager', (data) => {
  delete data.tabManager.cache['缓存Key'];
  chrome.storage.sync.set({tabManager: data});
});
```

**清空所有缓存：**

```javascript
chrome.storage.sync.get('tabManager', (data) => {
  data.tabManager.cache = {};
  chrome.storage.sync.set({tabManager: data});
});
```

---

## 📝 与v0.1.0的区别

| 功能 | v0.1.0 | v0.2.0 |
|------|--------|--------|
| 默认分类 | ✅ 硬编码 | ❌ 无 |
| 自动分类 | ✅ 基于域名 | ❌ 移除 |
| AI分类 | ❌ 无 | ✅ DeepSeek |
| 缓存机制 | ❌ 无 | ✅ 智能缓存 |
| API用量 | 💚 零 | 💰 按需付费 |

---

## 🎯 最佳实践

### **推荐使用场景**

1. **新安装时**
   - 先配置API Key
   - 打开常用网站
   - 逐个点击 🤖 分类
   - 建立自己的分类体系

2. **日常使用**
   - 遇到新网站点击 🤖
   - 大部分网站已缓存，零成本
   - 定期整理分类树

3. **团队协作**
   - 导出分类配置
   - 分享给团队成员
   - 统一命名规范

---

## 🔄 更新说明

### **v0.2.0** (2026-03-08)
- ✅ 删除硬编码分类
- ✅ 集成 DeepSeek AI
- ✅ 智能缓存机制
- ✅ API配置界面
- ✅ 手动触发分类

### **v0.1.0** (2026-03-08)
- ✅ 基础分类功能
- ✅ 域名自动匹配
- ✅ 树形分类树

---

## 💬 反馈与改进

**如果你有任何建议：**

- 分类准确性如何？
- API用量是否合理？
- 是否需要其他LLM支持？
- prompt是否需要优化？

**告诉我你的使用体验，我会持续改进！**

---

## 🚀 立即开始

```bash
# 更新代码
git pull

# 重新加载扩展
chrome://extensions/ → 刷新

# 配置API Key
点击 ⚙️ → 填写 DeepSeek API Key

# 开始分类
打开网页 → 点击 🤖 → 完成！
```

**享受AI智能分类的便捷吧！** 🎉
