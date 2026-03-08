/**
 * 智能分类规则引擎
 */

export const defaultRules = [
  {
    id: 'rule-zhipu',
    name: '智谱AI',
    pattern: /bigmodel\.cn|chatglm\.cn|zhipuai\.cn/,
    categoryId: 'ai-llm-zhipu',
    priority: 1,
    enabled: true
  },
  {
    id: 'rule-openai',
    name: 'OpenAI',
    pattern: /openai\.com|chatgpt\.com/,
    categoryId: 'ai-llm-openai',
    priority: 1,
    enabled: true
  },
  {
    id: 'rule-anthropic',
    name: 'Anthropic',
    pattern: /anthropic\.com|claude\.ai/,
    categoryId: 'ai-llm-anthropic',
    priority: 1,
    enabled: true
  },
  {
    id: 'rule-google-ai',
    name: 'Google AI',
    pattern: /ai\.google|deepmind\.com|bard\.google\.com|gemini\.google\.com/,
    categoryId: 'ai-llm-google',
    priority: 1,
    enabled: true
  },
  {
    id: 'rule-kaggle',
    name: 'Kaggle',
    pattern: /kaggle\.com/,
    categoryId: 'ai-ml-platform',
    priority: 2,
    enabled: true
  },
  {
    id: 'rule-huggingface',
    name: 'Hugging Face',
    pattern: /huggingface\.co|huggingface\.in/,
    categoryId: 'ai-ml-platform',
    priority: 2,
    enabled: true
  },
  {
    id: 'rule-arxiv',
    name: 'arXiv',
    pattern: /arxiv\.org/,
    categoryId: 'ai-research',
    priority: 2,
    enabled: true
  },
  {
    id: 'rule-github',
    name: 'GitHub',
    pattern: /github\.com/,
    categoryId: 'dev-coding',
    priority: 3,
    enabled: true
  },
  {
    id: 'rule-stackoverflow',
    name: 'Stack Overflow',
    pattern: /stackoverflow\.com|stackexchange\.com/,
    categoryId: 'dev-coding',
    priority: 3,
    enabled: true
  }
];

export class RulesEngine {
  constructor(rules = defaultRules) {
    this.rules = rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 根据URL匹配分类
   */
  match(url) {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      
      if (rule.pattern.test(url)) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          categoryId: rule.categoryId,
          confidence: 1 / rule.priority // 优先级越高，置信度越高
        };
      }
    }
    
    return null;
  }

  /**
   * 批量匹配
   */
  matchBatch(urls) {
    return urls.map(url => ({
      url,
      match: this.match(url)
    }));
  }

  /**
   * 添加规则
   */
  addRule(rule) {
    this.rules.push({
      id: `rule-custom-${Date.now()}`,
      priority: 5,
      enabled: true,
      ...rule
    });
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 删除规则
   */
  removeRule(ruleId) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * 更新规则
   */
  updateRule(ruleId, updates) {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updates };
      this.rules.sort((a, b) => a.priority - b.priority);
    }
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleId, enabled) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 导出规则
   */
  export() {
    return JSON.stringify(this.rules, null, 2);
  }

  /**
   * 导入规则
   */
  static import(json) {
    const rules = JSON.parse(json);
    return new RulesEngine(rules);
  }
}

export default RulesEngine;
