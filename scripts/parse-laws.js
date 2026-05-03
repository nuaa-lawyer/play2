// ============================================================
// 法简AI - 法条数据解析脚本 v3
// 从 E:/law-source 自动读取、识别、去重、结构化写入 laws.json
// 支持: TXT / DOCX / PDF (多格式)
// 识别: 第X条 / #### 第X条 / **第X条** / - 第X条
// ============================================================

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const mammoth = require('mammoth');

const SOURCE_DIR = 'E:/law-source';
const OUTPUT_FILE = 'C:/Users/welcome/fajian-ai/laws.json';

// ============================================================
// 排除规则
// ============================================================
const EXCLUDE_DIR_NAMES = new Set(['司法解释', '三次修订版', '二次修订版', '2014年一修版']);
const EXCLUDE_DIR_PREFIXES = [
  '404-公安机关', '405-人民检察院', '406-关于办理刑事案件',
];
const EXCLUDE_FILE_PATTERNS = [
  '司法解释', '的解释【', '若干问题的解释', '若干问题的规定',
  '适用解释', '法律适用问题', '管辖和法律适用',
  '办理刑事案件', '严格排除非法证据', '关于商标法修改决定',
  '审判监督程序', '执行程序若干', '民事诉讼证据的若干规定',
];

// ============================================================
// 法律规范化名称
// ============================================================
const LAW_NAMES = [
  '中华人民共和国宪法', '中华人民共和国刑法', '中华人民共和国民法典',
  '中华人民共和国民事诉讼法', '中华人民共和国刑事诉讼法', '中华人民共和国行政诉讼法',
  '中华人民共和国公司法', '中华人民共和国合伙企业法', '中华人民共和国企业破产法',
  '中华人民共和国票据法', '中华人民共和国证券法', '中华人民共和国保险法',
  '中华人民共和国海商法', '中华人民共和国劳动法', '中华人民共和国劳动合同法',
  '中华人民共和国劳动争议调解仲裁法', '中华人民共和国著作权法', '中华人民共和国著作权法实施条例',
  '中华人民共和国专利法', '中华人民共和国专利法实施细则',
  '中华人民共和国商标法', '中华人民共和国商标法实施条例',
  '中华人民共和国消费者权益保护法', '中华人民共和国招标投标法', '中华人民共和国招标投标法实施条例',
  '中华人民共和国反不正当竞争法', '中华人民共和国城市房地产管理法', '中华人民共和国食品安全法',
  '中华人民共和国公务员法', '中华人民共和国行政许可法', '中华人民共和国行政处罚法',
  '中华人民共和国行政强制法', '中华人民共和国行政复议法', '中华人民共和国行政复议法实施条例',
  '中华人民共和国劳动合同法实施条例',
];

// ============================================================
// 分类
// ============================================================
function getCategory(lawName) {
  if (lawName.includes('刑法') && !lawName.includes('行政复议') && !lawName.includes('行政')) return '刑法';
  if (lawName.includes('刑事诉讼法')) return '刑法';
  if (lawName.includes('宪法')) return '宪法';
  if (lawName.includes('民法典')) return '民法';
  for (const n of ['公司法', '合伙企业法', '企业破产法', '票据法', '证券法', '保险法', '海商法', '消费者权益保护法', '招标投标法', '城市房地产管理法', '食品安全法', '著作权法', '专利法', '商标法', '反不正当竞争法', '民事诉讼法']) {
    if (lawName.includes(n)) return '民商法';
  }
  for (const n of ['劳动法', '劳动合同法', '劳动争议调解仲裁法']) {
    if (lawName.includes(n)) return '社会法';
  }
  for (const n of ['行政诉讼法', '公务员法', '行政许可法', '行政处罚法', '行政强制法', '行政复议法']) {
    if (lawName.includes(n)) return '行政法';
  }
  return '民法';
}

