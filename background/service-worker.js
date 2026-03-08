/**
 * Service Worker - 后台服务
 * 处理标签事件和自动分类
 */

// 直接在全局定义 RulesEngine 和 StorageManager
class RulesEngine {
  constructor(rules = []) {
    this.rules = rules;
  }

  match(url) {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.pattern.test(url)) {
        return {
          ruleId: rule.id,
          categoryId: rule.categoryId,
          confidence: 1 / rule.priority
        };
      }
    }
    return null;
  }

  addRule(rule) {
    this.rules.push({
      id: `rule-custom-${Date.now()}`,
      priority: 5,
      enabled: true,
      ...rule
    });
  }
}

class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'tabManager';
  }

  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.STORAGE_KEY, (result) => {
        resolve(result[this.STORAGE_KEY] || this.getDefaultData());
      });
    });
  }

  async saveAll(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({
        [this.STORAGE_KEY]: data
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async saveTabMapping(tabId, categoryId) {
    const data = await this.getAll();
    if (!data.tabs) data.tabs = {};
    data.tabs[tabId] = {
      categoryId,
      lastUpdate: Date.now()
    };
    await this.saveAll(data);
  }

  async removeTabMapping(tabId) {
    const data = await this.getAll();
    if (data.tabs) {
      delete data.tabs[tabId];
      await this.saveAll(data);
    }
  }

  async updateStats(domain) {
    const data = await this.getAll();
    if (!data.stats) data.stats = {};
    const current = data.stats[domain] || { visitCount: 0 };
    data.stats[domain] = {
      visitCount: current.visitCount + 1,
      lastVisit: Date.now()
    };
    await this.saveAll(data);
  }

  getDefaultData() {
    return {
      categories: {
        id: 'root',
        name: '所有标签',
        children: [],
        tabs: []
      },
      tabs: {},
      settings: {
        autoCategorize: true,
        showFavicons: true
      },
      stats: {},
      version: '0.1.0',
      createdAt: Date.now()
    };
  }
}

class BackgroundService {
  constructor() {
    this.storage = new StorageManager();
    this.rules = new RulesEngine();
    
    this.init();
  }

  async init() {
    // 监听标签创建
    chrome.tabs.onCreated.addListener((tab) => {
      this.handleTabCreated(tab);
    });

    // 监听标签关闭
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    // 监听标签更新
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url) {
        this.handleTabUrlChanged(tab);
      }
    });

    // 安装时的初始化
    chrome.runtime.onInstalled.addListener(async () => {
      console.log('Tab Manager installed');
      await this.initDefaultCategories();
    });

    // 加载已有规则
    await this.loadRules();
  }

  async loadRules() {
    const data = await this.storage.getAll();
    // 从分类中提取规则
    this.buildRulesFromCategories(data.categories);
  }

  buildRulesFromCategories(node) {
    if (node.domains && node.domains.length > 0) {
      const pattern = new RegExp(node.domains.join('|').replace(/\./g, '\\.'));
      this.rules.addRule({
        name: node.name,
        pattern: pattern,
        categoryId: node.id,
        priority: 1
      });
    }
    
    if (node.children) {
      node.children.forEach(child => this.buildRulesFromCategories(child));
    }
  }

  async handleTabCreated(tab) {
    if (!tab.url || tab.url.startsWith('chrome://')) {
      return;
    }

    // 尝试自动分类
    const match = this.rules.match(tab.url);
    if (match) {
      await this.storage.saveTabMapping(tab.id, match.categoryId);
      console.log(`Tab ${tab.id} auto-categorized to ${match.categoryId}`);
    }

    // 更新统计数据
    try {
      const domain = new URL(tab.url).hostname;
      await this.storage.updateStats(domain);
    } catch (e) {
      // URL解析失败，忽略
    }
  }

  async handleTabRemoved(tabId) {
    await this.storage.removeTabMapping(tabId);
    console.log(`Tab ${tabId} removed from mapping`);
  }

  async handleTabUrlChanged(tab) {
    if (!tab.url || tab.url.startsWith('chrome://')) {
      return;
    }

    // 重新分类
    const match = this.rules.match(tab.url);
    if (match) {
      await this.storage.saveTabMapping(tab.id, match.categoryId);
    }
  }

  async initDefaultCategories() {
    const data = await this.storage.getAll();
    
    // 如果是新安装，创建默认分类结构
    if (!data.categories.children || data.categories.children.length === 0) {
      const defaultCategories = [
        {
          id: 'ai',
          name: '人工智能',
          domains: [],
          tabs: [],
          children: [
            {
              id: 'ai-llm-provider',
              name: 'LLM提供商',
              domains: [],
              tabs: [],
              children: [
                { id: 'ai-llm-zhipu', name: '智谱', domains: ['bigmodel.cn', 'chatglm.cn', 'zhipuai.cn'], tabs: [], children: [] },
                { id: 'ai-llm-openai', name: 'OpenAI', domains: ['openai.com', 'chatgpt.com', 'chat.openai.com'], tabs: [], children: [] },
                { id: 'ai-llm-anthropic', name: 'Anthropic', domains: ['anthropic.com', 'claude.ai'], tabs: [], children: [] },
                { id: 'ai-llm-google', name: 'Google AI', domains: ['gemini.google.com', 'ai.google', 'deepmind.com'], tabs: [], children: [] }
              ]
            },
            {
              id: 'ai-ml-platform',
              name: 'ML平台',
              domains: [],
              tabs: [],
              children: [
                { id: 'ai-kaggle', name: 'Kaggle', domains: ['kaggle.com'], tabs: [], children: [] },
                { id: 'ai-huggingface', name: 'Hugging Face', domains: ['huggingface.co', 'hf.co'], tabs: [], children: [] }
              ]
            },
            {
              id: 'ai-research',
              name: '研究资源',
              domains: ['arxiv.org', 'paperswithcode.com'],
              tabs: [],
              children: []
            }
          ]
        },
        {
          id: 'dev',
          name: '开发工具',
          domains: [],
          tabs: [],
          children: [
            { id: 'dev-coding', name: '编程平台', domains: ['github.com', 'gitlab.com', 'bitbucket.org'], tabs: [], children: [] },
            { id: 'dev-docs', name: '技术文档', domains: ['stackoverflow.com', 'stackexchange.com', 'dev.to'], tabs: [], children: [] }
          ]
        }
      ];

      data.categories.children = defaultCategories;
      await this.storage.saveAll(data);
      console.log('Default categories created');
      
      // 重新加载规则
      this.buildRulesFromCategories(data.categories);
    }
  }
}

// 启动服务
new BackgroundService();
