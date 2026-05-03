// ============================================================
// 法简AI - 环境变量配置模板
// 复制此文件为 env.js 并填入你的真实密钥
// ============================================================

window.ENV = {
  // DeepSeek API 配置
  DEEPSEEK_API_KEY: 'your-deepseek-api-key-here',
  DEEPSEEK_API_URL: '/api/deepseek/v1/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-v4-pro',

  // VIP 密钥白名单（人工手动添加，一行一个密钥）
  VIP_KEY_WHITELIST: [
    // 'example-vip-key-001',
    // 'example-vip-key-002'
  ],

  // 请求超时配置（毫秒）
  REQUEST_TIMEOUT: 30000,

  // 单类数据展示上限
  MAX_DATA_DISPLAY: 20
};
