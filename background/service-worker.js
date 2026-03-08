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
        children: [], // 空数组，无默认分类
        tabs: []
      },
      tabs: {},
      settings: {
        autoCategorize: false,
        showFavicons: true,
        apiKey: '',
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
      },
      cache: {},
      stats: {},
      version: '0.2.1',
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
      
      // 只初始化空数据，不创建任何默认分类
      if (!data.categories || data.categories.id !== 'root') {
        const defaultData = this.storage.getDefaultData();
        await this.storage.saveAll(defaultData);
        console.log('Empty data initialized (no default categories)');
      }
    });

    // 监听消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'classifyWithAI':
          const result = await this.classifyTabWithAI(request.tab);
          sendResponse({ success: true, result });
          break;
          
        case 'classifyBatch':
          const results = await this.classifyBatch(request.tabs);
          sendResponse({ success: true, results });
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
          
        case 'clearCache':
          const cacheData = await this.storage.getAll();
          cacheData.cache = {};
          await this.storage.saveAll(cacheData);
          sendResponse({ success: true });
          break;
          
        case 'clearAllData':
          await this.storage.saveAll(this.storage.getDefaultData());
          sendResponse({ success: true });
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
      console.log('Using cached classification for:', tab.url);
      return data.cache[cacheKey];
    }

    // 检查API配置
    if (!data.settings.apiKey) {
      throw new Error('请先在设置中配置 DeepSeek API Key');
    }

    // 调用DeepSeek API
    const classification = await this.callDeepSeekAPI(tab, data.settings);
    
    // 缓存结果
    data.cache[cacheKey] = classification;
    await this.storage.saveAll(data);

    return classification;
  }

  async classifyBatch(tabs) {
    const results = [];
    const data = await this.storage.getAll();
    
    if (!data.settings.apiKey) {
      throw new Error('请先在设置中配置 DeepSeek API Key');
    }
    
    for (const tab of tabs) {
      try {
        const classification = await this.classifyTabWithAI(tab);
        results.push({
          tabId: tab.id,
          success: true,
          classification
        });
      } catch (error) {
        results.push({
          tabId: tab.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  getCacheKey(tab) {
    // 使用简单hash代替btoa，支持中文
    const content = `${tab.url}|${tab.title}`;
    return this.simpleHash(content);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `cache_${Math.abs(hash)}`;
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
            content: `你是一个网页分类助手。用户会给你网页的标题和URL，你需要返回一个JSON格式的分类建议。

要求：
1. 格式：{"category": "分类路径", "confidence": 0.9}
2. 分类路径用 > 分隔，例如："人工智能 > LLM提供商 > 智谱"
3. 分类要有层次感，一般2-4层
4. 只返回JSON，不要其他解释
5. 确保JSON格式正确`
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
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content.trim();
    
    try {
      // 尝试解析JSON
      let classification = JSON.parse(content);
      
      return {
        category: classification.category || '未分类',
        confidence: classification.confidence || 0.5,
        timestamp: Date.now()
      };
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        try {
          const classification = JSON.parse(jsonMatch[0]);
          return {
            category: classification.category || '未分类',
            confidence: classification.confidence || 0.5,
            timestamp: Date.now()
          };
        } catch (e2) {
          throw new Error('AI返回格式错误，请重试');
        }
      }
      
      throw new Error('AI返回格式错误，请重试');
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
