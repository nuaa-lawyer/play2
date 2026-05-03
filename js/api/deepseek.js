// ============================================================
// 法简AI - DeepSeek API 封装模块
// AbortController 管理 / 超时控制 / 关键词截取 / 降级兜底
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

    // 尝试多种正则匹配【关键词】区块
    const patterns = [
      /【关键词】\s*[:：]?\s*([\s\S]*?)(?:$|(?=【))/,
      /关键词\s*[:：]\s*([\s\S]*?)(?:$|(?=【))/,
      /\[关键词\]\s*[:：]?\s*([\s\S]*?)(?:$|(?=\[))/,
      /KEYWORDS?\s*[:：]\s*([\s\S]*?)$/i,
      /#+\s*关键词\s*\n([\s\S]*?)$/i
    ];

    let raw = '';
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        raw = m[1];
        break;
      }
    }

    if (!raw) return [];

    // 清洗：去除换行、多余空格、特殊符号
    raw = raw.replace(/[\n\r]+/g, ',')
             .replace(/[；;]/g, ',')
             .replace(/\s+/g, '')
             .replace(/，/g, ',');

    // 拆分逗号分隔
    const keywords = raw.split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0 && k.length < 50); // 过滤空和异常长字符串

    return [...new Set(keywords)]; // 去重
  }

  // ---------- 结构化解析 ----------

  /**
   * 解析 AI 返回的结构化内容
   * 返回 { sections, keywords }
   */
  function parseResponse(text) {
    const sections = {};
    const mapping = {
      '案件事实重梳': 'facts',
      '法律争议焦点': 'disputes',
      '行为法律定性': 'qualification',
      '构成要件分析': 'elements',
      '完整法律评析': 'evaluation'
    };

    let remaining = text;

    for (const [cn, en] of Object.entries(mapping)) {
      const pat = new RegExp('【' + cn + '】\\s*[:：]?\\s*([\\s\\S]*?)(?=$|(?=【))');
      const m = remaining.match(pat);
      if (m && m[1]) {
        sections[en] = m[1].trim();
        remaining = remaining.replace(m[0], '');
      } else {
        sections[en] = '';
      }
    }

    const keywords = extractKeywords(text);

    return { sections, keywords };
  }

  // ---------- 请求发送 ----------

  /** 中止当前请求 */
  function abort() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _isRequesting = false;
  }

  /** 检查是否请求中 */
  function isRequesting() {
    return _isRequesting;
  }

  /**
   * 发送案情解析请求
   * @param {string} caseText - 案情文本
   * @param {string} category - 案件大类（兜底用）
   * @returns {Promise<{sections, keywords, rawText}>}
   */
  async function analyze(caseText, category) {
    // 前置中止旧请求
    abort();

    _abortController = new AbortController();
    _isRequesting = true;
    _isTimeoutAbort = false;

    const timeout = Config.getRequestTimeout();

    // 超时定时器 — 超时后主动 abort 以释放网络资源
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
      max_tokens: 8192,
      stream: false
    };

    let response;
    try {
      response = await fetch(Config.getDeepSeekApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + Config.getDeepSeekApiKey(),
          'Accept': 'application/json',
          'User-Agent': 'FajianAI/1.0'
        },
        body: JSON.stringify(body),
        signal: _abortController.signal
      });

      // HTTP 错误处理
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

      // 解析结构化内容
      const { sections, keywords } = parseResponse(rawText);

      // 兜底：若关键词为空，使用大类兜底关键词
      let finalKeywords = keywords;
      if (finalKeywords.length === 0 && category) {
        const fallback = Config.getFallbackKeywords(category);
        finalKeywords = fallback.split(',').map(k => k.trim()).filter(Boolean);
      }

      return { sections, keywords: finalKeywords, rawText };

    } catch (err) {
      // AbortError 区分超时/手动中止
      if (err.name === 'AbortError') {
        throw new Error(_isTimeoutAbort ? 'REQUEST_TIMEOUT' : 'REQUEST_ABORTED');
      }
      // 网络层错误（DNS/代理/TCP 失败）
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
      'AUTH_ERROR':      'API 密钥无效，请检查 DeepSeek 密钥配置',
      'BALANCE_ERROR':   'API 账户余额不足，请充值后重试',
      'RATE_LIMIT':      '请求频率超限，请稍后再试',
      'SERVER_ERROR':    'DeepSeek 服务器异常，请稍后重试',
      'REQUEST_TIMEOUT': '请求超时（30 秒），请稍后重试或检查网络环境',
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
