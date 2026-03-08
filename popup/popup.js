/**
 * Popup 主逻辑
 */

class TabManager {
  constructor() {
    this.tree = null;
    this.storage = new StorageManager();
    this.rules = new RulesEngine();
    
    this.init();
  }

  /**
   * 初始化
   */
  async init() {
    await this.loadData();
    this.render();
    this.bindEvents();
  }

  /**
   * 加载数据
   */
  async loadData() {
    try {
      const data = await this.storage.getAll();
      
      // 初始化树
      if (data.categories && data.categories.id === 'root') {
        this.tree = CategoryTree.fromJSON(JSON.stringify(data.categories));
      } else {
        this.tree = new CategoryTree();
      }

      // 加载规则
      if (data.customRules) {
        data.customRules.forEach(rule => this.rules.addRule(rule));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      this.tree = new CategoryTree();
    }

    // 加载当前标签
    await this.loadCurrentTabs();
  }

  /**
   * 加载当前打开的标签
   */
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

  /**
   * 清空所有分类中的标签
   */
  clearAllTabs() {
    const clearRecursive = (node) => {
      node.tabs = [];
      if (node.children) {
        node.children.forEach(child => clearRecursive(child));
      }
    };
    clearRecursive(this.tree.root);
  }

  /**
   * 渲染UI
   */
  render() {
    this.renderTree();
    this.renderUncategorized();
  }

  /**
   * 渲染分类树
   */
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
            <div class="tab-item" data-tab-id="${tab.id}" title="${tab.url}">
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

  /**
   * 渲染未分类标签
   */
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
          <div class="tab-item" data-tab-id="${tab.id}" title="${tab.url}">
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

  /**
   * 转义HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 绑定事件
   */
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

  /**
   * 显示新建分类对话框
   */
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

  /**
   * 添加分类
   */
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

  /**
   * 过滤标签
   */
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

  /**
   * 保存数据
   */
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
