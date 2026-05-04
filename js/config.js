// ============================================================
// 法简AI - 全局配置模块
// 从 env.js 读取配置，提供默认值与安全校验
// ============================================================

const Config = (function () {
  'use strict';

  const env = window.ENV || {};

  // ---------- DeepSeek ----------
  // 前端通过 Netlify Function 代理请求，密钥仅存储在服务端环境变量
  var DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
    || window.DEEPSEEK_API_KEY
    || '';
  var DEEPSEEK_API_URL = env.DEEPSEEK_API_URL
    || window.DEEPSEEK_API_URL
    || '/.netlify/functions/deepseek';
  var DEEPSEEK_MODEL   = env.DEEPSEEK_MODEL
    || window.DEEPSEEK_MODEL
    || 'deepseek-chat';

  // ---------- 通用 ----------
  const REQUEST_TIMEOUT = env.REQUEST_TIMEOUT || window.REQUEST_TIMEOUT || 10000;
  const MAX_DATA_DISPLAY = env.MAX_DATA_DISPLAY || window.MAX_DATA_DISPLAY || 20;

  // ---------- 系统提示词（极简版，确保10秒内响应） ----------
  const SYSTEM_PROMPT = `你是一位中国法律AI助手。请极简回复，严格150字以内：

【关键词】
仅输出3-5个核心法律关键词（案由/罪名/法条/法律关系），逗号分隔，不含解释文字。
示例：故意杀人罪,刑法第232条,主观故意,因果关系

【法律评析】
极简短法律分析，严格150字以内，禁止长篇大论。`;

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