// ============================================================
// 排除判断
// ============================================================
function shouldExclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(filePath, path.extname(filePath));
  for (const dirName of EXCLUDE_DIR_NAMES) {
    if (normalized.includes('/' + dirName + '/') || normalized.includes('\\' + dirName + '\\')) return true;
  }
  for (const prefix of EXCLUDE_DIR_PREFIXES) {
    if (normalized.includes(prefix)) return true;
  }
  for (const pattern of EXCLUDE_FILE_PATTERNS) {
    if (basename.includes(pattern)) return true;
  }
  return false;
}

// ============================================================
// 文件读取（自动编码检测）
// ============================================================
function readTxtFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString('utf-8', 3);
  }
  try {
    const utf8 = buffer.toString('utf-8');
    let garbled = false;
    for (let i = 0; i < Math.min(utf8.length, 200); i++) {
      const code = utf8.charCodeAt(i);
      if (code === 0xFFFD || (code >= 0x80 && code < 0xA0 && code !== 0xA0)) {
        garbled = true; break;
      }
    }
    if (!garbled) return utf8;
  } catch (e) {}
  try { return iconv.decode(buffer, 'gbk'); } catch (e) {}
  return buffer.toString('utf-8');
}

async function readDocxFile(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.txt') return readTxtFile(filePath);
  if (ext === '.docx' || ext === '.doc') return await readDocxFile(filePath);
  // .epub / .mobi / .pdf 暂不处理
  return null;
}

// ============================================================
// 提取法律名称
// ============================================================
function extractLawName(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  let name = basename
    .replace(/【.*?】/g, '').replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '').replace(/\d{4}/g, '')
    .replace(/^\d+[-_]/g, '').replace(/^\./, '').trim();
  for (const stdName of LAW_NAMES) {
    if (name.includes(stdName)) return stdName;
    const short = stdName.replace('中华人民共和国', '');
    if (name.includes(short) && name.length >= short.length) return stdName;
  }
  return name || basename;
}

// ============================================================
// 核心解析
// ============================================================
const ARTICLE_REGEX = /第[一二三四五六七八九十百千]+条(?:之[一二三四五六七八九十])?/;

function hasArticle(line) {
  return ARTICLE_REGEX.test(line);
}

function extractArticle(line) {
  const match = line.match(/(第[一二三四五六七八九十百千]+条(?:之[一二三四五六七八九十])?)[\s　]*(.*)/);
  if (!match) return null;
  return { number: match[1], text: match[2] || '' };
}

