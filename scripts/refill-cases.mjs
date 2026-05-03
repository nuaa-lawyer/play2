// ============================================================
// 法简AI - cases.json 字段补全与清理脚本 v2
// 从现有内容智能补全 → 删除无效条目
// ============================================================

import fs from 'fs';

const CASES_FILE = 'C:/Users/welcome/fajian-ai/cases.json';

function isEmpty(value, minLen) {
  return !value || value.trim().length < minLen;
}

// 从文本中提取法律引用
function extractLawRefs(text) {
  if (!text) return '';
  const refs = text.match(/《[^》]+》/g);
  if (!refs) return '';
  return [...new Set(refs)].slice(0, 6).join('; ');
}

// 从文本中生成关键词
function generateKeywords(caseText) {
  if (!caseText) return '';
  const kw = new Set();

  // 案件类型
  if (/刑事/g.test(caseText)) kw.add('刑事');
  if (/民事/g.test(caseText)) kw.add('民事');
  if (/行政/g.test(caseText)) kw.add('行政');

  // 罪名
  const crimePats = [
    /故意杀人|过失杀人|故意伤害|强奸|抢劫|盗窃|诈骗|抢夺/g,
    /贪污|受贿|行贿|挪用公款|职务侵占|滥用职权|玩忽职守/g,
    /渎职|徇私枉法|环境监管失职/g,
    /走私|贩卖|运输|制造毒品|贩毒|非法经营/g,
    /绑架|非法拘禁|敲诈勒索|寻衅滋事|聚众斗殴/g,
    /危害公共安全|交通肇事|危险驾驶/g,
    /生产销售伪劣|有毒有害食品|假药/g,
    /侵犯公民个人信息|非法获取计算机/g,
    /非法吸收公众存款|集资诈骗|组织领导传销/g,
    /破坏环境|污染环境|非法采矿|非法捕捞/g,
    /开设赌场|赌博|组织卖淫/g,
    /侵犯著作权|假冒注册商标|侵犯商业秘密/g,
    /逃税|虚开增值税|洗钱/g,
  ];
  for (const p of crimePats) {
    const m = caseText.match(p);
    if (m) m.forEach(k => kw.add(k));
  }

  // 民商事案由
  const civilPats = [
    /合同纠纷|买卖合同|租赁合同|借款合同|建设工程/g,
    /侵权|人身损害|医疗损害|产品责任|机动车事故/g,
    /婚姻|离婚|继承|抚养|赡养/g,
    /物权|所有权|抵押权|质权/g,
    /公司|股权|股东|破产|清算/g,
    /劳动|劳动合同|工伤|社会保险/g,
    /知识产权|专利|商标|著作权/g,
    /不正当竞争|垄断/g,
    /环境|污染|生态/g,
    /保险|票据|证券|期货/g,
    /海事|海商|船舶/g,
    /仲裁|执行|再审/g,
  ];
  for (const p of civilPats) {
    const m = caseText.match(p);
    if (m) m.forEach(k => kw.add(k));
  }

  // 行政案由
  const adminPats = [
    /行政处罚|行政许可|行政强制|行政征收/g,
    /行政复议|行政诉讼|行政赔偿/g,
    /政府信息|不动产登记|工伤认定/g,
  ];
  for (const p of adminPats) {
    const m = caseText.match(p);
    if (m) m.forEach(k => kw.add(k));
  }

  // 法律原则和概念
  const conceptPats = [
    /死刑|缓刑|减刑|假释|自首|立功|累犯|数罪并罚/g,
    /正当防卫|紧急避险|犯罪预备|犯罪未遂|犯罪中止/g,
    /违约责任|缔约过失|损害赔偿|违约金/g,
    /善意取得|表见代理|无权代理/g,
    /诚实信用|公序良俗|公平原则/g,
  ];
  for (const p of conceptPats) {
    const m = caseText.match(p);
    if (m) m.forEach(k => kw.add(k));
  }

  return [...kw].slice(0, 15).join(',');
}

