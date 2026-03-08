/**
 * 存储管理模块
 * 封装chrome.storage API
 */

export class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'tabManager';
  }

  /**
   * 获取所有数据
   */
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.STORAGE_KEY, (result) => {
        resolve(result[this.STORAGE_KEY] || this.getDefaultData());
      });
    });
  }

  /**
   * 保存所有数据
   */
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

  /**
   * 获取分类树
   */
  async getTree() {
    const data = await this.getAll();
    return data.categories;
  }

  /**
   * 保存分类树
   */
  async saveTree(treeData) {
    const data = await this.getAll();
    data.categories = treeData;
    await this.saveAll(data);
  }

  /**
   * 获取设置
   */
  async getSettings() {
    const data = await this.getAll();
    return data.settings;
  }

  /**
   * 保存设置
   */
  async saveSettings(settings) {
    const data = await this.getAll();
    data.settings = { ...data.settings, ...settings };
    await this.saveAll(data);
  }

  /**
   * 获取统计数据
   */
  async getStats() {
    const data = await this.getAll();
    return data.stats;
  }

  /**
   * 更新统计数据
   */
  async updateStats(domain, visitData) {
    const data = await this.getAll();
    const current = data.stats[domain] || {
      visitCount: 0,
      lastVisit: null
    };

    data.stats[domain] = {
      visitCount: current.visitCount + 1,
      lastVisit: Date.now(),
      ...visitData
    };

    await this.saveAll(data);
  }

  /**
   * 获取标签映射
   */
  async getTabMappings() {
    const data = await this.getAll();
    return data.tabs;
  }

  /**
   * 保存标签映射
   */
  async saveTabMapping(tabId, categoryId) {
    const data = await this.getAll();
    data.tabs[tabId] = {
      categoryId,
      lastUpdate: Date.now()
    };
    await this.saveAll(data);
  }

  /**
   * 删除标签映射
   */
  async removeTabMapping(tabId) {
    const data = await this.getAll();
    delete data.tabs[tabId];
    await this.saveAll(data);
  }

  /**
   * 清空所有数据
   */
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.sync.remove(this.STORAGE_KEY, resolve);
    });
  }

  /**
   * 导出数据
   */
  async export() {
    const data = await this.getAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * 导入数据
   */
  async import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          await this.saveAll(data);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * 默认数据结构
   */
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
        showFavicons: true,
        maxRecentTabs: 50,
        compactView: false
      },
      stats: {},
      version: '0.1.0',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * 获取存储使用情况
   */
  async getUsage() {
    return new Promise((resolve) => {
      chrome.storage.sync.getBytesInUse(this.STORAGE_KEY, (bytesInUse) => {
        resolve({
          used: bytesInUse,
          total: chrome.storage.sync.QUOTA_BYTES,
          percentage: (bytesInUse / chrome.storage.sync.QUOTA_BYTES * 100).toFixed(2)
        });
      });
    });
  }
}

export default StorageManager;
