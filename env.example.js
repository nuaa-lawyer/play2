// ============================================================
// 法简AI - 环境变量配置模板
// 复制此文件为 env.js 并填入你的真实密钥
// API 请求通过 Netlify Function 代理，密钥不暴露到前端
// ============================================================

window.ENV = {
  // DeepSeek API 配置（通过 Netlify Function 代理）
  DEEPSEEK_API_KEY: 'your-deepseek-api-key-here',
  DEEPSEEK_API_URL: '/.netlify/functions/deepseek',
  DEEPSEEK_MODEL: 'deepseek-chat',

  // 请求超时配置（毫秒）- 10秒免费版适配
  REQUEST_TIMEOUT: 10000,

  // 单类数据展示上限
  MAX_DATA_DISPLAY: 20
};
