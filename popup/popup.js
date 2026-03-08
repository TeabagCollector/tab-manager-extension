/**
 * Popup 主逻辑 - 智能分类版本 v0.2.4
 * 新增：手动调整标签分类功能
 */

// ========== 工具类 ==========

class CategoryTree {
  constructor() {
    this.root = {
      id: 'root',
      name: '所有标签',
      children: [],
      tabs: []
    };
    this.nodeMap = new Map();
    this.nodeMap.set('root', this.root);
  }

  generateId() {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  findNode(nodeId) {
    return this.nodeMap.get(nodeId);
  }

  addCategory(parentId, category) {
    const parent = this.findNode(parentId);
    if (!parent) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    const newNode = {
      id: this.generateId(),
      name: category.name,
      domains: category.domains || [],
      tabs: [],
      children: [],
      createdAt: Date.now()
    };

    parent.children.push(newNode);
    this.nodeMap.set(newNode.id, newNode);

    return newNode;
  }

  createCategoryPath(pathStr) {
    const parts = pathStr.split('>').map(p => p.trim()).filter(p => p);
    let currentId = 'root';
    
    for (const part of parts) {
      const parent = this.findNode(currentId);
      let found = parent.children.find(c => c.name === part);
      
      if (!found) {
        found = this.addCategory(currentId, { name: part });
      }
      
      currentId = found.id;
    }
    
    return currentId;
  }

  addTab(categoryId, tab) {
    const category = this.findNode(categoryId);
    if (!category) {
      return false;
    }

    this.removeTabFromAll(tab.id);

    const exists = category.tabs.some(t => t.id === tab.id);
    if (exists) {
      return false;
    }

    category.tabs.push({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl || null,
      addedAt: Date.now()
    });

    return true;
  }

  moveTabToCategory(tabId, targetCategoryId) {
    const targetCategory = this.findNode(targetCategoryId);
    if (!targetCategory) {
      return false;
    }

    // 查找标签当前所在位置
    let tabData = null;
    const findTab = (node) => {
      const index = node.tabs.findIndex(t => t.id === tabId);
      if (index !== -1) {
        tabData = node.tabs[index];
        node.tabs.splice(index, 1);
        return true;
      }
      if (node.children) {
        return node.children.some(child => findTab(child));
      }
      return false;
    };

    findTab(this.root);

    if (!tabData) {
      return false;
    }

    // 添加到目标分类
    targetCategory.tabs.push(tabData);
    return true;
  }

  removeTabFromAll(tabId) {
    const removeRecursive = (node) => {
      const index = node.tabs.findIndex(t => t.id === tabId);
      if (index !== -1) {
        node.tabs.splice(index, 1);
      }
      if (node.children) {
        node.children.forEach(child => removeRecursive(child));
      }
    };
    removeRecursive(this.root);
  }

  getAllCategories() {
    const categories = [];
    
    const traverse = (node, level = 0) => {
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          traverse(child, level + 1);
        }
      }
      
      if (node.id !== 'root' && node.tabs && node.tabs.length > 0) {
        categories.push({
          ...node,
          level
        });
      }
    };

    traverse(this.root);
    return categories;
  }

  // 获取所有分类（包括空的，用于移动对话框）
  getAllCategoriesForMove() {
    const categories = [];
    
    const traverse = (node, level = 0, parentPath = []) => {
      if (node.id !== 'root') {
        categories.push({
          id: node.id,
          name: node.name,
          level,
          path: [...parentPath, node.name].join(' > ')
        });
      }
      
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          traverse(child, level + 1, node.id === 'root' ? [] : [...parentPath, node.name]);
        }
      }
    };

    traverse(this.root);
    return categories;
  }

  static fromJSON(json) {
    const tree = new CategoryTree();
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    
    tree.root = data;
    tree.nodeMap.clear();
    tree.nodeMap.set('root', tree.root);

    const buildMap = (node) => {
      tree.nodeMap.set(node.id, node);
      for (const child of node.children || []) {
        buildMap(child);
      }
    };
    buildMap(tree.root);

    return tree;
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
      version: '0.2.4',
      createdAt: Date.now()
    };
  }
}

