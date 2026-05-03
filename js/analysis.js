// ============================================================
// 法简AI - 案情解析页核心逻辑
// 双录入模式 / API 编排 / 权限控制 / 结果渲染
// ============================================================

(function () {
  'use strict';

  // ---------- 案由分类数据 ----------
  const SUB_CATEGORIES = {
    '刑法': [
      '故意杀人罪', '过失致人死亡罪', '故意伤害罪', '强奸罪',
      '抢劫罪', '盗窃罪', '诈骗罪', '贪污罪', '受贿罪',
      '交通肇事罪', '危险驾驶罪', '寻衅滋事罪', '职务侵占罪',
      '挪用公款罪', '非法经营罪', '走私罪', '贩毒罪', '其他刑事案由'
    ],
    '民法': [
      '合同纠纷', '侵权纠纷', '婚姻家庭纠纷', '继承纠纷',
      '物权纠纷', '债权纠纷', '劳动争议', '知识产权纠纷',
      '公司股权纠纷', '房屋买卖纠纷', '租赁合同纠纷',
      '借款合同纠纷', '建设工程纠纷', '医疗损害纠纷', '其他民事案由'
    ],
    '行政法': [
      '行政处罚', '行政许可', '行政强制', '行政征收',
      '行政协议', '行政复议', '行政赔偿', '政府信息公开',
      '工伤认定', '不动产登记', '其他行政案由'
    ]
  };

  // ---------- DOM 引用 ----------
  let dom = {};

  function cacheDOM() {
    dom.offlineBanner  = Utils.$('#offline-banner');
    dom.vipBadge       = Utils.$('#nav-vip-badge');
    dom.quotaBar       = Utils.$('#quota-bar');
    dom.quotaRemaining = Utils.$('#quota-remaining');
    dom.btnQuotaUnlock = Utils.$('#btn-quota-unlock');

    // 输入区
    dom.tabBtns        = Utils.$$('.tab-btn');
    dom.panelStruct    = Utils.$('#panel-structured');
    dom.panelFreetext  = Utils.$('#panel-freetext');
    dom.categoryGroup  = Utils.$('#category-group');
    dom.subcategoryGrp = Utils.$('#subcategory-group');
    dom.inputFacts     = Utils.$('#input-facts');
    dom.inputDamage    = Utils.$('#input-damage');
    dom.inputEvidence  = Utils.$('#input-evidence');
    dom.inputFreetext  = Utils.$('#input-freetext');
    dom.btnAnalyze     = Utils.$('#btn-analyze');
    dom.submitHint     = Utils.$('#submit-hint');

    // 结果区
    dom.resultsSection = Utils.$('#results-section');
    dom.resultAI       = Utils.$('#result-ai');
    dom.resultAIBody   = Utils.$('#result-ai-body');
    dom.resultLaw      = Utils.$('#result-law');
    dom.resultLawBody  = Utils.$('#result-law-body');
    dom.resultExplain  = Utils.$('#result-explain');
    dom.resultExplainBody = Utils.$('#result-explain-body');
    dom.resultCase     = Utils.$('#result-case');
    dom.resultCaseBody = Utils.$('#result-case-body');

    // 锁定弹窗
    dom.lockModal      = Utils.$('#lock-modal');
    dom.lockKeyInput   = Utils.$('#lock-key-input');
    dom.lockBtnSubmit  = Utils.$('#btn-lock-submit');
    dom.lockBtnClose   = Utils.$('#btn-lock-close');
    dom.lockStatusMsg  = Utils.$('#lock-status-msg');

    // VIP 弹窗
    dom.vipModal       = Utils.$('#vip-modal');
    dom.vipKeyInput    = Utils.$('#vip-key-input');
    dom.vipBtnSubmit   = Utils.$('#btn-vip-submit');
    dom.vipBtnClose   = Utils.$('#btn-vip-close');
    dom.vipStatusMsg   = Utils.$('#vip-status-msg');
  }

  // ---------- 状态 ----------
  let currentTab = 'structured';   // 'structured' | 'freetext'
  let isAnalyzing = false;
  let lockModalShown = false;      // 同会话只弹一次
  let vikaAbortController = null;
  // 缓存最近一次检索数据，供VIP解锁后即时刷新渲染
  let cachedLawData = null;
  let cachedExplainData = null;
  let cachedCaseData = null;

  // ---------- 初始化 ----------

  function init() {
    cacheDOM();
    updateVIPBadge();
    updateQuotaBar();
    renderSubCategories('刑法'); // 默认刑法
    bindTabEvents();
    bindCategoryEvents();
    bindAnalyzeButton();
    bindLockModal();
    bindVIPModal();
    bindCopyButtons();
    bindUnlockLinks();
    listenNetwork();
    checkInitialLock();
  }

  // ---------- 权限状态 ----------

  function updateVIPBadge() {
    const status = Auth.getStatus();
    if (status.isVIP) {
      Utils.setText(dom.vipBadge, '永久VIP');
      Utils.addClass(dom.vipBadge, 'is-vip');
    } else {
      Utils.setText(dom.vipBadge, '免费试用');
      Utils.removeClass(dom.vipBadge, 'is-vip');
    }
  }

  function updateQuotaBar() {
    const status = Auth.getStatus();
    if (status.isVIP) {
      Utils.setHTML(dom.quotaRemaining,
        '<span class="count">无限</span> 次解析（永久VIP）');
      Utils.hide(dom.btnQuotaUnlock);
    } else if (status.isTrialUsed) {
      Utils.setHTML(dom.quotaRemaining,
        '剩余 <span class="count danger">0</span> 次免费解析');
      Utils.show(dom.btnQuotaUnlock);
      lockAllInputs();
    } else {
      Utils.setHTML(dom.quotaRemaining,
        '剩余 <span class="count">1</span> 次免费解析');
      Utils.show(dom.btnQuotaUnlock);
      unlockAllInputs();
    }
  }

  // ---------- 初始锁定检查 ----------

  function checkInitialLock() {
    const status = Auth.getStatus();
    if (!status.canAnalyze && !status.isVIP) {
      lockAllInputs();
      // 延迟弹出锁定弹窗，确保DOM已完全渲染
      setTimeout(function() { showLockModal(); }, 300);
    }
  }

  // ---------- 输入锁定/解锁 ----------

  function lockAllInputs() {
    // 禁用所有表单控件
    const inputs = Utils.$$('input, textarea, select, .radio-item input, .checkbox-item input', document);
    inputs.forEach(el => {
      el.disabled = true;
    });
    // 禁用Tab切换按钮
    dom.tabBtns.forEach(btn => {
      btn.disabled = true;
      btn.classList.add('disabled');
    });
    // 解析按钮
    if (dom.btnAnalyze) {
      dom.btnAnalyze.disabled = true;
      dom.btnAnalyze.classList.add('disabled');
    }
    if (dom.submitHint) {
      Utils.setText(dom.submitHint, '免费次数已用尽，请解锁VIP');
    }
  }

  function unlockAllInputs() {
    const inputs = Utils.$$('input, textarea, select, .radio-item input, .checkbox-item input', document);
    inputs.forEach(el => {
      el.disabled = false;
    });
    // 恢复Tab切换按钮
    dom.tabBtns.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('disabled');
    });
    if (dom.btnAnalyze) {
      dom.btnAnalyze.disabled = false;
      dom.btnAnalyze.classList.remove('disabled');
    }
    if (dom.submitHint) {
      Utils.setText(dom.submitHint, '');
    }
  }

  function fullUnlock() {
    const inputs = Utils.$$('input, textarea, select, .radio-item input, .checkbox-item input', document);
    inputs.forEach(el => {
      el.disabled = false;
    });
    // 恢复Tab切换按钮
    dom.tabBtns.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('disabled');
    });
    if (dom.btnAnalyze) {
      dom.btnAnalyze.disabled = false;
      dom.btnAnalyze.classList.remove('disabled');
    }
    if (dom.submitHint) {
      Utils.setText(dom.submitHint, '');
    }
    // 重新渲染案由（恢复可用状态）
    const selectedCat = getSelectedCategory() || '刑法';
    renderSubCategories(selectedCat);
  }

  // ---------- Tab 切换 ----------

  function bindTabEvents() {
    dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const tabId = this.getAttribute('data-tab');
        switchTab(tabId);
      });
    });
  }

  function switchTab(tabId) {
    // 权限前置校验
    const status = Auth.getStatus();
    if (!status.canAnalyze && !status.isVIP) {
      showLockModal();
      return;
    }

    currentTab = tabId;

    // 更新 Tab UI
    dom.tabBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
    dom.panelStruct.classList.toggle('active', tabId === 'structured');
    dom.panelFreetext.classList.toggle('active', tabId === 'freetext');

    // 清空另一模式的输入内容（双输入互斥逻辑）
    if (tabId === 'structured') {
      Utils.setValue(dom.inputFreetext, '');
    } else {
      clearStructuredForm();
    }
  }

  function clearStructuredForm() {
    Utils.setValue(dom.inputFacts, '');
    Utils.setValue(dom.inputDamage, '');
    Utils.setValue(dom.inputEvidence, '');
    // 清除案由勾选
    const checks = Utils.$$('input[name="subcategory"]:checked');
    checks.forEach(c => { c.checked = false; });
  }

  // ---------- 大类切换 → 动态加载案由 ----------

  function bindCategoryEvents() {
    const radios = Utils.$$('input[name="category"]');
    radios.forEach(radio => {
      radio.addEventListener('change', function () {
        if (this.checked) {
          renderSubCategories(this.value);
        }
      });
    });
  }

  function renderSubCategories(category) {
    const list = SUB_CATEGORIES[category] || [];
    const isLocked = !Auth.getStatus().canAnalyze && !Auth.getStatus().isVIP;
    let html = '';
    list.forEach(item => {
      html += [
        '<div class="checkbox-item">',
          '<input type="checkbox" name="subcategory" value="' + Utils.escapeHTML(item) + '"',
          ' id="sc_' + item.replace(/[^a-zA-Z一-龥]/g, '') + '"',
          isLocked ? ' disabled' : '',
          '>',
          '<label for="sc_' + item.replace(/[^a-zA-Z一-龥]/g, '') + '">',
            Utils.escapeHTML(item),
          '</label>',
        '</div>'
      ].join('');
    });
    Utils.setHTML(dom.subcategoryGrp, html);
  }

  function getSelectedCategory() {
    const checked = Utils.$('input[name="category"]:checked');
    return checked ? checked.value : null;
  }

  function getSelectedSubCategories() {
    const checks = Utils.$$('input[name="subcategory"]:checked');
    return checks.map(c => c.value);
  }

  // ---------- 收集输入内容 ----------

  function collectStructuredInput() {
    const category = getSelectedCategory();
    if (!category) return null;

    const subCategories = getSelectedSubCategories();
    const facts    = Utils.trim(Utils.getValue(dom.inputFacts));
    const damage   = Utils.trim(Utils.getValue(dom.inputDamage));
    const evidence = Utils.trim(Utils.getValue(dom.inputEvidence));

    // 至少需有案由或行为事实
    if (subCategories.length === 0 && !facts) return null;

    let text = '【案件类型】' + category;
    if (subCategories.length > 0) {
      text += ' - ' + subCategories.join('、');
    }
    if (facts)    text += '\n【行为事实】' + facts;
    if (damage)   text += '\n【损害结果】' + damage;
    if (evidence) text += '\n【证据情况】' + evidence;

    return { text, category };
  }

  function collectFreetextInput() {
    const text = Utils.trim(Utils.getValue(dom.inputFreetext));
    if (!text) return null;
    // 自由文本无明确大类，默认民法
    return { text, category: '民法' };
  }

  function collectInput() {
    if (currentTab === 'structured') {
      return collectStructuredInput();
    }
    return collectFreetextInput();
  }

  // ---------- 解析按钮 ----------

  function bindAnalyzeButton() {
    dom.btnAnalyze.addEventListener('click', async function () {
      if (isAnalyzing) return;

      // ---- 第一重：点击按钮权限校验 ----
      const status = Auth.getStatus();
      if (!status.canAnalyze && !status.isVIP) {
        showLockModal();
        return;
      }

      // 收集输入
      const input = collectInput();
      if (!input) {
        Components.showToast('请输入案情内容后再解析', 'warning');
        return;
      }

      // ---- 第二重：接口前权限校验 ----
      if (!Auth.canAnalyze()) {
        showLockModal();
        return;
      }

      // 网络检查
      if (!Utils.isOnline()) {
        Components.showToast('当前网络已断开，请检查网络连接', 'error');
        return;
      }

      // 开始解析
      await runAnalysis(input);
    });
  }

  // ---------- 核心解析流程 ----------

  async function runAnalysis(input) {
    isAnalyzing = true;
    setButtonLoading(true);

    // 清空历史结果
    clearResults();
    Utils.show(dom.resultsSection);

    // 骨架屏
    Components.showSkeleton('#result-ai-body', 6);
    Components.showSkeleton('#result-law-body', 4);
    Components.showSkeleton('#result-explain-body', 4);
    Components.showSkeleton('#result-case-body', 4);

    // 滚动到结果区
    dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    let deepseekResult = null;
    let keywords = [];
    const isVIP = Auth.isVIP();

    // 非VIP立即标记试用（在AI调用前持久化，防止并发绕过）
    if (!isVIP) {
      Auth.markTrialUsed();
      updateQuotaBar();
    }

    try {
      // ------ Step 1: DeepSeek 解析 ------
      deepseekResult = await DeepSeekAPI.analyze(input.text, input.category);
      keywords = deepseekResult.keywords || [];

      // 渲染 AI 分析
      renderAIResult(deepseekResult);

    } catch (err) {
      // DeepSeek 失败 → 降级：隐藏 AI 板块，仅提示
      const msg = DeepSeekAPI.getErrorMessage(err.message);
      Components.showError('#result-ai-body', msg);
      // AI 失败不影响后续维格表检索
      // 兜底关键词
      keywords = Config.getFallbackKeywords(input.category)
        .split(',').map(k => k.trim()).filter(Boolean);
    }

    // ------ Step 2: 并行调用维格表三张表 ------
    vikaAbortController = new AbortController();
    const signal = vikaAbortController.signal;

    const lawPromise = VikaAPI.getLawData(keywords, isVIP, signal, input.category)
      .then(data => renderLawData(data, isVIP))
      .catch(err => {
        if (err.name !== 'AbortError') {
          Components.showError('#result-law-body', VikaAPI.getErrorMessage(err.message));
        }
      });

    const explainPromise = VikaAPI.getExplainData(keywords, isVIP, signal, input.category)
      .then(data => renderExplainData(data, isVIP))
      .catch(err => {
        if (err.name !== 'AbortError') {
          Components.showError('#result-explain-body', VikaAPI.getErrorMessage(err.message));
        }
      });

    const casePromise = VikaAPI.getCaseData(keywords, isVIP, signal, input.category)
      .then(data => renderCaseData(data, isVIP))
      .catch(err => {
        if (err.name !== 'AbortError') {
          Components.showError('#result-case-body', VikaAPI.getErrorMessage(err.message));
        }
      });

    await Promise.allSettled([lawPromise, explainPromise, casePromise]);

    vikaAbortController = null;
    isAnalyzing = false;
    setButtonLoading(false);

    // 非VIP → 次数耗尽后锁定
    if (!isVIP) {
      updateQuotaBar();
      if (!Auth.canAnalyze()) {
        lockAllInputs();
        showLockModal();
      }
    }
  }

  // ---------- 渲染 AI 结果 ----------

  function renderAIResult(result) {
    if (!result || !result.sections) {
      // 格式错乱兜底：原生渲染 rawText
      const raw = result && result.rawText ? result.rawText : 'AI未返回有效分析内容';
      const mdHtml = Markdown.render(raw);
      Utils.setHTML(dom.resultAIBody, '<div class="ai-card"><div class="card-body">' + mdHtml + '</div></div>');
      return;
    }

    const s = result.sections;
    const sections = [
      { key: 'facts',         title: '案件事实重梳' },
      { key: 'disputes',      title: '法律争议焦点' },
      { key: 'qualification', title: '行为法律定性' },
      { key: 'elements',      title: '构成要件分析' },
      { key: 'evaluation',    title: '完整法律评析' }
    ];

    let html = '';
    sections.forEach(sec => {
      const content = s[sec.key] || '';
      if (content) {
        html += '<h3>【' + sec.title + '】</h3>';
        html += Markdown.render(content);
      }
    });

    // 若所有 section 为空，兜底渲染 rawText
    if (!html.trim()) {
      const raw = result.rawText || 'AI未返回有效分析内容';
      html = Markdown.render(raw);
    }

    Utils.setHTML(dom.resultAIBody, html);
  }

  // ---------- 渲染法条 ----------

  function renderLawData(data, isVIP) {
    cachedLawData = data;
    if (!data || data.length === 0) {
      Components.showEmpty('#result-law-body', '暂无匹配法条');
      return;
    }

    let html = '';
    data.forEach(item => {
      const text = isVIP ? (item.fullText || item.summary || '') : (item.summary || '');
      html += [
        '<div class="law-item">',
          '<div class="law-number">' + Utils.escapeHTML(item.number || item.id || '') + '</div>',
          item.chapter ? '<div class="law-chapter">' + Utils.escapeHTML(item.chapter) + '</div>' : '',
          '<div class="law-text">' + Utils.escapeHTML(text) + '</div>',
          item.category ? '<span class="law-category">' + Utils.escapeHTML(item.category) + '</span>' : '',
          !isVIP ? '<div class="vip-lock-tip">完整法条原文仅VIP可见，<span class="unlock-link" data-action="unlock">立即解锁</span></div>' : '',
        '</div>'
      ].join('');
    });

    Utils.setHTML(dom.resultLawBody, html);

    // 重新绑定解锁链接
    bindUnlockLinksIn(dom.resultLawBody);
  }

  // ---------- 渲染司法解释 ----------

  function renderExplainData(data, isVIP) {
    cachedExplainData = data;
    if (!data || data.length === 0) {
      Components.showEmpty('#result-explain-body', '暂无匹配司法解释');
      return;
    }

    let html = '';
    data.forEach(item => {
      const text = isVIP ? (item.fullText || item.summary || '') : (item.summary || '');
      html += [
        '<div class="explain-item">',
          '<div class="explain-name">' + Utils.escapeHTML(item.name || '') + '</div>',
          '<div class="explain-meta">',
            '发布单位：' + Utils.escapeHTML(item.publisher || '') + ' | ',
            '关联法条：' + Utils.escapeHTML(item.lawNumber || ''),
          '</div>',
          '<div class="explain-text">' + Utils.escapeHTML(text) + '</div>',
          !isVIP ? '<div class="vip-lock-tip">完整解释原文仅VIP可见，<span class="unlock-link" data-action="unlock">立即解锁</span></div>' : '',
        '</div>'
      ].join('');
    });

    Utils.setHTML(dom.resultExplainBody, html);
    bindUnlockLinksIn(dom.resultExplainBody);
  }

  // ---------- 渲染判例 ----------

  function renderCaseData(data, isVIP) {
    cachedCaseData = data;
    if (!data || data.length === 0) {
      Components.showEmpty('#result-case-body', '暂无匹配参考判例');
      return;
    }

    let html = '';
    data.forEach(item => {
      html += [
        '<div class="case-item">',
          item.caseType ? '<span class="case-type">' + Utils.escapeHTML(item.caseType) + '</span>' : '',
          item.relatedLaw ? '<div class="case-law-ref">关联法条：' + Utils.escapeHTML(item.relatedLaw) + '</div>' : '',
          '<div class="case-summary">' + Utils.escapeHTML(item.summary || item.judgePoint || '') + '</div>',
          isVIP && item.verdict
            ? '<div class="case-verdict"><strong>判决结果：</strong>' + Utils.escapeHTML(item.verdict) + '</div>'
            : '',
          !isVIP ? '<div class="vip-lock-tip">完整判决结果仅VIP可见，<span class="unlock-link" data-action="unlock">立即解锁</span></div>' : '',
        '</div>'
      ].join('');
    });

    Utils.setHTML(dom.resultCaseBody, html);
    bindUnlockLinksIn(dom.resultCaseBody);
  }

  // ---------- VIP解锁后即时刷新 ----------

  function refreshResultsForVIP() {
    if (cachedLawData && Array.isArray(cachedLawData) && cachedLawData.length > 0) {
      renderLawData(cachedLawData, true);
    }
    if (cachedExplainData && cachedExplainData.length > 0) {
      renderExplainData(cachedExplainData, true);
    }
    if (cachedCaseData && cachedCaseData.length > 0) {
      renderCaseData(cachedCaseData, true);
    }
  }

  // ---------- 清空结果 ----------

  function clearResults() {
    cachedLawData = null;
    cachedExplainData = null;
    cachedCaseData = null;
    Utils.setHTML(dom.resultAIBody, '');
    Utils.setHTML(dom.resultLawBody, '');
    Utils.setHTML(dom.resultExplainBody, '');
    Utils.setHTML(dom.resultCaseBody, '');
  }

  // ---------- 按钮加载态 ----------

  function setButtonLoading(loading) {
    if (loading) {
      dom.btnAnalyze.disabled = true;
      dom.btnAnalyze.classList.add('disabled');
      Utils.setText(dom.btnAnalyze, '解析中...');
    } else {
      dom.btnAnalyze.disabled = false;
      dom.btnAnalyze.classList.remove('disabled');
      Utils.setText(dom.btnAnalyze, '开始AI解析');
    }
  }

  // ---------- 锁定弹窗 ----------

  function bindLockModal() {
    if (!dom.lockModal) return;

    function show() {
      if (lockModalShown) return;  // 同会话仅弹一次
      lockModalShown = true;

      dom.lockModal.classList.remove('hidden');

      // 禁止 ESC
      dom.lockModal._escHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      document.addEventListener('keydown', dom.lockModal._escHandler, true);

      // 禁止浏览器返回
      dom.lockModal._popHandler = function (e) {
        e.preventDefault();
        history.pushState(null, '', location.href);
      };
      history.pushState(null, '', location.href);
      window.addEventListener('popstate', dom.lockModal._popHandler);
    }

    function hide() {
      dom.lockModal.classList.add('hidden');
      if (dom.lockModal._escHandler) {
        document.removeEventListener('keydown', dom.lockModal._escHandler, true);
      }
      if (dom.lockModal._popHandler) {
        window.removeEventListener('popstate', dom.lockModal._popHandler);
      }
      Utils.setValue(dom.lockKeyInput, '');
      Utils.setText(dom.lockStatusMsg, '');
      dom.lockStatusMsg.className = 'vip-status-msg';
    }

    function submitKey() {
      const key = Utils.trim(Utils.getValue(dom.lockKeyInput));
      if (!key) {
        Utils.setText(dom.lockStatusMsg, '请输入VIP密钥');
        dom.lockStatusMsg.className = 'vip-status-msg error';
        return;
      }

      if (Auth.validateVipKey(key)) {
        Auth.setVIP();
        Utils.setText(dom.lockStatusMsg, '解锁成功！已获得永久VIP权限');
        dom.lockStatusMsg.className = 'vip-status-msg success';
        updateVIPBadge();
        updateQuotaBar();
        fullUnlock();
        refreshResultsForVIP();
        Components.showToast('永久VIP已解锁，享无限解析次数', 'success');
        setTimeout(hide, 1200);
      } else {
        Utils.setText(dom.lockStatusMsg, '密钥无效，请检查后重试');
        dom.lockStatusMsg.className = 'vip-status-msg error';
      }
    }

    // 事件绑定
    if (dom.lockBtnSubmit) {
      dom.lockBtnSubmit.addEventListener('click', submitKey);
    }
    if (dom.lockKeyInput) {
      dom.lockKeyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitKey();
      });
    }
    if (dom.lockBtnClose) {
      dom.lockBtnClose.addEventListener('click', hide);
    }

    // 暴露到模块作用域
    window._showLockModal = show;
    window._hideLockModal = hide;
  }

  function showLockModal() {
    if (window._showLockModal) {
      window._showLockModal();
    }
  }

  // ---------- VIP 主动解锁弹窗 ----------

  function bindVIPModal() {
    if (!dom.vipModal) return;

    function show() {
      if (Auth.isVIP()) {
        Components.showToast('您已是永久VIP', 'success');
        return;
      }
      dom.vipModal.classList.remove('hidden');

      dom.vipModal._escHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      document.addEventListener('keydown', dom.vipModal._escHandler, true);

      dom.vipModal._popHandler = function (e) {
        e.preventDefault();
        history.pushState(null, '', location.href);
      };
      history.pushState(null, '', location.href);
      window.addEventListener('popstate', dom.vipModal._popHandler);
    }

    function hide() {
      dom.vipModal.classList.add('hidden');
      if (dom.vipModal._escHandler) {
        document.removeEventListener('keydown', dom.vipModal._escHandler, true);
      }
      if (dom.vipModal._popHandler) {
        window.removeEventListener('popstate', dom.vipModal._popHandler);
      }
      Utils.setValue(dom.vipKeyInput, '');
      Utils.setText(dom.vipStatusMsg, '');
      dom.vipStatusMsg.className = 'vip-status-msg';
    }

    function submitKey() {
      const key = Utils.trim(Utils.getValue(dom.vipKeyInput));
      if (!key) {
        Utils.setText(dom.vipStatusMsg, '请输入VIP密钥');
        dom.vipStatusMsg.className = 'vip-status-msg error';
        return;
      }

      if (Auth.validateVipKey(key)) {
        Auth.setVIP();
        Utils.setText(dom.vipStatusMsg, '解锁成功！您已是永久VIP');
        dom.vipStatusMsg.className = 'vip-status-msg success';
        updateVIPBadge();
        updateQuotaBar();
        fullUnlock();
        refreshResultsForVIP();
        Components.showToast('永久VIP已解锁，享无限解析次数', 'success');
        setTimeout(hide, 1200);
      } else {
        Utils.setText(dom.vipStatusMsg, '密钥无效，请检查后重试');
        dom.vipStatusMsg.className = 'vip-status-msg error';
      }
    }

    if (dom.vipBtnSubmit) {
      dom.vipBtnSubmit.addEventListener('click', submitKey);
    }
    if (dom.vipKeyInput) {
      dom.vipKeyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitKey();
      });
    }
    if (dom.vipBtnClose) {
      dom.vipBtnClose.addEventListener('click', hide);
    }

    window._openVIPModal = show;
    window._closeVIPModal = hide;
  }

  // ---------- 解锁链接绑定 ----------

  function bindUnlockLinks() {
    if (dom.btnQuotaUnlock) {
      dom.btnQuotaUnlock.addEventListener('click', function () {
        if (window._openVIPModal) window._openVIPModal();
      });
    }
  }

  function bindUnlockLinksIn(container) {
    const links = Utils.$$('[data-action="unlock"]', container);
    links.forEach(link => {
      link.addEventListener('click', function () {
        if (window._openVIPModal) window._openVIPModal();
      });
    });
  }

  // ---------- 复制按钮 ----------

  function bindCopyButtons() {
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-copy-target]');
      if (!btn) return;

      const targetId = btn.getAttribute('data-copy-target');
      const target = Utils.$('#' + targetId);
      if (!target) return;

      const text = target.textContent || target.innerText || '';
      Utils.copyToClipboard(text).then(() => {
        btn.classList.add('copied');
        const orig = btn.textContent;
        btn.textContent = '已复制';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = orig;
        }, 2000);
      }).catch(() => {
        Components.showToast('复制失败，请手动选择文本复制', 'error');
      });
    });
  }

  // ---------- 网络监听 ----------

  function listenNetwork() {
    function update() {
      if (Utils.isOnline()) {
        Utils.removeClass(dom.offlineBanner, 'show');
      } else {
        Utils.addClass(dom.offlineBanner, 'show');
        // 断网时终止请求
        if (isAnalyzing) {
          DeepSeekAPI.abort();
          if (vikaAbortController) {
            vikaAbortController.abort();
          }
          isAnalyzing = false;
          setButtonLoading(false);
        }
      }
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  // ---------- 启动 ----------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
