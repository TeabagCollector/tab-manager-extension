/**
 * Popup 主逻辑
 */

import { CategoryTree } from '../lib/tree.js';
import { StorageManager } from '../lib/storage.js';
import { RulesEngine } from '../lib/rules.js';

class TabManager {
  constructor() {
    this.tree = new CategoryTree();
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
      const treeData = await this.storage.getTree();
      if (treeData && treeData.id === 'root') {
        this.tree = CategoryTree.fromJSON(JSON.stringify(treeData));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }

    // 加载当前标签
    await this.loadCurrentTabs();
  }

  /**
   * 加载当前打开的标签
   */
  async loadCurrentTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    for (const tab of tabs) {
      // 尝试自动分类
      if (!tab.url.startsWith('chrome://')) {
        const match = this.rules.match(tab.url);
        if (match) {
          this.tree.addTab(match.categoryId, tab);
        }
      }
    }
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

    container.innerHTML = categories.map(cat => `
      <div class="category" data-id="${cat.id}">
        <div class="category-header">
          <span class="category-toggle">▼</span>
          <span class="category-name">${cat.name}</span>
          <span class="tab-count">${cat.tabs.length}</span>
        </div>
        <div class="tabs-list">
          ${cat.tabs.map(tab => `
            <div class="tab-item" data-tab-id="${tab.id}">
              <img class="tab-favicon" src="${tab.favIconUrl || 'icons/default-favicon.png'}" alt="">
              <span class="tab-title">${tab.title}</span>
              <span class="tab-close" data-tab-id="${tab.id}">×</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * 渲染未分类标签
   */
  async renderUncategorized() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const container = document.getElementById('uncategorized-tabs');
    const countEl = document.getElementById('uncategorized-count');

    const uncategorizedTabs = tabs.filter(tab => {
      if (tab.url.startsWith('chrome://')) return false;
      return !this.rules.match(tab.url);
    });

    countEl.textContent = uncategorizedTabs.length;

    container.innerHTML = uncategorizedTabs.map(tab => `
      <div class="tab-item" data-tab-id="${tab.id}">
        <img class="tab-favicon" src="${tab.favIconUrl || 'icons/default-favicon.png'}" alt="">
        <span class="tab-title">${tab.title}</span>
        <span class="tab-close" data-tab-id="${tab.id}">×</span>
      </div>
    `).join('');
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
      if (header) {
        const category = header.closest('.category');
        category.classList.toggle('collapsed');
      }
    });

    // 标签点击
    document.getElementById('tree-container').addEventListener('click', async (e) => {
      const tabItem = e.target.closest('.tab-item');
      if (tabItem && !e.target.classList.contains('tab-close')) {
        const tabId = parseInt(tabItem.dataset.tabId);
        await chrome.tabs.update(tabId, { active: true });
        window.close();
      }
    });

    // 标签关闭
    document.querySelectorAll('.tab-close').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tabId = parseInt(e.target.dataset.tabId);
        await chrome.tabs.remove(tabId);
        await this.render();
      });
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

    dialog.showModal();
  }

  /**
   * 添加分类
   */
  async addCategory() {
    const name = document.getElementById('category-name').value;
    const parentId = document.getElementById('category-parent').value;
    const domainsStr = document.getElementById('category-domains').value;

    const domains = domainsStr
      .split(',')
      .map(d => d.trim())
      .filter(d => d);

    this.tree.addCategory(parentId, {
      name,
      domains
    });

    await this.saveData();
    this.render();

    document.getElementById('dialog-add-category').close();
    document.getElementById('form-add-category').reset();
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
    await this.storage.saveTree(this.tree.root);
  }
}

// 启动
new TabManager();
