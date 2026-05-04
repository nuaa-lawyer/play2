// ============================================================
// 法简AI - 环境变量配置模板
// 复制此文件为 env.js 并填入你的真实密钥
// ============================================================

window.ENV = {
  // DeepSeek API 配置
  DEEPSEEK_API_KEY: 'your-deepseek-api-key-here',
  DEEPSEEK_API_URL: '/.netlify/functions/deepseek-proxy',
  DEEPSEEK_MODEL: 'deepseek-v4-pro',

  // 请求超时配置（毫秒）
  REQUEST_TIMEOUT: 115000,

  // 单类数据展示上限
  MAX_DATA_DISPLAY: 20
};