function stripFormatting(line) {
  return line
    .replace(/^#{1,4}\s*/, '')      // ### headers
    .replace(/^\-\s*/, '')           // - list
    .replace(/^\*\*/, '')            // ** bold start
    .replace(/\*\*$/, '')            // ** bold end
    .replace(/^【/, '')              // 【 start
    .replace(/】$/, '')              // 】 end
    .trim();
}

function parseLawContent(content, lawName, category) {
  if (!content) return { articles: [], articleCount: 0 };

  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  content = content.replace(/^本电子书由[^\n]*\n/gm, '');

  const lines = content.split('\n');
  let currentPart = '';
  let currentChapter = '';
  let currentSection = '';
  let currentArticle = null;
  const articles = [];
  let foundFirstArticle = false;

  function isPartHeader(l) { return /^#{0,4}\s*第[一二三四五六七八九十百千]+编/.test(l); }
  function isChapterHeader(l) { return /^#{0,4}\s*第[一二三四五六七八九十百千]+章/.test(l); }
  function isSectionHeader(l) { return /^#{0,4}\s*第[一二三四五六七八九十百千]+节/.test(l); }
  function isTOCLine(l) {
    const c = l.replace(/^#+\s*/, '').trim();
    return c === '目录' || c === '目　录' || c === '目 录';
  }
  function isPreambleHeader(l) {
    const c = l.replace(/^#+\s*/, '').trim();
    return c === '序言' || c === '序　言' || c === '序 言';
  }

  function skipTOC(idx) {
    let j = idx + 1;
    while (j < lines.length) {
      const l = lines[j].trim();
      if (!l) { j++; continue; }
      if (isPartHeader(l) || isChapterHeader(l) || isPreambleHeader(l) || hasArticle(l)) break;
      j++;
    }
    return j;
  }

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();
    if (!line) { i++; continue; }

    if (isTOCLine(line)) { i = skipTOC(i); continue; }

    // 跳过标题行和修订历史
    if (!foundFirstArticle) {
      if (/^#\s*中[华華]人[民].*[法法典]/.test(line)) { i++; continue; }
      if ((line.startsWith('（') || line.startsWith('(')) && (line.includes('通过') || line.includes('修正') || line.includes('修订'))) { i++; continue; }
    }

    if (isPartHeader(line)) {
      currentPart = stripFormatting(line); currentChapter = ''; currentSection = ''; i++; continue;
    }
    if (isChapterHeader(line)) {
      currentChapter = stripFormatting(line); currentSection = ''; i++; continue;
    }
    if (isSectionHeader(line)) {
      currentSection = stripFormatting(line); i++; continue;
    }
    if (isPreambleHeader(line)) { i++; continue; }

    if (hasArticle(line)) {
      if (currentArticle) { articles.push(currentArticle); }
      foundFirstArticle = true;

      const extracted = extractArticle(line);
      if (!extracted) { i++; continue; }

      let articleText = extracted.text;
      i++;

      // 收集多行条文
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        if (!nextLine) { i++; continue; }
        if (hasArticle(nextLine) || isPartHeader(nextLine) || isChapterHeader(nextLine) || isSectionHeader(nextLine)) break;
        if ((nextLine.startsWith('（') || nextLine.startsWith('(')) && (nextLine.includes('通过') || nextLine.includes('修正'))) { i++; continue; }
        articleText += '\n' + stripFormatting(nextLine);
        i++;
      }

      let chapterPath = [];
      if (currentPart) chapterPath.push(currentPart);
      if (currentChapter) chapterPath.push(currentChapter);
      if (currentSection) chapterPath.push(currentSection);

      currentArticle = {
        category: category,
        chapter: chapterPath.join(' > '),
        number: extracted.number,
        fullText: articleText.trim(),
        applicable: '',
        keywords: '',
      };
      continue;
    }

    i++;
  }

  if (currentArticle) { articles.push(currentArticle); }

  return { articles, articleCount: articles.length };
}

// ============================================================
// 关键词和案由
// ============================================================
function enrichArticle(article, lawName, category) {
  const keywords = new Set();
  keywords.add(lawName.replace('中华人民共和国', ''));

  if (article.chapter) {
    article.chapter
      .replace(/>/g, ',')
      .replace(/第[一二三四五六七八九十百千]+[编章节]/g, '')
      .replace(/[　\s]+/g, '')
      .split(',')
      .filter(k => k.length > 0 && k.length < 10)
      .forEach(k => keywords.add(k));
  }

  const text = article.fullText;
  const termPatterns = [
    /故意杀人|过失杀人|故意伤害|强奸|抢劫|盗窃|诈骗/g,
    /正当防卫|紧急避险|共同犯罪|单位犯罪/g,
    /管制|拘役|有期徒刑|无期徒刑|死刑|罚金|剥夺政治权利|没收财产/g,
    /累犯|自首|立功|数罪并罚|缓刑|假释|减刑|追诉/g,
    /危害国家安全|危害公共安全|破坏社会主义市场经济|侵犯公民人身/g,
    /贪污|贿赂|渎职|走私|贩毒|寻衅滋事|危险驾驶/g,
    /合同纠纷|侵权|婚姻|继承|物权|债权|人格权/g,
    /劳动|知识产权|公司|证券|保险|票据|破产/g,
    /行政|许可|处罚|强制|复议|诉讼|赔偿/g,
    /海域|船舶|船员|海上|运输|托运/g,
    /食品|安全|标准|检验/g,
    /反不正当|竞争|商业秘密/g,
    /消费|权益|商品|服务/g,
    /招标|投标|中标/g,
  ];
  for (const pattern of termPatterns) {
    const matches = text.match(pattern);
    if (matches) matches.forEach(m => keywords.add(m));
  }

  article.keywords = [...keywords].slice(0, 15).join(',');

  const applicableMap = {
    '刑法': '刑事案件', '宪法': '宪法适用', '民法': '民事纠纷',
    '民商法': '民事纠纷', '行政法': '行政案件', '社会法': '劳动争议',
  };
  article.applicable = applicableMap[category] || '综合';
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log('=== 法简AI 法条数据自动解析 v3 ===\n');

  // 1. 收集所有可解析文件 (.txt, .docx)
  const allFiles = [];
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkDir(fullPath); continue; }
      if (!entry.isFile()) continue;
      if (entry.name.startsWith('.')) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.txt' || ext === '.docx') {
        allFiles.push(fullPath);
      }
    }
  }
  walkDir(SOURCE_DIR);
  console.log('发现可解析文件: ' + allFiles.length + ' 个');

  // 2. 过滤
  const excludedFiles = [];
  const includedFiles = [];
  for (const file of allFiles) {
    if (shouldExclude(file)) { excludedFiles.push(file); }
    else { includedFiles.push(file); }
  }

  console.log('排除（司法解释/旧版）: ' + excludedFiles.length + ' 个');
  excludedFiles.forEach(f => console.log('  [排除] ' + path.basename(f)));

  // 3. 按法律名称分组去重
  const lawGroups = new Map();
  for (const file of includedFiles) {
    const lawName = extractLawName(file);
    if (lawName.length < 4) { console.log('  [跳过] ' + path.basename(file)); continue; }
    if (!lawGroups.has(lawName)) lawGroups.set(lawName, []);
    lawGroups.get(lawName).push(file);
  }

  console.log('\n识别法律（去重后）: ' + lawGroups.size + ' 部');

  // 4. 解析
  const allArticles = [];
  const sortedLaws = [...lawGroups.entries()].sort((a, b) => {
    const ca = getCategory(a[0]), cb = getCategory(b[0]);
    if (ca !== cb) return ca.localeCompare(cb);
    return a[0].localeCompare(b[0]);
  });

  for (const [lawName, files] of sortedLaws) {
    // 优先选最新版本（四修 > 三修 > 二修) 和 .txt > .docx
    let bestFile = files[0];
    // 如果是 .docx 且有 .txt 版本，优先 .txt
    const txtFiles = files.filter(f => f.endsWith('.txt'));
    const docxFiles = files.filter(f => f.endsWith('.docx'));
    if (txtFiles.length > 0) {
      // 在 txt 文件中选最新版本
      bestFile = txtFiles[0];
      for (const suffix of ['四修', '三修', '二修', '一修', '2021', '2020', '2019', '2018', '2017']) {
        const found = txtFiles.find(f => path.basename(f).includes(suffix));
        if (found) { bestFile = found; break; }
      }
    } else if (docxFiles.length > 0) {
      bestFile = docxFiles[0];
    }

    try {
      const ext = path.extname(bestFile).toLowerCase();
      let content = null;
      if (ext === '.txt') {
        content = readTxtFile(bestFile);
      } else if (ext === '.docx') {
        content = await readDocxFile(bestFile);
      }
      const category = getCategory(lawName);
      const result = parseLawContent(content, lawName, category);
      console.log('  [解析] ' + lawName + ' → ' + result.articleCount + ' 条 (' + category + ') [' + path.basename(bestFile) + ']');

      for (const article of result.articles) {
        enrichArticle(article, lawName, category);
        allArticles.push(article);
      }
    } catch (err) {
      console.error('  [错误] ' + lawName + ': ' + err.message);
    }
  }

  // 5. 写入
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allArticles, null, 2), 'utf-8');

  console.log('\n=== 完成 ===');
  console.log('总条目数: ' + allArticles.length + ' 条');

  const categoryStats = {};
  for (const a of allArticles) {
    categoryStats[a.category] = (categoryStats[a.category] || 0) + 1;
  }
  console.log('\n各类别统计:');
  for (const [cat, count] of Object.entries(categoryStats).sort()) {
    console.log('  ' + cat + ': ' + count + ' 条');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
