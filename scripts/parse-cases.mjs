// ============================================================
// 法简AI - 指导性案例解析脚本 v3
// 从 E:/cases PDF 提取 → 结构化 → 写入 cases.json
// 基于 PDF 实际格式精准解析
// ============================================================

import fs from 'fs';

const OUTPUT_FILE = 'C:/Users/welcome/fajian-ai/cases.json';

// ============================================================
// PDF 文本提取
// ============================================================
async function extractPDFText(pdfPath, label, pdfjsLib) {
  console.log('  [' + label + '] 读取 PDF...');
  const buf = fs.readFileSync(pdfPath);
  const data = new Uint8Array(buf);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('  [' + label + '] 共 ' + doc.numPages + ' 页，提取文本中...');

  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ');
    fullText += pageText + '\n';
    if (i % 300 === 0) console.log('    已处理 ' + i + '/' + doc.numPages + ' 页...');
  }
  return fullText;
}

// ============================================================
// 文本清理
// ============================================================
function normalizeSpaces(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/ ([,，。；;：:）\)】\]、])/g, '$1')
    .replace(/([（(【\[）])\s*/g, '$1')
    .replace(/\s*-\s*\d+\s*-\s*/g, ' ')  // 移除页码标记
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(text) {
  return normalizeSpaces(text)
    .replace(/\.\s*\.\s*\./g, '')  // 移除省略号残留
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ============================================================
// 字段提取器 — 在两个标记之间提取内容
// ============================================================
function extractBetween(text, startMarkers, endMarkers) {
  let startIdx = -1;
  let startLen = 0;
  for (const m of startMarkers) {
    const idx = text.indexOf(m);
    if (idx >= 0 && (startIdx < 0 || idx < startIdx)) {
      startIdx = idx;
      startLen = m.length;
    }
  }
  if (startIdx < 0) return '';

  let sub = text.substring(startIdx + startLen);
  let endIdx = sub.length;
  for (const m of endMarkers) {
    const idx = sub.indexOf(m);
    if (idx >= 0 && idx < endIdx) endIdx = idx;
  }
  return cleanText(sub.substring(0, endIdx));
}

// ============================================================
// 最高法案例解析
// ============================================================
function parseSupremeCourtCases(text) {
  console.log('\n  [最高法] 解析案例中...');

  // 找到所有"指导案例 X 号"作为分割点
  const pattern = /指导案例\s+(\d+)\s+号/g;
  const matches = [...text.matchAll(pattern)];

  // 过滤掉目录中的匹配 — 实际案例内容后面有案件名称（中文），且有"关键词"字段
  const caseStarts = [];
  for (const m of matches) {
    // 检查该位置后面100字符内是否有"关键词"或案件名称
    const after = text.substring(m.index, m.index + 500);
    if (after.includes('关键词') || after.includes('裁判要点') || after.includes('基本案情')) {
      caseStarts.push({ number: parseInt(m[1]), index: m.index });
    }
  }
  console.log('    发现 ' + caseStarts.length + ' 个案例（已过滤目录）');

  const cases = [];
  for (let i = 0; i < caseStarts.length; i++) {
    const start = caseStarts[i];
    const end = (i + 1 < caseStarts.length) ? caseStarts[i + 1].index : text.length;
    let caseText = text.substring(start.index, end);

    // 提取案件名称（指导案例X号之后，"关键词"之前）
    let title = '';
    const titleEnd = caseText.search(/关键词[：:]|裁判要点/);
    if (titleEnd > 0) {
      title = cleanText(caseText.substring(0, titleEnd).replace(/指导案例\s+\d+\s+号\s*/, ''));
    }

    // 提取各字段
    const keywords = extractBetween(caseText, ['关键词：', '关键词:', '关键词 '],
      ['裁判要点', '相关法条', '基本案情']);
    const judgePoint = extractBetween(caseText, ['裁判要点：', '裁判要点:', '裁判要点 '],
      ['相关法条', '基本案情', '裁判结果']);
    const relatedLaw = extractBetween(caseText, ['相关法条：', '相关法条:', '相关法条 ', '相关法律：', '相关法律:'],
      ['基本案情', '裁判结果', '裁判理由']);
    const summary = extractBetween(caseText, ['基本案情：', '基本案情:', '基本案情 '],
      ['裁判结果', '裁判理由', '生效裁判']);
    const verdict = extractBetween(caseText,
      ['裁判结果：', '裁判结果:', '裁判结果 ', '生效裁判：', '生效裁判:', '判决结果：', '判决结果:'],
      ['裁判理由', '相关法条', '要旨', '基本案情', '案例索引']);

    // 案件类型推断
    let caseType = '民事';
    const firstPart = caseText.substring(0, 600);
    const crimCount = (firstPart.match(/刑事|故意杀人|故意伤害|抢劫|盗窃|诈骗|贪污|受贿|挪用公款|死刑|缓刑|有期|渎职|贩毒/g) || []).length;
    const adminCount = (firstPart.match(/行政处罚|行政许可|行政强制|行政复议|行政诉讼|行政纠纷/g) || []).length;
    if (crimCount > 2) caseType = '刑事';
    else if (adminCount > 1) caseType = '行政';

    // 补充关键词
    let finalKW = keywords;
    if ((!finalKW || finalKW.split(/[,，]/).length < 2) && title) {
      const extra = new Set();
      const pats = [/刑事|民事|行政/g, /合同|侵权|买卖|租赁|居间/g, /公司|股权|破产/g, /工伤|劳动/g, /婚姻|继承/g, /环境|污染|生态/g, /商标|专利|知识/g];
      for (const p of pats) {
        const m = (title + ' ' + caseText.substring(0, 500)).match(p);
        if (m) m.forEach(k => extra.add(k));
      }
      if (extra.size > 0) finalKW = finalKW ? finalKW + ',' + [...extra].join(',') : [...extra].join(',');
    }

    // 案例标题作为摘要的兜底
    const finalSummary = summary || title || caseText.substring(0, 200);

    cases.push({
      caseType,
      relatedLaw: relatedLaw || '',
      summary: finalSummary.substring(0, 500),
      judgePoint: judgePoint || '',
      verdict: verdict || '',
      keywords: (finalKW || '').replace(/[,，]\s*/g, ','),
      _source: '最高人民法院指导性案例第' + start.number + '号',
    });
  }

  return cases;
}

// ============================================================
// 最高检案例解析
// ============================================================
function parseSupremeProcuratorateCases(text) {
  console.log('\n  [最高检] 解析案例中...');

  // 找到所有"检例第X号"作为分割点
  const pattern = /检例第\s+(\d+)\s+号/g;
  const matches = [...text.matchAll(pattern)];

  // 过滤目录匹配 — 实际案例内容后面有关键词/要旨
  const caseStarts = [];
  for (const m of matches) {
    const after = text.substring(m.index, m.index + 500);
    if (after.includes('关键词') || after.includes('要旨') || after.includes('基本案情')) {
      caseStarts.push({ number: parseInt(m[1]), index: m.index });
    }
  }
  console.log('    发现 ' + caseStarts.length + ' 个案例（已过滤目录）');

  const cases = [];
  for (let i = 0; i < caseStarts.length; i++) {
    const start = caseStarts[i];
    const end = (i + 1 < caseStarts.length) ? caseStarts[i + 1].index : text.length;
    let caseText = text.substring(start.index, end);

    // 提取标题
    let title = '';
    const titleEnd = caseText.search(/【关键词|【要\s*旨|关键词[：:]|要\s*旨[：:]/);
    if (titleEnd > 0) {
      title = cleanText(caseText.substring(0, titleEnd).replace(/检例第\s+\d+\s+号\s*/g, '').replace(/[（(]\s*检例第\s*\d+\s*号\s*[）)]\s*/g, ''));
    }

    // 提取各字段 — 最高检用【】标记
    const keywords = extractBetween(caseText,
      ['【关键词】', '【关键 词】', '关键词：', '关键词:', '关键词 '],
      ['【要旨】', '【要 旨】', '要旨：', '要旨:', '【相关立法】', '【基本案情】']);
    const judgePoint = extractBetween(caseText,
      ['【要旨】', '【要 旨】', '要旨：', '要旨:', '要 旨：', '要 旨:'],
      ['【相关立法】', '【基本案情】', '【关键词】', '【诉讼过程】']);
    const relatedLaw = extractBetween(caseText,
      ['【相关立法】', '【相关 立法】', '相关立法：', '相关立法:', '【相关规定】'],
      ['【基本案情】', '【诉讼过程】', '【要旨】', '【指导意义】']);
    const summary = extractBetween(caseText,
      ['【基本案情】', '【基本 案情】', '基本案情：', '基本案情:', '基本案情 '],
      ['【要旨】', '【诉讼过程】', '【检察机关履职过程】', '【处理结果】', '【指导意义】', '【相关立法】']);
    const verdict = extractBetween(caseText,
      ['【诉讼过程】', '【诉讼 过程】', '【处理结果】', '【处理 结果】', '处理结果：', '处理结果:', '判决结果：', '判决结果:'],
      ['【指导意义】', '【相关立法】', '【要旨】']);

    // 案件类型 — 最高检大多数是刑事
    let caseType = '刑事';
    const firstPart = caseText.substring(0, 600);
    if (/民事|合同|侵权|婚姻|继承|物权|债权|公司|股权/g.test(firstPart) && !/刑事|故意杀人|盗窃|诈骗|贪污|受贿|渎职/g.test(firstPart)) {
      caseType = '民事';
    } else if (/行政|处罚|许可|强制|复议/g.test(firstPart)) {
      caseType = '行政';
    }

    // 补充关键词
    let finalKW = keywords;
    if ((!finalKW || finalKW.split(/[,，]/).length < 2) && title) {
      const extra = new Set();
      const pats = [/渎职|受贿|贪污|挪用|滥用职权/g, /故意杀人|故意伤害|盗窃|诈骗|抢劫/g, /公益诉讼|环境|生态/g, /合同|侵权/g, /食品|药品/g];
      for (const p of pats) {
        const m = (title + ' ' + caseText.substring(0, 500)).match(p);
        if (m) m.forEach(k => extra.add(k));
      }
      if (extra.size > 0) finalKW = finalKW ? finalKW + ',' + [...extra].join(',') : [...extra].join(',');
    }

    const finalSummary = summary || title || caseText.substring(0, 200);

    cases.push({
      caseType,
      relatedLaw: relatedLaw || '',
      summary: finalSummary.substring(0, 500),
      judgePoint: judgePoint || '',
      verdict: verdict || '',
      keywords: (finalKW || '').replace(/[,，]\s*/g, ','),
      _source: '最高人民检察院指导性案例检例第' + start.number + '号',
    });
  }

  return cases;
}

// ============================================================
// 去重
// ============================================================
function deduplicateCases(cases) {
  const seen = new Set();
  const result = [];
  for (const c of cases) {
    const key = (c._source || '') + (c.summary || '').substring(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }
  return result;
}

// ============================================================
// 最终格式化
// ============================================================
function finalize(cases) {
  return cases.map(c => ({
    案件类型: c.caseType,
    关联法条: c.relatedLaw,
    案情摘要: c.summary,
    裁判要点: c.judgePoint,
    判决结果: c.verdict,
    检索关键词: c.keywords,
  }));
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log('=== 法简AI 指导性案例自动解析 v3 ===\n');

  const pdfjsLib = await import('pdfjs-dist');

  // 1. 提取 PDF
  const scText = await extractPDFText(
    'E:/cases/（共49批）最高人民法院批指导性案例汇编（2026年2月）.pdf',
    '最高法', pdfjsLib
  );
  console.log('    文本长度: ' + scText.length + ' 字符');

  const spText = await extractPDFText(
    'E:/cases/（ 共62批 ）最高人民检察院指导性案例汇编（2026年3月）.pdf',
    '最高检', pdfjsLib
  );
  console.log('    文本长度: ' + spText.length + ' 字符');

  // 2. 解析案例
  const scCases = parseSupremeCourtCases(scText);
  console.log('    最高法解析成功: ' + scCases.length + ' 个案例');

  const spCases = parseSupremeProcuratorateCases(spText);
  console.log('    最高检解析成功: ' + spCases.length + ' 个案例');

  // 3. 合并去重
  let allCases = [...scCases, ...spCases];
  console.log('\n  合并前: ' + allCases.length + ' 个案例');
  allCases = deduplicateCases(allCases);
  console.log('  去重后: ' + allCases.length + ' 个案例');

  // 4. 统计
  const stats = {};
  for (const c of allCases) {
    stats[c.caseType] = (stats[c.caseType] || 0) + 1;
  }
  console.log('\n  案件类型分布:');
  for (const [k, v] of Object.entries(stats)) {
    console.log('    ' + k + ': ' + v + ' 例');
  }

  // 5. 格式化输出
  const output = finalize(allCases);

  // 6. 写入
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log('\n=== 完成 ===');
  console.log('指导性案例总数: ' + output.length + ' 例');
  console.log('文件大小: ' + (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1) + ' MB');
  console.log('输出文件: ' + OUTPUT_FILE);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
