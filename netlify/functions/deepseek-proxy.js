// ============================================================
// 法简AI - DeepSeek API 代理函数 (Netlify Functions)
// 读取 Netlify 环境变量 DEEPSEEK_API_KEY，转发请求到 DeepSeek
// ============================================================

exports.handler = async function (event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, User-Agent',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || '';

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Accept': 'application/json'
      },
      body: event.body
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: body
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy error: ' + (err.message || 'unknown') })
    };
  }
};
