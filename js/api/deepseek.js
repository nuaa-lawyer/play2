// ============================================================
// 法简AI - DeepSeek API 封装模块
// 通过 Netlify Function 代理请求，密钥仅存服务端
// 超时 10 秒，免费版适配
// ============================================================

const DeepSeekAPI = (function () {
  'use strict';

  let _abortController = null;
  let _isRequesting = false;
  let _isTimeoutAbort = false;

  // ---------- 关键词截取 ----------

  /**
   * 多容错正则截取关键词数组
   * 兼容 AI 输出的各种格式变体
   */
  function extractKeywords(text) {
    if (!text) return [];

    const patterns = [
      /【关键词】\s*[:：]?\s*([\s\S]*?)(?:$|(?=【))/,
      /关键词\s*[:：]\s*([\s\S]*?)(?:$|(?=【))/,
      /\[关键词\]\s*[:：]?\s*([\s\S]*?)(?:$|(?=\[))/,
      /KEYWORDS?\s*[:：]\s*([\s\S]*?)$/i,
      /#+\s*关键词\s*[:：]?\s*\n+([\s\S]*?)$/i,
      /关键词[：:]\s*([\s\S]*?)$/m
    ];

    let raw = '';
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m[1] && m[1].trim().length > 0) {
        raw = m[1].trim();
        break;
      }
    }

    if (!raw) return [];

    raw = raw.replace(/[\n\r]+/g, ',')
             .replace(/[；;]/g, ',')
             .replace(/[，]/g, ',')
             .replace(/\s+/g, '')
             .replace(/[、]/g, ',');

    const keywords = raw.split(',')
      .map(k => k.trim())
      .filter(k => k.length >= 1 && k.length < 50);

    const seen = new Set();
    const result = [];
    for (const k of keywords) {
      if (!seen.has(k)) {
        seen.add(k);
        result.push(k);
      }
    }
    return result;
  }

  // ---------- 结构化解析 ----------

  /**
   * 解析 AI 返回的结构化内容（支持极简/完整两种格式）
   * 返回 { sections, keywords }
   */
  function parseResponse(text) {
    const sections = {};

    // 优先匹配极简格式【法律评析】
    let evalMatch = text.match(/【法律评析】\s*[:：]?\s*([\s\S]*?)(?:$|(?=【))/);
    if (evalMatch && evalMatch[1]) {
      sections['evaluation'] = evalMatch[1].trim();
    }

    // 兼容完整五段式格式
    const mapping = {
      '案件事实重梳': 'facts',
      '法律争议焦点': 'disputes',
      '行为法律定性': 'qualification',
      '构成要件分析': 'elements',
      '完整法律评析': 'evaluation'
    };

    for (const [cn, en] of Object.entries(mapping)) {
      if (sections[en] && sections[en].length > 0) continue;
      const pat = new RegExp('【' + cn + '】\\s*[:：]?\\s*([\\s\\S]*?)(?=$|(?=【))');
      const m = text.match(pat);
      if (m && m[1]) {
        sections[en] = m[1].trim();
      } else if (!sections[en]) {
        sections[en] = '';
      }
    }

    const keywords = extractKeywords(text);

    return { sections, keywords };
  }

  // ---------- 请求发送 ----------

  function abort() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _isRequesting = false;
  }

  function isRequesting() {
    return _isRequesting;
  }

  /**
   * 发送案情解析请求（通过 Netlify Function 代理）
   * @param {string} caseText - 案情文本
   * @param {string} category - 案件大类（兜底用）
   * @returns {Promise<{sections, keywords, rawText}>}
   */
  async function analyze(caseText, category) {
    abort();

    _abortController = new AbortController();
    _isRequesting = true;
    _isTimeoutAbort = false;

    const timeout = Config.getRequestTimeout();

    const timeoutId = setTimeout(() => {
      _isTimeoutAbort = true;
      if (_abortController) {
        _abortController.abort();
      }
    }, timeout);

    const body = {
      model: Config.getDeepSeekModel(),
      messages: [
        { role: 'system', content: Config.getSystemPrompt() },
        { role: 'user', content: caseText }
      ],
      temperature: 0.3,
      max_tokens: 512,
      stream: false
    };

    let response;
    try {
      response = await fetch(Config.getDeepSeekApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
        signal: _abortController.signal
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) throw new Error('AUTH_ERROR');
        if (status === 402) throw new Error('BALANCE_ERROR');
        if (status === 429) throw new Error('RATE_LIMIT');
        if (status >= 500) throw new Error('SERVER_ERROR');
        throw new Error('HTTP_' + status);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('INVALID_RESPONSE');
      }

      const rawText = data.choices[0].message.content || '';

      const { sections, keywords } = parseResponse(rawText);

      let finalKeywords = keywords;
      if (finalKeywords.length === 0 && category) {
        const fallback = Config.getFallbackKeywords(category);
        finalKeywords = fallback.split(',').map(k => k.trim()).filter(Boolean);
      }

      return { sections, keywords: finalKeywords, rawText };

    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(_isTimeoutAbort ? 'REQUEST_TIMEOUT' : 'REQUEST_ABORTED');
      }
      if (err.name === 'TypeError' || (err.message && err.message.indexOf('Failed to fetch') !== -1)) {
        throw new Error('NETWORK_ERROR');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      _isRequesting = false;
      _abortController = null;
      _isTimeoutAbort = false;
    }
  }

  // ---------- 错误信息映射 ----------

  function getErrorMessage(code) {
    const map = {
      'AUTH_ERROR':      'API 密钥无效，请检查 Netlify 环境变量 DEEPSEEK_API_KEY 配置',
      'BALANCE_ERROR':   'API 账户余额不足，请充值后重试',
      'RATE_LIMIT':      '请求频率超限，请稍后再试',
      'SERVER_ERROR':    'DeepSeek 服务器异常，请稍后重试',
      'REQUEST_TIMEOUT': '请求超时（10 秒），请稍后重试',
      'REQUEST_ABORTED': '请求已取消',
      'INVALID_RESPONSE':'AI 返回数据格式异常，请重试',
      'NETWORK_ERROR':   '网络连接失败，请检查网络后重试'
    };
    return map[code] || ('请求失败：' + code);
  }

  // ---------- 公开 API ----------
  return Object.freeze({
    analyze,
    abort,
    isRequesting,
    extractKeywords,
    parseResponse,
    getErrorMessage
  });
})();
