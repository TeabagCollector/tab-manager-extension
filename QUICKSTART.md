# Tab Manager - 快速开始指南

## 📦 如何获取代码

### 方法1: 直接复制文件

我在服务器已创建所有代码文件，你可以：

1. **查看文件内容**
```
对我说："显示 tree.js 的代码"
我会输出完整代码，你复制到本地
```

2. **批量获取**
```
对我说："打包整个项目"
我会打包成zip供你下载
```

### 方法2: Git同步（推荐）

```bash
# 1. 在服务器创建GitHub仓库（或Gitee）
# 2. 推送代码
cd /root/.openclaw/workspace/projects/tab-manager
git remote add origin <your-repo-url>
git push -u origin master

# 3. 你在本地克隆
git clone <your-repo-url>
```

### 方法3: SSH/文件共享

如果你的电脑可以访问服务器：
```bash
# 通过SCP下载
scp -r user@server:/root/.openclaw/workspace/projects/tab-manager ./
```

---

## 🚀 安装到浏览器

### Chrome/Edge

1. 打开扩展管理页面
```
chrome://extensions/
# 或
edge://extensions/
```

2. 开启"开发者模式"（右上角）

3. 点击"加载已解压的扩展程序"

4. 选择 `tab-manager` 文件夹

5. 完成！点击浏览器工具栏图标测试

---

## 🎯 下一步

### 立即可用
- ✅ 创建分类
- ✅ 自动归类标签
- ✅ 搜索标签
- ✅ 打开/关闭标签

### 待完善
- [ ] 图标资源（目前使用占位符）
- [ ] 拖拽归类
- [ ] 导入/导出配置
- [ ] Safari适配

---

## 💻 开发流程

### 每次开发前
1. 拉取最新代码（如使用Git）
2. 在 `chrome://extensions/` 点击刷新按钮
3. 测试功能

### 开发中
- 修改代码
- 刷新扩展
- 查看效果

### 开发后
- 告诉我进度
- 我更新DEVLOG.md
- 记录下一步任务

---

## 📋 功能清单

### ✅ 已实现
- 树形分类结构
- 智能自动归类
- 本地存储
- 搜索过滤
- 基础UI

### 🚧 进行中
- 图标资源

### 📅 计划中
- 拖拽归类
- 云同步
- 标签统计
- Safari版本

---

## 🐛 遇到问题？

### 扩展无法加载
- 检查manifest.json格式
- 确认所有文件路径正确
- 查看浏览器控制台错误信息

### 功能不工作
- 打开扩展的DevTools（右键弹窗 → 检查）
- 查看Console错误
- 告诉我错误信息

---

## 📞 协作方式

**你说**: "继续开发Tab Manager"
**我执行**:
1. 读取DEVLOG.md
2. 报告当前进度
3. 提供下一步建议
4. 生成所需代码