// ========== 主逻辑类 ==========

class TabManager {
  constructor() {
    this.tree = null;
    this.storage = new StorageManager();
    
    this.init();
  }

  async init() {
    await this.loadData();
    await this.syncCurrentTabs();
    this.render();
    this.bindEvents();
  }

  async loadData() {
    try {
      const data = await this.storage.getAll();
      
      if (data.categories && data.categories.id === 'root') {
        this.tree = CategoryTree.fromJSON(data.categories);
      } else {
        this.tree = new CategoryTree();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      this.tree = new CategoryTree();
    }
  }

  async syncCurrentTabs() {
    try {
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const currentTabIds = new Set(currentTabs.map(t => t.id));
      
      const removeClosedTabs = (node) => {
        if (node.tabs && node.tabs.length > 0) {
          node.tabs = node.tabs.filter(tab => currentTabIds.has(tab.id));
        }
        if (node.children) {
          node.children.forEach(child => removeClosedTabs(child));
        }
      };
      
      removeClosedTabs(this.tree.root);
      
      const updateTabInfo = (node) => {
        if (node.tabs && node.tabs.length > 0) {
          node.tabs.forEach(savedTab => {
            const currentTab = currentTabs.find(t => t.id === savedTab.id);
            if (currentTab) {
              savedTab.url = currentTab.url;
              savedTab.title = currentTab.title;
              savedTab.favIconUrl = currentTab.favIconUrl || null;
            }
          });
        }
        if (node.children) {
          node.children.forEach(child => updateTabInfo(child));
        }
      };
      
      updateTabInfo(this.tree.root);
    } catch (error) {
      console.error('Failed to sync tabs:', error);
    }
  }

  render() {
    this.renderTree();
    this.renderUncategorized();
  }

  renderTree() {
    const container = document.getElementById('tree-container');
    const categories = this.tree.getAllCategories();

    if (categories.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <div>暂无分类</div>
          <div style="font-size: 12px; margin-top: 4px;">点击未分类标签右侧的 🤖 进行智能分类</div>
          <div style="font-size: 12px; margin-top: 4px;">或点击顶部的 🤖 一键分类所有标签</div>
        </div>
      `;
      return;
    }

    container.innerHTML = categories.map(cat => {
      if (!cat.tabs || cat.tabs.length === 0) {
        return '';
      }

      const tabItems = cat.tabs.map(tab => `
        <div class="tab-item" data-tab-id="${tab.id}" title="${this.escapeHtml(tab.url)}">
          <img class="tab-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'">
          <span class="tab-title">${this.escapeHtml(tab.title || tab.url)}</span>
          <button class="btn-move" data-tab-id="${tab.id}" title="移动到其他分类">📁</button>
          <span class="tab-close" data-tab-id="${tab.id}">×</span>
        </div>
      `).join('');

      return `
        <div class="category" data-id="${cat.id}">
          <div class="category-header">
            <span class="category-toggle">▼</span>
            <span class="category-name">${this.escapeHtml(cat.name)}</span>
            <span class="tab-count">${cat.tabs.length}</span>
          </div>
          <div class="tabs-list">
            ${tabItems}
          </div>
        </div>
      `;
    }).join('');
  }

  async renderUncategorized() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const container = document.getElementById('uncategorized-tabs');
      const countEl = document.getElementById('uncategorized-count');

      const categorizedTabIds = new Set();
      const collectTabs = (node) => {
        if (node.tabs) {
          node.tabs.forEach(tab => categorizedTabIds.add(tab.id));
        }
        if (node.children) {
          node.children.forEach(child => collectTabs(child));
        }
      };
      collectTabs(this.tree.root);

      const uncategorizedTabs = tabs.filter(tab => {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return false;
        }
        return !categorizedTabIds.has(tab.id);
      });

      countEl.textContent = uncategorizedTabs.length;

      if (uncategorizedTabs.length === 0) {
        container.innerHTML = '<div style="padding: 8px; color: #999; font-size: 12px;">所有标签已分类 ✅</div>';
      } else {
        container.innerHTML = uncategorizedTabs.map(tab => `
          <div class="tab-item" data-tab-id="${tab.id}" title="${this.escapeHtml(tab.url)}">
            <img class="tab-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'">
            <span class="tab-title">${this.escapeHtml(tab.title || tab.url)}</span>
            <button class="btn-classify" data-tab-id="${tab.id}" data-tab-url="${this.escapeHtml(tab.url)}" data-tab-title="${this.escapeHtml(tab.title)}">🤖</button>
            <button class="btn-move" data-tab-id="${tab.id}" title="移动到其他分类">📁</button>
            <span class="tab-close" data-tab-id="${tab.id}">×</span>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Failed to render uncategorized tabs:', error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  bindEvents() {
    // 一键分类按钮
    document.getElementById('btn-classify-all').addEventListener('click', () => {
      this.classifyAllTabs();
    });

    // 设置按钮
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.showSettingsDialog();
    });

    // 新建分类按钮
    document.getElementById('btn-add-category').addEventListener('click', () => {
      this.showAddCategoryDialog();
    });

    // 分类折叠
    document.getElementById('tree-container').addEventListener('click', (e) => {
      const header = e.target.closest('.category-header');
      if (header && !e.target.classList.contains('tab-close') && !e.target.classList.contains('btn-move')) {
        const category = header.closest('.category');
        category.classList.toggle('collapsed');
      }
    });

    // 已分类标签点击跳转
    document.getElementById('tree-container').addEventListener('click', async (e) => {
      const tabItem = e.target.closest('.tab-item');
      if (tabItem && !e.target.classList.contains('tab-close') && !e.target.classList.contains('btn-move')) {
        const tabId = parseInt(tabItem.dataset.tabId);
        try {
          await chrome.tabs.update(tabId, { active: true });
          window.close();
        } catch (error) {
          console.error('Failed to activate tab:', error);
        }
      }
    });

    // 未分类标签点击跳转
    document.getElementById('uncategorized-tabs').addEventListener('click', async (e) => {
      const tabItem = e.target.closest('.tab-item');
      if (tabItem && !e.target.classList.contains('tab-close') && !e.target.classList.contains('btn-classify') && !e.target.classList.contains('btn-move')) {
        const tabId = parseInt(tabItem.dataset.tabId);
        try {
          await chrome.tabs.update(tabId, { active: true });
          window.close();
        } catch (error) {
          console.error('Failed to activate tab:', error);
        }
      }
    });

    // 移动标签按钮（关键新增）
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-move')) {
        e.stopPropagation();
        const tabId = parseInt(e.target.dataset.tabId);
        await this.showMoveDialog(tabId);
      }
    });

    // 智能分类按钮
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-classify')) {
        e.stopPropagation();
        const tabId = parseInt(e.target.dataset.tabId);
        const tabUrl = e.target.dataset.tabUrl;
        const tabTitle = e.target.dataset.tabTitle;
        
        await this.classifyTab(tabId, tabUrl, tabTitle);
      }
    });

    // 标签关闭
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('tab-close')) {
        e.stopPropagation();
        const tabId = parseInt(e.target.dataset.tabId);
        try {
          await chrome.tabs.remove(tabId);
          await this.syncCurrentTabs();
          this.render();
        } catch (error) {
          console.error('Failed to close tab:', error);
        }
      }
    });

    // 搜索
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.filterTabs(e.target.value);
    });

    // 新建分类表单
    document.getElementById('form-add-category').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addCategory();
    });

    document.getElementById('btn-cancel-category').addEventListener('click', () => {
      document.getElementById('dialog-add-category').close();
    });

    // 设置表单
    document.getElementById('form-settings').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveSettings();
    });

    document.getElementById('btn-cancel-settings').addEventListener('click', () => {
      document.getElementById('dialog-settings').close();
    });

    // 清空数据按钮
    document.getElementById('btn-clear-data').addEventListener('click', async () => {
      if (confirm('确定要清空所有数据吗？这将删除所有分类和缓存。')) {
        await chrome.runtime.sendMessage({ action: 'clearAllData' });
        await this.loadData();
        this.render();
        alert('数据已清空');
      }
    });

    // 移动对话框表单
    document.getElementById('form-move').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.moveTab();
    });

    document.getElementById('btn-cancel-move').addEventListener('click', () => {
      document.getElementById('dialog-move').close();
    });
  }

  // 新增：显示移动对话框
  async showMoveDialog(tabId) {
    const dialog = document.getElementById('dialog-move');
    const select = document.getElementById('move-target-category');
    const tabIdInput = document.getElementById('move-tab-id');
    
    // 保存当前标签ID
    tabIdInput.value = tabId;
    
    // 获取所有分类（包括空的）
    const categories = this.tree.getAllCategoriesForMove();
    
    // 填充分类选项
    select.innerHTML = `
      <option value="">-- 选择目标分类 --</option>
      ${categories.map(cat => `
        <option value="${cat.id}">${'  '.repeat(cat.level)}${cat.name}</option>
      `).join('')}
    `;
    
    // 清空新分类输入
    document.getElementById('move-new-category').value = '';
    
    dialog.showModal();
  }

  // 新增：移动标签
  async moveTab() {
    const tabId = parseInt(document.getElementById('move-tab-id').value);
    const targetCategoryId = document.getElementById('move-target-category').value;
    const newCategoryPath = document.getElementById('move-new-category').value.trim();
    
    try {
      let categoryId = null;
      
      if (newCategoryPath) {
        // 创建新分类路径
        categoryId = this.tree.createCategoryPath(newCategoryPath);
      } else if (targetCategoryId) {
        // 使用已有分类
        categoryId = targetCategoryId;
      } else {
        alert('请选择目标分类或输入新分类路径');
        return;
      }
      
      // 获取标签信息
      const tab = await chrome.tabs.get(tabId);
      
      // 移动标签
      const success = this.tree.moveTabToCategory(tabId, categoryId);
      
      if (success) {
        await this.saveData();
        this.render();
        document.getElementById('dialog-move').close();
        console.log(`Tab ${tabId} moved to category ${categoryId}`);
      } else {
        alert('移动失败，标签不存在');
      }
    } catch (error) {
      console.error('Failed to move tab:', error);
      alert('移动失败: ' + error.message);
    }
  }

  async classifyTab(tabId, tabUrl, tabTitle) {
    const btn = document.querySelector(`.btn-classify[data-tab-id="${tabId}"]`);
    const originalText = btn.textContent;
    
    try {
      btn.textContent = '⏳';
      btn.disabled = true;

      const response = await chrome.runtime.sendMessage({
        action: 'classifyWithAI',
        tab: { id: tabId, url: tabUrl, title: tabTitle }
      });

      if (response.success) {
        const classification = response.result;
        const categoryId = this.tree.createCategoryPath(classification.category);
        
        const tab = await chrome.tabs.get(tabId);
        this.tree.addTab(categoryId, tab);
        
        await this.saveData();
        this.render();
        
        console.log(`Tab classified to: ${classification.category}`);
      } else {
        alert('分类失败: ' + response.error);
      }
    } catch (error) {
      console.error('Classification failed:', error);
      alert('分类失败: ' + error.message);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  async classifyAllTabs() {
    const btn = document.getElementById('btn-classify-all');
    const originalText = btn.textContent;
    
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const categorizedTabIds = new Set();
      
      const collectTabs = (node) => {
        if (node.tabs) {
          node.tabs.forEach(tab => categorizedTabIds.add(tab.id));
        }
        if (node.children) {
          node.children.forEach(child => collectTabs(child));
        }
      };
      collectTabs(this.tree.root);

      const uncategorizedTabs = tabs.filter(tab => {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return false;
        }
        return !categorizedTabIds.has(tab.id);
      });

      if (uncategorizedTabs.length === 0) {
        alert('没有需要分类的标签');
        return;
      }

      const confirmMsg = `即将分类 ${uncategorizedTabs.length} 个标签\n预计消耗API：约 ${(uncategorizedTabs.length * 0.014).toFixed(2)} 分\n\n确定继续吗？`;
      
      if (!confirm(confirmMsg)) {
        return;
      }

      btn.textContent = '⏳ 分类中...';
      btn.disabled = true;

      const results = await chrome.runtime.sendMessage({
        action: 'classifyBatch',
        tabs: uncategorizedTabs
      });

      if (results.success) {
        let successCount = 0;
        let failCount = 0;

        for (const result of results.results) {
          if (result.success) {
            const categoryId = this.tree.createCategoryPath(result.classification.category);
            const tab = uncategorizedTabs.find(t => t.id === result.tabId);
            if (tab) {
              this.tree.addTab(categoryId, tab);
              successCount++;
            }
          } else {
            console.error(`Failed to classify tab ${result.tabId}:`, result.error);
            failCount++;
          }
        }

        await this.saveData();
        this.render();

        alert(`批量分类完成！\n成功：${successCount} 个\n失败：${failCount} 个`);
      } else {
        alert('批量分类失败: ' + results.error);
      }
    } catch (error) {
      console.error('Batch classification failed:', error);
      alert('批量分类失败: ' + error.message);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  async showSettingsDialog() {
    const dialog = document.getElementById('dialog-settings');
    const data = await this.storage.getAll();
    
    document.getElementById('setting-api-key').value = data.settings.apiKey || '';
    document.getElementById('setting-api-endpoint').value = data.settings.apiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
    document.getElementById('setting-model').value = data.settings.model || 'deepseek-chat';
    
    dialog.showModal();
  }

  async saveSettings() {
    const apiKey = document.getElementById('setting-api-key').value.trim();
    const apiEndpoint = document.getElementById('setting-api-endpoint').value.trim();
    const model = document.getElementById('setting-model').value.trim();
    
    const data = await this.storage.getAll();
    data.settings = {
      ...data.settings,
      apiKey,
      apiEndpoint,
      model
    };
    
    await this.storage.saveAll(data);
    
    document.getElementById('dialog-settings').close();
    alert('设置已保存');
  }

  showAddCategoryDialog() {
    const dialog = document.getElementById('dialog-add-category');
    const select = document.getElementById('category-parent');
    
    const categories = this.tree.getAllCategories();
    select.innerHTML = `
      <option value="root">根目录</option>
      ${categories.map(cat => `
        <option value="${cat.id}">${'  '.repeat(cat.level)}${cat.name}</option>
      `).join('')}
    `;

    document.getElementById('category-name').value = '';
    document.getElementById('category-domains').value = '';

    dialog.showModal();
  }

  async addCategory() {
    const name = document.getElementById('category-name').value.trim();
    const parentId = document.getElementById('category-parent').value;
    const domainsStr = document.getElementById('category-domains').value.trim();

    if (!name) {
      alert('请输入分类名称');
      return;
    }

    const domains = domainsStr
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    try {
      this.tree.addCategory(parentId, { name, domains });
      await this.saveData();
      this.render();
      document.getElementById('dialog-add-category').close();
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('添加分类失败: ' + error.message);
    }
  }

  filterTabs(query) {
    const items = document.querySelectorAll('.tab-item, .category');
    
    if (!query) {
      items.forEach(item => item.style.display = '');
      return;
    }

    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
  }

  async saveData() {
    try {
      const data = await this.storage.getAll();
      data.categories = this.tree.root;
      data.updatedAt = Date.now();
      await this.storage.saveAll(data);
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    }
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  new TabManager();
});
