// ============================================================
// 法简AI - 本地JSON数据检索模块
// 读取本地 laws.json / interpretations.json / cases.json 进行多级匹配检索
// ============================================================

const VikaAPI = (function () {
  'use strict';

  const MIN_KEYWORD_LENGTH = 1;
  var MIN_MATCH_THRESHOLD = 1;

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

  // ---------- 关键词清洗 ----------

  function _cleanKeywords(keywords) {
    if (!keywords || !Array.isArray(keywords)) return [];
    return keywords
      .map(function (kw) { return (kw || '').trim(); })
      .filter(function (kw) { return kw.length >= MIN_KEYWORD_LENGTH; });
  }

  // ---------- 中文 n-gram 生成 ----------

  function _generateNGrams(text, minLen, maxLen) {
    minLen = minLen || 2;
    maxLen = maxLen || 6;
    var result = [];
    var cleaned = text.replace(/[^一-龥a-zA-Z0-9]/g, '');
    for (var len = minLen; len <= maxLen; len++) {
      for (var i = 0; i <= cleaned.length - len; i++) {
        result.push(cleaned.substring(i, i + len));
      }
    }
    return result;
  }

  // ---------- 构建搜索文本（多字段加权） ----------

  function _buildSearchText(record) {
    var kwField = (record['检索关键词'] || '').toLowerCase().trim();
    if (kwField) return kwField;

    var fields = [
      record['法条原文'], record['法条章节'], record['适用案由'],
      record['解释全称'], record['原文条款'],
      record['案情摘要'], record['裁判要点'], record['关联法条'], record['判决结果']
    ];
    return fields.filter(function(f) { return f; }).join(' ').toLowerCase().trim();
  }

  // ---------- 关键词匹配 ----------

  function _matchKeywords(record, keywords) {
    var cleaned = _cleanKeywords(keywords);
    if (cleaned.length === 0) return false;
    var searchText = _buildSearchText(record);
    if (!searchText) return false;

    return cleaned.some(function(kw) {
      return searchText.indexOf(kw.toLowerCase()) !== -1;
    });
  }

  // ---------- 匹配得分（多级加权） ----------

  function _scoreKeywords(record, keywords) {
    var cleaned = _cleanKeywords(keywords);
    if (cleaned.length === 0) return 0;
    var searchText = _buildSearchText(record);
    if (!searchText) return 0;

    var recordTokens = searchText.split(/[,，;；、\s]+/).filter(function(t) { return t.length > 0; });

    var score = 0;
    cleaned.forEach(function(kw) {
      var lowerKW = kw.toLowerCase();

      // 精确 token 匹配：高权重
      var exactMatch = recordTokens.some(function(token) {
        return token === lowerKW;
      });
      if (exactMatch) { score += 3; return; }

      // token 包含匹配：中权重
      var containsMatch = recordTokens.some(function(token) {
        return token.indexOf(lowerKW) !== -1 || lowerKW.indexOf(token) !== -1;
      });
      if (containsMatch) { score += 2; return; }

      // 全局子串匹配：低权重
      if (searchText.indexOf(lowerKW) !== -1) { score += 1; return; }
    });
    return score;
  }

  // ---------- n-gram 模糊匹配（中文分词容错） ----------

  function _matchNGrams(record, keywords) {
    var cleaned = _cleanKeywords(keywords);
    if (cleaned.length === 0) return false;
    var searchText = _buildSearchText(record);
    if (!searchText) return false;

    // 为搜索文本生成 2-4 gram
    var recordGrams = _generateNGrams(searchText, 2, 4);
    var gramSet = new Set(recordGrams);

    return cleaned.some(function(kw) {
      var lowerKW = kw.toLowerCase();
      // 直接子串匹配
      if (searchText.indexOf(lowerKW) !== -1) return true;
      // 关键词的 2-gram 与记录 n-gram 交集
      if (lowerKW.length >= 2) {
        var kwGrams = _generateNGrams(lowerKW, 2, Math.min(lowerKW.length, 4));
        return kwGrams.some(function(g) { return gramSet.has(g); });
      }
      return false;
    });
  }

  function _scoreNGrams(record, keywords) {
    var cleaned = _cleanKeywords(keywords);
    if (cleaned.length === 0) return 0;
    var searchText = _buildSearchText(record);
    if (!searchText) return 0;

    var recordGrams = _generateNGrams(searchText, 2, 4);
    var gramSet = new Set(recordGrams);

    var score = 0;
    cleaned.forEach(function(kw) {
      var lowerKW = kw.toLowerCase();
      if (searchText.indexOf(lowerKW) !== -1) { score += 1; return; }
      if (lowerKW.length >= 2) {
        var kwGrams = _generateNGrams(lowerKW, 2, Math.min(lowerKW.length, 4));
        var matchCount = kwGrams.filter(function(g) { return gramSet.has(g); }).length;
        if (matchCount > 0) score += matchCount / kwGrams.length;
      }
    });
    return score;
  }

  // ---------- 大类兜底过滤 ----------

  function _matchCategory(record, category) {
    if (!category) return true;
    if (record['法条分类']) {
      var lawCat = record['法条分类'];
      if (category === '刑法') return lawCat === '刑法';
      if (category === '民法') return lawCat === '民法' || lawCat === '民商法';
      if (category === '行政法') return lawCat === '行政法';
      return true;
    }
    if (record['案件类型']) {
      var caseType = record['案件类型'];
      if (category === '刑法') return caseType === '刑事';
      if (category === '民法') return caseType === '民事';
      if (category === '行政法') return caseType === '行政';
      return true;
    }
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
    var seen = new Set();
    var result = [];
    for (var i = 0; i < records.length; i++) {
      var k = keyFn(records[i]);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      result.push(records[i]);
    }
    return result;
  }

  // ---------- 多级检索策略 ----------
  // 第一级：精确关键词匹配（token级别）
  // 第二级：n-gram 模糊匹配（中文容错）
  // 第三级：大类兜底

  function _multiLevelSearch(data, keywords, category, keyFn) {
    var cleaned = _cleanKeywords(keywords);

    // 第一级：精确匹配
    var level1 = [];
    var level1Keys = new Set();
    for (var i = 0; i < data.length; i++) {
      if (_matchKeywords(data[i], cleaned)) {
        level1.push(data[i]);
        level1Keys.add(keyFn(data[i]));
      }
    }

    // 如果精确匹配足够，直接返回
    if (level1.length >= MIN_MATCH_THRESHOLD) {
      level1.sort(function(a, b) {
        return _scoreKeywords(b, cleaned) - _scoreKeywords(a, cleaned);
      });
      return level1;
    }

    // 第二级：n-gram 模糊匹配补充
    var merged = level1.slice();
    for (var j = 0; j < data.length; j++) {
      var k = keyFn(data[j]);
      if (!k || level1Keys.has(k)) continue;
      if (_matchNGrams(data[j], cleaned)) {
        merged.push(data[j]);
        level1Keys.add(k);
      }
    }

    // 如果模糊匹配也足够，按混合得分排序返回
    if (merged.length >= MIN_MATCH_THRESHOLD) {
      merged.sort(function(a, b) {
        var scoreA = _scoreKeywords(a, cleaned) * 2 + _scoreNGrams(a, cleaned);
        var scoreB = _scoreKeywords(b, cleaned) * 2 + _scoreNGrams(b, cleaned);
        return scoreB - scoreA;
      });
      return merged;
    }

    // 第三级：大类兜底
    for (var m = 0; m < data.length; m++) {
      var dk = keyFn(data[m]);
      if (!dk || level1Keys.has(dk)) continue;
      if (_matchCategory(data[m], category)) {
        merged.push(data[m]);
        level1Keys.add(dk);
      }
    }

    merged.sort(function(a, b) {
      var scoreA = _scoreKeywords(a, cleaned) * 2 + _scoreNGrams(a, cleaned);
      var scoreB = _scoreKeywords(b, cleaned) * 2 + _scoreNGrams(b, cleaned);
      return scoreB - scoreA;
    });
    return merged;
  }

  // ---------- 三张表独立接口 ----------

  async function getLawData(keywords, isVIP, signal, category) {
    try {
      var data = await _loadJSON('laws.json', signal);
      var maxDisplay = Config.getMaxDataDisplay();

      var lawKeyFn = function(r) { return r['法条序号'] || r['法条原文'] || ''; };

      var filtered;
      if (keywords && keywords.length > 0) {
        filtered = _multiLevelSearch(data, keywords, category, lawKeyFn);
      } else {
        filtered = data.filter(function(r) { return _matchCategory(r, category); });
      }

      var unique = _deduplicate(filtered, lawKeyFn);

      return unique.slice(0, maxDisplay).map(function(f, index) {
        return {
          id: f['法条序号'] || ('law_' + index),
          category:   f['法条分类']   || '',
          chapter:    f['法条章节']   || '',
          number:     f['法条序号']   || '',
          fullText:   f['法条原文']   || '',
          applicable: f['适用案由']   || '',
          keywords:   f['检索关键词'] || '',
          summary:    (f['法条原文'] || '').substring(0, 150)
        };
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  }

  async function getExplainData(keywords, isVIP, signal, category) {
    try {
      var data = await _loadJSON('interpretations.json', signal);
      var maxDisplay = Config.getMaxDataDisplay();

      var explainKeyFn = function(r) { return r['解释全称'] || r['原文条款'] || ''; };

      var filtered;
      if (keywords && keywords.length > 0) {
        filtered = _multiLevelSearch(data, keywords, category, explainKeyFn);
      } else {
        filtered = data.filter(function(r) { return _matchCategory(r, category); });
      }

      var unique = _deduplicate(filtered, explainKeyFn);

      return unique.slice(0, maxDisplay).map(function(f, index) {
        return {
          id: ('explain_' + index),
          lawNumber:     f['司法解释文号'] || '',
          name:          f['解释全称']     || '',
          publisher:     f['发布机关']     || '',
          fullText:      f['原文条款']     || '',
          scenario:      f['适用案由']     || '',
          keywords:      f['检索关键词']   || '',
          summary:       (f['原文条款'] || '').substring(0, 150)
        };
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  }

  async function getCaseData(keywords, isVIP, signal, category) {
    try {
      var data = await _loadJSON('cases.json', signal);
      var maxDisplay = Config.getMaxDataDisplay();

      var caseKeyFn = function(r) { return r['案情摘要'] || r['裁判要点'] || ''; };

      var filtered;
      if (keywords && keywords.length > 0) {
        filtered = _multiLevelSearch(data, keywords, category, caseKeyFn);
      } else {
        filtered = data.filter(function(r) { return _matchCategory(r, category); });
      }

      var unique = _deduplicate(filtered, caseKeyFn);

      return unique.slice(0, maxDisplay).map(function(f, index) {
        return {
          id: ('case_' + index),
          caseType:      f['案件类型'] || '',
          relatedLaw:    f['关联法条'] || '',
          summary:       f['案情摘要'] || '',
          judgePoint:    f['裁判要点'] || '',
          verdict:       f['判决结果'] || '',
          keywords:      f['检索关键词'] || ''
        };
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  }

  // ---------- 错误信息映射 ----------

  function getErrorMessage(code) {
    var map = {
      'FILE_LOAD_ERROR': '数据文件加载失败，请稍后重试'
    };
    return map[code] || ('数据请求失败：' + code);
  }

  // ---------- 公开 API ----------
  return Object.freeze({
    getLawData:      getLawData,
    getExplainData:  getExplainData,
    getCaseData:     getCaseData,
    getErrorMessage: getErrorMessage
  });
})();
