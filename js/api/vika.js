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
    var kwField = (record['检索关键词'] || '').toLowerCase().trim();
    if (!kwField) return false;

    // 将记录关键词字段按常见分隔符拆分为独立词组
    var recordTokens = kwField.split(/[,，;；、\s]+/).filter(function(t) { return t.length > 0; });

    return keywords.some(function(kw) {
      var lowerKW = kw.toLowerCase().trim();
      if (!lowerKW) return false;
      // 双向匹配：搜索词包含记录词 或 记录词包含搜索词 或 字段整体包含
      return recordTokens.some(function(token) {
        return token.indexOf(lowerKW) !== -1 || lowerKW.indexOf(token) !== -1;
      }) || kwField.indexOf(lowerKW) !== -1;
    });
  }

  /**
   * 大类兜底过滤：无关键词时按案件大类过滤记录，避免返回全量无关内容
   */
  function _matchCategory(record, category) {
    if (!category) return true;
    // laws.json 使用 法条分类
    if (record['法条分类']) {
      var lawCat = record['法条分类'];
      if (category === '刑法') return lawCat === '刑法';
      if (category === '民法') return lawCat === '民法' || lawCat === '民商法';
      if (category === '行政法') return lawCat === '行政法';
      return true;
    }
    // cases.json 使用 案件类型
    if (record['案件类型']) {
      var caseType = record['案件类型'];
      if (category === '刑法') return caseType === '刑事';
      if (category === '民法') return caseType === '民事';
      if (category === '行政法') return caseType === '行政';
      return true;
    }
    // interpretations.json 使用 适用案由
    if (record['适用案由']) {
      var scenario = record['适用案由'];
      if (category === '刑法') return scenario.indexOf('刑事') !== -1 || scenario.indexOf('刑法') !== -1;
      if (category === '民法') return scenario.indexOf('民事') !== -1 || scenario.indexOf('民法') !== -1;
      if (category === '行政法') return scenario.indexOf('行政') !== -1;
      return true;
    }
    return true;
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
  async function getLawData(keywords, isVIP, signal, category) {
    try {
      const data = await _loadJSON('laws.json', signal);
      const maxDisplay = Config.getMaxDataDisplay();

      var filtered;
      if (keywords && keywords.length > 0) {
        filtered = data.filter(function(r) { return _matchKeywords(r, keywords); });
      } else {
        // 无关键词时按大类兜底过滤，避免返回全量无关法条
        filtered = data.filter(function(r) { return _matchCategory(r, category); });
      }

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
  async function getExplainData(keywords, isVIP, signal, category) {
    try {
      const data = await _loadJSON('interpretations.json', signal);
      const maxDisplay = Config.getMaxDataDisplay();

      var filtered;
      if (keywords && keywords.length > 0) {
        filtered = data.filter(function(r) { return _matchKeywords(r, keywords); });
      } else {
        filtered = data.filter(function(r) { return _matchCategory(r, category); });
      }

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
  async function getCaseData(keywords, isVIP, signal, category) {
    try {
      const data = await _loadJSON('cases.json', signal);
      const maxDisplay = Config.getMaxDataDisplay();

      var filtered;
      if (keywords && keywords.length > 0) {
        filtered = data.filter(function(r) { return _matchKeywords(r, keywords); });
      } else {
        filtered = data.filter(function(r) { return _matchCategory(r, category); });
      }

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
