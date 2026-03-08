/**
 * 树形分类数据结构
 * 用于管理标签页的层级分类
 */

export class CategoryTree {
  constructor() {
    this.root = {
      id: 'root',
      name: '所有标签',
      children: [],
      tabs: []
    };
    this.nodeMap = new Map(); // 用于快速查找节点
    this.nodeMap.set('root', this.root);
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 查找节点
   */
  findNode(nodeId) {
    return this.nodeMap.get(nodeId);
  }

  /**
   * 添加分类
   * @param {string} parentId - 父节点ID
   * @param {Object} category - 分类信息
   */
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
      color: category.color || null,
      icon: category.icon || null,
      createdAt: Date.now()
    };

    parent.children.push(newNode);
    this.nodeMap.set(newNode.id, newNode);

    return newNode;
  }

  /**
   * 删除分类
   */
  removeCategory(nodeId) {
    const node = this.findNode(nodeId);
    if (!node || nodeId === 'root') {
      return false;
    }

    // 递归删除所有子节点
    const removeRecursive = (n) => {
      for (const child of n.children) {
        removeRecursive(child);
      }
      this.nodeMap.delete(n.id);
    };

    removeRecursive(node);

    // 从父节点中移除
    const findParent = (current, target) => {
      for (const child of current.children) {
        if (child.id === target.id) {
          return current;
        }
        const found = findParent(child, target);
        if (found) return found;
      }
      return null;
    };

    const parent = findParent(this.root, node);
    if (parent) {
      parent.children = parent.children.filter(c => c.id !== nodeId);
    }

    return true;
  }

  /**
   * 添加标签到分类
   */
  addTab(categoryId, tab) {
    const category = this.findNode(categoryId);
    if (!category) {
      return false;
    }

    // 检查标签是否已存在
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

  /**
   * 从分类移除标签
   */
  removeTab(categoryId, tabId) {
    const category = this.findNode(categoryId);
    if (!category) {
      return false;
    }

    const index = category.tabs.findIndex(t => t.id === tabId);
    if (index === -1) {
      return false;
    }

    category.tabs.splice(index, 1);
    return true;
  }

  /**
   * 移动分类到新的父节点
   */
  moveCategory(nodeId, newParentId) {
    if (nodeId === 'root' || newParentId === nodeId) {
      return false;
    }

    const node = this.findNode(nodeId);
    const newParent = this.findNode(newParentId);
    
    if (!node || !newParent) {
      return false;
    }

    // 检查是否会造成循环
    let current = newParent;
    while (current) {
      if (current.id === nodeId) {
        return false; // 会造成循环引用
      }
      current = this.findParent(current.id);
    }

    // 从旧父节点移除
    const oldParent = this.findParent(nodeId);
    if (oldParent) {
      oldParent.children = oldParent.children.filter(c => c.id !== nodeId);
    }

    // 添加到新父节点
    newParent.children.push(node);

    return true;
  }

  /**
   * 查找父节点
   */
  findParent(nodeId) {
    const findRecursive = (current, targetId) => {
      for (const child of current.children) {
        if (child.id === targetId) {
          return current;
        }
        const found = findRecursive(child, targetId);
        if (found) return found;
      }
      return null;
    };

    return findRecursive(this.root, nodeId);
  }

  /**
   * 根据域名查找匹配的分类
   */
  findCategoryByDomain(domain) {
    const findRecursive = (node) => {
      // 检查当前节点
      if (node.domains && node.domains.some(d => domain.includes(d))) {
        return node;
      }

      // 递归检查子节点
      for (const child of node.children) {
        const found = findRecursive(child);
        if (found) return found;
      }

      return null;
    };

    return findRecursive(this.root);
  }

  /**
   * 获取所有分类（扁平化列表）
   */
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

  /**
   * 获取树的深度
   */
  getDepth(nodeId = 'root') {
    const node = this.findNode(nodeId);
    if (!node || node.children.length === 0) {
      return 0;
    }

    return 1 + Math.max(...node.children.map(child => this.getDepth(child.id)));
  }

  /**
   * 导出为JSON
   */
  toJSON() {
    return JSON.stringify(this.root, null, 2);
  }

  /**
   * 从JSON导入
   */
  static fromJSON(json) {
    const tree = new CategoryTree();
    const data = JSON.parse(json);
    
    tree.root = data;
    tree.nodeMap.clear();
    tree.nodeMap.set('root', tree.root);

    // 重建nodeMap
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

export default CategoryTree;
