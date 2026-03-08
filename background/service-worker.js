/**
 * Service Worker - 后台服务
 * 轻量化版本，不预置分类
 */

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
        autoCategorize: false, // 默认关闭自动分类
        showFavicons: true,
        apiKey: '', // DeepSeek API Key
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
      },
      cache: {}, // 分类缓存
      stats: {},
      version: '0.2.0',
      createdAt: Date.now()
    };
  }
}

class BackgroundService {
  constructor() {
    this.storage = new StorageManager();
    this.init();
  }

  async init() {
    // 监听扩展安装
    chrome.runtime.onInstalled.addListener(async () => {
      console.log('Tab Manager installed');
      const data = await this.storage.getAll();
      if (!data.categories || data.categories.id !== 'root') {
        await this.storage.saveAll(this.storage.getDefaultData());
        console.log('Default data initialized');
      }
    });

    // 监听消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开启
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'classifyWithAI':
          const result = await this.classifyTabWithAI(request.tab);
          sendResponse({ success: true, result });
          break;
          
        case 'updateSettings':
          const data = await this.storage.getAll();
          data.settings = { ...data.settings, ...request.settings };
          await this.storage.saveAll(data);
          sendResponse({ success: true });
          break;
          
        case 'getSettings':
          const settings = await this.storage.getAll();
          sendResponse({ success: true, settings: settings.settings });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async classifyTabWithAI(tab) {
    const data = await this.storage.getAll();
    
    // 检查缓存
    const cacheKey = this.getCacheKey(tab);
    if (data.cache[cacheKey]) {
      console.log('Using cached classification');
      return data.cache[cacheKey];
    }

    // 检查API配置
    if (!data.settings.apiKey) {
      throw new Error('请先配置 DeepSeek API Key');
    }

    // 调用DeepSeek API
    const classification = await this.callDeepSeekAPI(tab, data.settings);
    
    // 缓存结果
    data.cache[cacheKey] = classification;
    await this.storage.saveAll(data);

    return classification;
  }

  getCacheKey(tab) {
    // 使用 URL + title 的组合作为缓存key
    const content = `${tab.url}|${tab.title}`;
    return btoa(content).substring(0, 32);
  }

  async callDeepSeekAPI(tab, settings) {
    const prompt = this.buildPrompt(tab);
    
    const response = await fetch(settings.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: '你是一个网页分类助手。用户会给你网页的标题和URL，你需要返回一个JSON格式的分类建议。格式：{"category": "分类路径", "confidence": 0.9}。分类路径用 > 分隔，例如："人工智能 > LLM提供商 > 智谱"。只返回JSON，不要其他解释。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    try {
      const classification = JSON.parse(content);
      return {
        category: classification.category,
        confidence: classification.confidence || 0.5,
        timestamp: Date.now()
      };
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI返回格式错误');
    }
  }

  buildPrompt(tab) {
    return `请对以下网页进行分类：

标题：${tab.title}
URL：${tab.url}

请返回JSON格式的分类建议。`;
  }
}

// 启动服务
new BackgroundService();
