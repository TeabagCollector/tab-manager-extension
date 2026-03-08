/**
 * Popup 主逻辑
 * 所有依赖类内联在此文件中
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

  addTab(categoryId, tab) {
    const category = this.findNode(categoryId);
    if (!category) {
      return false;
    }

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

  getAllCategories() {
    const categories = [];
    
    const traverse = (node, level = 0) => {
      if (node.id !== 'root') {
        categories.push({
          ...node,
          level
        });
      }
      
      for (const child of node.children) {
        traverse(child, level + 1);
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
        autoCategorize: true,
        showFavicons: true
      },
      stats: {},
      version: '0.1.0',
      createdAt: Date.now()
    };
  }
}

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
      id: rule.id || `rule-${Date.now()}`,
      priority: rule.priority || 5,
      enabled: rule.enabled !== false,
      ...rule
    });
  }
}

// ========== 主逻辑类 ==========

class TabManager {
  constructor() {
    this.tree = null;
    this.storage = new StorageManager();
    this.rules = new RulesEngine();
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.render();
    this.bindEvents();
  }

  async loadData() {
    try {
      const data = await this.storage.getAll();
      
      // 初始化树
      if (data.categories && data.categories.id === 'root') {
        this.tree = CategoryTree.fromJSON(data.categories);
      } else {
        this.tree = new CategoryTree();
      }

      // 加载规则
      if (data.customRules) {
        data.customRules.forEach(rule => this.rules.addRule(rule));
      }
      
      // 从分类中提取规则
      this.buildRulesFromCategories(this.tree.root);
      
    } catch (error) {
      console.error('Failed to load data:', error);
      this.tree = new CategoryTree();
    }

    // 加载当前标签
    await this.loadCurrentTabs();
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

  async loadCurrentTabs() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const data = await this.storage.getAll();
      
      // 清空现有标签
      this.clearAllTabs();
      
      for (const tab of tabs) {
        // 跳过chrome内部页面
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          continue;
        }

        // 从存储中查找分类映射
        const mapping = data.tabs ? data.tabs[tab.id] : null;
        
        if (mapping && mapping.categoryId) {
          // 已有映射，直接添加
          this.tree.addTab(mapping.categoryId, tab);
        } else {
          // 尝试自动分类
          const match = this.rules.match(tab.url);
          if (match) {
            this.tree.addTab(match.categoryId, tab);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load current tabs:', error);
    }
  }

  clearAllTabs() {
    const clearRecursive = (node) => {
      node.tabs = [];
      if (node.children) {
        node.children.forEach(child => clearRecursive(child));
      }
    };
    clearRecursive(this.tree.root);
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
          <div style="font-size: 12px; margin-top: 4px;">点击右上角 ➕ 创建</div>
        </div>
      `;
      return;
    }

    container.innerHTML = categories.map(cat => {
      const tabItems = cat.tabs && cat.tabs.length > 0 
        ? cat.tabs.map(tab => `
            <div class="tab-item" data-tab-id="${tab.id}" title="${this.escapeHtml(tab.url)}">
              <img class="tab-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'">
              <span class="tab-title">${this.escapeHtml(tab.title || tab.url)}</span>
              <span class="tab-close" data-tab-id="${tab.id}">×</span>
            </div>
          `).join('')
        : '';

      return `
        <div class="category" data-id="${cat.id}">
          <div class="category-header">
            <span class="category-toggle">▼</span>
            <span class="category-name">${this.escapeHtml(cat.name)}</span>
            <span class="tab-count">${cat.tabs ? cat.tabs.length : 0}</span>
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

      // 找出未分类的标签
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
        container.innerHTML = '<div style="padding: 8px; color: #999; font-size: 12px;">所有标签已分类</div>';
      } else {
        container.innerHTML = uncategorizedTabs.map(tab => `
          <div class="tab-item" data-tab-id="${tab.id}" title="${this.escapeHtml(tab.url)}">
            <img class="tab-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ddd%22/></svg>'">
            <span class="tab-title">${this.escapeHtml(tab.title || tab.url)}</span>
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
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    // 新建分类按钮
    document.getElementById('btn-add-category').addEventListener('click', () => {
      this.showAddCategoryDialog();
    });

    // 分类折叠
    document.getElementById('tree-container').addEventListener('click', (e) => {
      const header = e.target.closest('.category-header');
      if (header && !e.target.classList.contains('tab-close')) {
        const category = header.closest('.category');
        category.classList.toggle('collapsed');
      }
    });

    // 标签点击
    document.getElementById('tree-container').addEventListener('click', async (e) => {
      const tabItem = e.target.closest('.tab-item');
      if (tabItem && !e.target.classList.contains('tab-close')) {
        const tabId = parseInt(tabItem.dataset.tabId);
        try {
          await chrome.tabs.update(tabId, { active: true });
          window.close();
        } catch (error) {
          console.error('Failed to activate tab:', error);
        }
      }
    });

    // 标签关闭
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('tab-close')) {
        e.stopPropagation();
        const tabId = parseInt(e.target.dataset.tabId);
        try {
          await chrome.tabs.remove(tabId);
          await this.loadCurrentTabs();
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
  }

  showAddCategoryDialog() {
    const dialog = document.getElementById('dialog-add-category');
    const select = document.getElementById('category-parent');
    
    // 填充父分类选项
    const categories = this.tree.getAllCategories();
    select.innerHTML = `
      <option value="root">根目录</option>
      ${categories.map(cat => `
        <option value="${cat.id}">${'  '.repeat(cat.level)}${cat.name}</option>
      `).join('')}
    `;

    // 清空表单
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
      // 添加到树
      const newNode = this.tree.addCategory(parentId, {
        name,
        domains
      });

      // 保存到存储
      await this.saveData();

      // 如果有域名，添加规则
      if (domains.length > 0) {
        const pattern = new RegExp(domains.join('|').replace(/\./g, '\\.'));
        this.rules.addRule({
          name: name,
          pattern: pattern,
          categoryId: newNode.id,
          priority: 1
        });
      }

      // 重新渲染
      this.render();

      // 关闭对话框
      document.getElementById('dialog-add-category').close();
      
      console.log(`Category "${name}" added under parent ${parentId}`);
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
