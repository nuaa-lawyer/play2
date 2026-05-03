// ============================================================
// 法简AI - 全局配置模块
// 从 env.js 读取配置，提供默认值与安全校验
// ============================================================

const Config = (function () {
  'use strict';

  const env = window.ENV || {};

  // ---------- DeepSeek ----------
  // 统一密钥来源（优先级：window.ENV > window 全局直接注入 > 空）
  var DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
    || window.DEEPSEEK_API_KEY
    || '';
  var DEEPSEEK_API_URL = env.DEEPSEEK_API_URL
    || window.DEEPSEEK_API_URL
    || '/api/deepseek/v1/chat/completions';
  var DEEPSEEK_MODEL   = env.DEEPSEEK_MODEL
    || window.DEEPSEEK_MODEL
    || 'deepseek-v4-pro';

  // 若密钥为空，输出警告便于排查
  if (!DEEPSEEK_API_KEY) {
    console.warn('[Config] DeepSeek API Key 未配置，请检查 env.js 或 Netlify 环境变量 DEEPSEEK_API_KEY');
  }

  // ---------- 通用 ----------
  const REQUEST_TIMEOUT = env.REQUEST_TIMEOUT || window.REQUEST_TIMEOUT || 30000;
  const MAX_DATA_DISPLAY = env.MAX_DATA_DISPLAY || window.MAX_DATA_DISPLAY || 20;

  // ---------- 系统提示词（内置不可篡改） ----------
  const SYSTEM_PROMPT = `你是一位资深中国法律专家AI，专注于案情分析与法律研究。

请对用户提供的案情进行深度法律分析，严格按照以下结构输出：

【案件事实重梳】
客观提炼案件核心事实，时间线梳理，当事人行为归纳。

【法律争议焦点】
提炼案件中的核心法律争议问题，逐一列明。

【行为法律定性】
对涉案行为进行法律性质认定，明确适用的法律规范。

【构成要件分析】
逐项分析涉案行为是否满足相关法律构成要件。

【完整法律评析】
综合前述分析，给出完整法律意见与实务裁判逻辑推演。

【关键词】
仅输出逗号分隔的纯文本法律关键词，用于数据库检索。关键词仅包含：案由、罪名、法律关系、行为特征，不含任何解释性文字。
格式示例：故意杀人罪,刑法第232条,因果关系,主观故意,量刑情节`;

  // ---------- 案件大类兜底关键词 ----------
  const FALLBACK_KEYWORDS = {
    '刑法':   '刑法总则,犯罪构成,刑事责任,刑罚种类',
    '民法':   '民法典总则,民事权利,合同履行,侵权责任',
    '行政法': '行政处罚,行政许可,行政强制,行政复议'
  };

  // ---------- 公开API（只读暴露，防止篡改） ----------
  return Object.freeze({
    getDeepSeekApiKey:   () => DEEPSEEK_API_KEY,
    getDeepSeekApiUrl:   () => DEEPSEEK_API_URL,
    getDeepSeekModel:    () => DEEPSEEK_MODEL,
    getRequestTimeout:   () => REQUEST_TIMEOUT,
    getMaxDataDisplay:   () => MAX_DATA_DISPLAY,
    getSystemPrompt:     () => SYSTEM_PROMPT,
    getFallbackKeywords: (category) => FALLBACK_KEYWORDS[category] || FALLBACK_KEYWORDS['民法']
  });
})();
