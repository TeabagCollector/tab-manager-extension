/**
 * Service Worker - 后台服务 v0.2.6
 * 修复：GLM5 模型 context_window_exceeded 错误处理
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
        autoCategorize: false,
        showFavicons: true,
        apiKey: '',
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
      },
      cache: {},
      stats: {},
      version: '0.2.6',
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
    chrome.runtime.onInstalled.addListener(async () => {
      console.log('Tab Manager installed');
      const data = await this.storage.getAll();
      
      if (!data.categories || data.categories.id !== 'root') {
        const defaultData = this.storage.getDefaultData();
        await this.storage.saveAll(defaultData);
        console.log('Empty data initialized');
      }
    });

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
    
    if (!data.cache) {
      data.cache = {};
    }
    
    const cacheKey = this.getCacheKey(tab);
    if (data.cache[cacheKey]) {
      console.log('Using cached classification for:', tab.url);
      return data.cache[cacheKey];
    }

    if (!data.settings || !data.settings.apiKey) {
      throw new Error('请先在设置中配置 API Key');
    }

    const classification = await this.callAPI(tab, data.settings);
    
    data.cache[cacheKey] = classification;
    await this.storage.saveAll(data);

    return classification;
  }

  async classifyBatch(tabs) {
    const results = [];
    const data = await this.storage.getAll();
    
    if (!data.settings || !data.settings.apiKey) {
      throw new Error('请先在设置中配置 API Key');
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
    const content = `${tab.url}|${tab.title}`;
    return this.simpleHash(content);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `cache_${Math.abs(hash)}`;
  }

  async callAPI(tab, settings) {
    const prompt = this.buildPrompt(tab);
    
    try {
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
              content: '你是网页分类助手。返回JSON格式: {"category":"分类路径","confidence":0.9}。分类用>分隔，如"科技>AI>大模型"。只返回JSON。'
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
        
        // 处理特定错误状态
        if (response.status === 400) {
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error?.code === 'context_length_exceeded' || 
                errorJson.error?.message?.includes('context')) {
              throw new Error('上下文过长，请尝试更短的标题或URL');
            }
          } catch (e) {
            if (e.message.includes('上下文过长')) {
              throw e;
            }
          }
        }
        
        throw new Error(`API请求失败 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      // 处理 GLM5 等模型的 stop_reason 错误
      if (result.choices && result.choices[0]) {
        const choice = result.choices[0];
        
        // 检查 stop_reason
        if (choice.finish_reason === 'model_context_window_exceeded' ||
            choice.finish_reason === 'length' ||
            choice.stop_reason === 'model_context_window_exceeded') {
          console.warn('Model context window exceeded, using fallback');
          
          // 返回一个默认分类而不是抛出错误
          return {
            category: '其他',
            confidence: 0.3,
            timestamp: Date.now(),
            note: '上下文超限，已使用默认分类'
          };
        }
        
        const content = choice.message?.content || choice.text || '';
        
        if (!content) {
          throw new Error('API返回内容为空');
        }
        
        return this.parseClassification(content.trim());
      }
      
      throw new Error('API返回格式异常');

    } catch (error) {
      // 处理网络错误或其他异常
      if (error.message.includes('上下文过长') || 
          error.message.includes('context') ||
          error.message.includes('model_context_window_exceeded')) {
        // 返回默认分类而不是完全失败
        return {
          category: this.fallbackClassify(tab),
          confidence: 0.5,
          timestamp: Date.now(),
          note: '使用规则分类'
        };
      }
      
      throw error;
    }
  }

  parseClassification(content) {
    try {
      let classification = JSON.parse(content);
      
      return {
        category: classification.category || '未分类',
        confidence: classification.confidence || 0.5,
        timestamp: Date.now()
      };
    } catch (e) {
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
          // 解析失败，使用基于URL的简单分类
          return {
            category: '未分类',
            confidence: 0.3,
            timestamp: Date.now()
          };
        }
      }
      
      throw new Error('AI返回格式错误，请重试');
    }
  }

  // 备用分类逻辑（基于URL规则）
  fallbackClassify(tab) {
    const url = tab.url.toLowerCase();
    const title = (tab.title || '').toLowerCase();
    
    // 简单的规则分类
    if (url.includes('github.com')) return '开发 > GitHub';
    if (url.includes('stackoverflow.com')) return '开发 > 技术问答';
    if (url.includes('youtube.com') || url.includes('bilibili.com')) return '视频 > 流媒体';
    if (url.includes('twitter.com') || url.includes('weibo.com')) return '社交媒体';
    if (url.includes('reddit.com') || url.includes('zhihu.com')) return '社区 > 问答';
    if (url.includes('news') || title.includes('新闻')) return '资讯 > 新闻';
    if (url.includes('docs.') || url.includes('documentation')) return '文档 > 技术文档';
    
    return '其他';
  }

  buildPrompt(tab) {
    // 限制标题长度，避免上下文过长
    let title = tab.title || '';
    let url = tab.url || '';
    
    // 截断过长的标题和URL
    if (title.length > 100) {
      title = title.substring(0, 100) + '...';
    }
    if (url.length > 200) {
      url = url.substring(0, 200) + '...';
    }
    
    return `分类: ${title}\nURL: ${url}`;
  }
}

new BackgroundService();
