# Tab Manager - 智能标签管理器

> Chrome Extension - 层级化管理浏览器标签

## 快速开始

### 安装到Chrome

1. 下载项目到本地
```bash
git clone <your-repo-url>
cd tab-manager
```

2. 打开Chrome扩展页面
```
chrome://extensions/
```

3. 开启"开发者模式"

4. 点击"加载已解压的扩展程序"

5. 选择项目文件夹

### 开发

```bash
# 修改代码后，在扩展页面点击刷新按钮即可
```

---

## 项目结构

```
tab-manager/
├── manifest.json          # 扩展配置
├── background/
│   └── service-worker.js  # 后台服务
├── popup/
│   ├── popup.html        # 弹窗UI
│   ├── popup.js          # 弹窗逻辑
│   └── popup.css         # 样式
├── lib/
│   ├── tree.js           # 树形数据结构
│   ├── storage.js        # 存储管理
│   ├── rules.js          # 智能规则
│   └── utils.js          # 工具函数
├── icons/                # 图标资源
├── DEVLOG.md            # 开发日志
└── ROADMAP.md           # 进度看板
```

---

## 开发指南

详见 [DEVLOG.md](./DEVLOG.md)
