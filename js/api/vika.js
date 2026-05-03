// ============================================================
// 法简AI - 本地JSON数据检索模块
// 读取本地 laws.json / interpretations.json / cases.json 进行关键词匹配检索
// ============================================================

const VikaAPI = (function () {
  'use strict';

  // ---------- 通用 JSON 读取 ----------

  async function _loadJSON(filename, signal) {
    const response = await fetch(filename, { signal });
    if (!response.ok) {
      throw new Error('FILE_LOAD_ERROR');
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('FILE_LOAD_ERROR');
    }
    return data;
  }

  // ---------- 关键词匹配 ----------

  function _matchKeywords(record, keywords) {
    if (!keywords || keywords.length === 0) return true;
    const kwField = (record['检索关键词'] || '').toLowerCase();
    return keywords.some(kw => kwField.includes(kw.toLowerCase()));
  }

  // ---------- 数据去重 ----------

  function _deduplicate(records, keyFn) {
    const seen = new Set();
    return records.filter(r => {
      const k = keyFn(r);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ---------- 三张表独立接口 ----------

  /**
   * 检索法条表
   * 字段：法条分类、法条章节、法条序号、法条原文、适用案由、检索关键词
   */
  async function getLawData(keywords, isVIP, signal) {
    try {
      const data = await _loadJSON('laws.json', signal);
      const maxDisplay = Config.getMaxDataDisplay();

      let filtered = (keywords && keywords.length > 0)
        ? data.filter(r => _matchKeywords(r, keywords))
        : data;

      const unique = _deduplicate(filtered, r => r['法条序号'] || r['法条原文'] || '');

      return unique.slice(0, maxDisplay).map((f, index) => ({
        id: f['法条序号'] || ('law_' + index),
        category:   f['法条分类']   || '',
        chapter:    f['法条章节']   || '',
        number:     f['法条序号']   || '',
        fullText:   f['法条原文']   || '',
        applicable: f['适用案由']   || '',
        keywords:   f['检索关键词'] || '',
        summary:    (f['法条原文'] || '').substring(0, 150)
      }));
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  }

  /**
   * 检索司法解释表
   * 字段：关联法条序号、解释名称、发布单位、解释原文、适用场景、检索关键词
   */
  async function getExplainData(keywords, isVIP, signal) {
    try {
      const data = await _loadJSON('interpretations.json', signal);
      const maxDisplay = Config.getMaxDataDisplay();

      let filtered = (keywords && keywords.length > 0)
        ? data.filter(r => _matchKeywords(r, keywords))
        : data;

      const unique = _deduplicate(filtered, r => r['解释名称'] || r['解释原文'] || '');

      return unique.slice(0, maxDisplay).map((f, index) => ({
        id: f['解释名称'] || ('explain_' + index),
        lawNumber:     f['关联法条序号'] || '',
        name:          f['解释名称']     || '',
        publisher:     f['发布单位']     || '',
        fullText:      f['解释原文']     || '',
        scenario:      f['适用场景']     || '',
        keywords:      f['检索关键词']   || '',
        summary:       (f['解释原文'] || '').substring(0, 150)
      }));
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  }

  /**
   * 检索指导性判例表
   * 字段：案件类型、关联法条、案情摘要、裁判要点、判决结果、检索关键词
   */
  async function getCaseData(keywords, isVIP, signal) {
    try {
      const data = await _loadJSON('cases.json', signal);
      const maxDisplay = Config.getMaxDataDisplay();

      let filtered = (keywords && keywords.length > 0)
        ? data.filter(r => _matchKeywords(r, keywords))
        : data;

      const unique = _deduplicate(filtered, r => r['案情摘要'] || r['裁判要点'] || '');

      return unique.slice(0, maxDisplay).map((f, index) => ({
        id: ('case_' + index),
        caseType:      f['案件类型'] || '',
        relatedLaw:    f['关联法条'] || '',
        summary:       f['案情摘要'] || '',
        judgePoint:    f['裁判要点'] || '',
        verdict:       f['判决结果'] || '',
        keywords:      f['检索关键词'] || ''
      }));
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  }

  // ---------- 错误信息映射 ----------

  function getErrorMessage(code) {
    const map = {
      'FILE_LOAD_ERROR': '数据文件加载失败，请稍后重试'
    };
    return map[code] || ('数据请求失败：' + code);
  }

  // ---------- 公开 API ----------
  return Object.freeze({
    getLawData,
    getExplainData,
    getCaseData,
    getErrorMessage
  });
})();
