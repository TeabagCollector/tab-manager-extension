/**
 * Service Worker - 后台服务
 * 处理标签事件和自动分类
 */

import { RulesEngine } from '../lib/rules.js';
import { StorageManager } from '../lib/storage.js';

class BackgroundService {
  constructor() {
    this.rules = new RulesEngine();
    this.storage = new StorageManager();
    
    this.init();
  }

  init() {
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
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Tab Manager installed');
      this.initDefaultCategories();
    });
  }

  /**
   * 处理标签创建
   */
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
    const domain = new URL(tab.url).hostname;
    await this.storage.updateStats(domain);
  }

  /**
   * 处理标签关闭
   */
  async handleTabRemoved(tabId) {
    await this.storage.removeTabMapping(tabId);
    console.log(`Tab ${tabId} removed from mapping`);
  }

  /**
   * 处理标签URL变化
   */
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

  /**
   * 初始化默认分类
   */
  async initDefaultCategories() {
    const data = await this.storage.getAll();
    
    // 如果是新安装，创建默认分类结构
    if (data.categories.children.length === 0) {
      const defaultCategories = [
        {
          id: 'ai',
          name: '人工智能',
          domains: [],
          children: [
            {
              id: 'ai-llm-provider',
              name: 'LLM提供商',
              domains: [],
              children: [
                { id: 'ai-llm-zhipu', name: '智谱', domains: ['bigmodel.cn', 'chatglm.cn'] },
                { id: 'ai-llm-openai', name: 'OpenAI', domains: ['openai.com', 'chatgpt.com'] },
                { id: 'ai-llm-anthropic', name: 'Anthropic', domains: ['anthropic.com', 'claude.ai'] },
                { id: 'ai-llm-google', name: 'Google AI', domains: ['gemini.google.com'] }
              ]
            },
            {
              id: 'ai-ml-platform',
              name: 'ML平台',
              domains: [],
              children: [
                { id: 'ai-kaggle', name: 'Kaggle', domains: ['kaggle.com'] },
                { id: 'ai-huggingface', name: 'Hugging Face', domains: ['huggingface.co'] }
              ]
            },
            {
              id: 'ai-research',
              name: '研究资源',
              domains: ['arxiv.org', 'paperswithcode.com']
            }
          ]
        },
        {
          id: 'dev',
          name: '开发工具',
          domains: [],
          children: [
            { id: 'dev-coding', name: '编程平台', domains: ['github.com', 'gitlab.com'] },
            { id: 'dev-docs', name: '技术文档', domains: ['stackoverflow.com'] }
          ]
        }
      ];

      data.categories.children = defaultCategories;
      await this.storage.saveAll(data);
      console.log('Default categories created');
    }
  }
}

// 启动服务
new BackgroundService();