// ============================================================
// 主流程
// ============================================================
function main() {
  console.log('=== 法简AI cases.json 智能补全与清理 ===\n');

  // 1. 读取当前 cases.json
  const cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf-8'));
  console.log('当前案例总数: ' + cases.length);

  // 2. 统计当前质量
  console.log('\n补全前质量:');
  const beforeStats = {};
  ['关联法条', '裁判要点', '判决结果', '检索关键词'].forEach(field => {
    const minLen = field === '检索关键词' || field === '关联法条' ? 5 : 20;
    const cnt = cases.filter(c => isEmpty(c[field], minLen)).length;
    beforeStats[field] = cnt;
    console.log('  ' + field + ' 缺失: ' + cnt + '/' + cases.length);
  });

  // 3. 补全字段（从现有内容提取）
  let filledLaw = 0, filledKW = 0, filledVerdict = 0;

  for (const c of cases) {
    // 组合所有现有文本用于提取
    const allText = [c['案情摘要'], c['裁判要点'], c['判决结果'], c['关联法条']]
      .filter(Boolean).join(' ');

    // 补全关联法条
    if (isEmpty(c['关联法条'], 5)) {
      const refs = extractLawRefs(allText);
      if (refs) {
        c['关联法条'] = refs;
        filledLaw++;
      }
    }

    // 补全关键词
    if (isEmpty(c['检索关键词'], 5)) {
      const kw = generateKeywords(allText);
      if (kw) {
        c['检索关键词'] = kw;
        filledKW++;
      }
    }

    // 判决结果：如果已有部分内容（如诉讼过程），保留不动
    // 如果完全为空，尝试从裁判要点中提取最后的判决性描述
    if (isEmpty(c['判决结果'], 20) && c['裁判要点']) {
      // 从裁判要点末尾提取可能的判决结果
      const pointEnd = c['裁判要点'].substring(Math.max(0, c['裁判要点'].length - 200));
      const verdictMatch = pointEnd.match(/(?:判决|裁定|决定|判处|支持|驳回|维持|撤销|改判).*?(?:[。\.]|$)/);
      if (verdictMatch) {
        c['判决结果'] = verdictMatch[0].trim();
        filledVerdict++;
      }
    }
  }

  console.log('\n补全统计:');
  console.log('  关联法条补全: ' + filledLaw + ' 例');
  console.log('  关键词补全: ' + filledKW + ' 例');
  console.log('  判决结果补全: ' + filledVerdict + ' 例');

  // 4. 删除无效案例（关联法条、裁判要点、判决结果 全部为空）
  console.log('\n[清理无效数据]');
  const beforeClean = cases.length;
  const cleaned = cases.filter(c => {
    const el = isEmpty(c['关联法条'], 5);
    const ep = isEmpty(c['裁判要点'], 20);
    const ev = isEmpty(c['判决结果'], 20);
    return !(el && ep && ev);
  });
  console.log('  删除无效案例: ' + (beforeClean - cleaned.length) + ' 例');
  console.log('  保留案例: ' + cleaned.length + ' 例');

  // 5. 最终统计
  const types = {};
  cleaned.forEach(c => { types[c['案件类型']] = (types[c['案件类型']] || 0) + 1; });
  console.log('\n案件类型分布:');
  for (const [k, v] of Object.entries(types).sort()) console.log('  ' + k + ': ' + v);

  console.log('\n补全后质量:');
  ['关联法条', '裁判要点', '判决结果', '检索关键词', '案情摘要'].forEach(field => {
    const minLen = (field === '检索关键词' || field === '关联法条') ? 5 : 20;
    const cnt = cleaned.filter(c => isEmpty(c[field], minLen)).length;
    console.log('  ' + field + ' 缺失: ' + cnt + '/' + cleaned.length + ' (' + (cnt/cleaned.length*100).toFixed(1) + '%)');
  });

  // 6. 写入
  fs.writeFileSync(CASES_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log('\n=== 完成 ===');
  console.log('最终案例数: ' + cleaned.length + ' 例');
  console.log('输出文件: ' + CASES_FILE);
}

main();
