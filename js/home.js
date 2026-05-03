// ============================================================
// 法简AI - 首页逻辑
// ============================================================

(function () {
  'use strict';

  // ---------- DOM 引用 ----------
  const vipBadge     = Utils.$('#nav-vip-badge');
  const trialInfo    = Utils.$('#hero-trial-info');
  const btnUnlock    = Utils.$('#btn-home-unlock');
  const offlineBanner = Utils.$('#offline-banner');

  // ---------- 初始化 ----------

  function init() {
    updateVIPBadge();
    updateTrialInfo();
    bindEvents();
    listenNetwork();
  }

  // ---------- VIP 徽章 ----------

  function updateVIPBadge() {
    const status = Auth.getStatus();
    if (status.isVIP) {
      Utils.setText(vipBadge, '永久VIP');
      Utils.addClass(vipBadge, 'is-vip');
    } else {
      Utils.setText(vipBadge, '免费试用');
      Utils.removeClass(vipBadge, 'is-vip');
    }
  }

  // ---------- 试用信息 ----------

  function updateTrialInfo() {
    const status = Auth.getStatus();
    if (status.isVIP) {
      Utils.setText(trialInfo, '您已是永久VIP，享无限解析次数');
    } else if (status.isTrialUsed) {
      Utils.setText(trialInfo, '免费次数已用尽，请解锁永久VIP继续使用');
    } else {
      Utils.setText(trialInfo, '您还有 1 次免费解析额度');
    }
  }

  // ---------- 事件绑定 ----------

  function bindEvents() {
    // 解锁按钮
    if (btnUnlock) {
      btnUnlock.addEventListener('click', openVIPModal);
    }

    // 导航中的解锁入口也由 analysis.js 共用逻辑处理
    // 首页独立的解锁弹窗
    initVIPModal();
  }

  // ---------- VIP 弹窗 ----------

  function initVIPModal() {
    const modal   = Utils.$('#vip-modal');
    const input   = Utils.$('#vip-key-input');
    const btnSub  = Utils.$('#btn-vip-submit');
    const btnClose = Utils.$('#btn-vip-close');
    const statusMsg = Utils.$('#vip-status-msg');

    if (!modal) return;

    function show() {
      // 已 VIP 则不弹窗
      if (Auth.isVIP()) {
        Components.showToast('您已是永久VIP', 'success');
        return;
      }
      modal.classList.remove('hidden');
      // 禁止 ESC
      modal._escHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      document.addEventListener('keydown', modal._escHandler, true);
      // 阻止浏览器返回
      modal._popHandler = function (e) {
        e.preventDefault();
        history.pushState(null, '', location.href);
      };
      history.pushState(null, '', location.href);
      window.addEventListener('popstate', modal._popHandler);
    }

    function hide() {
      modal.classList.add('hidden');
      if (modal._escHandler) {
        document.removeEventListener('keydown', modal._escHandler, true);
      }
      if (modal._popHandler) {
        window.removeEventListener('popstate', modal._popHandler);
      }
      // 重置
      if (input) Utils.setValue(input, '');
      if (statusMsg) Utils.setText(statusMsg, '');
      if (statusMsg) statusMsg.className = 'vip-status-msg';
    }

    function submitKey() {
      const key = Utils.trim(Utils.getValue(input));
      if (!key) {
        if (statusMsg) {
          Utils.setText(statusMsg, '请输入VIP密钥');
          statusMsg.className = 'vip-status-msg error';
        }
        return;
      }

      if (Auth.validateVipKey(key)) {
        Auth.setVIP();
        if (statusMsg) {
          Utils.setText(statusMsg, '解锁成功！您已是永久VIP');
          statusMsg.className = 'vip-status-msg success';
        }
        updateVIPBadge();
        updateTrialInfo();
        Components.showToast('永久VIP已解锁，享无限解析次数', 'success');
        setTimeout(hide, 1200);
      } else {
        if (statusMsg) {
          Utils.setText(statusMsg, '密钥无效，请检查后重试');
          statusMsg.className = 'vip-status-msg error';
        }
      }
    }

    // 绑定事件
    if (btnSub) {
      btnSub.addEventListener('click', submitKey);
    }
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitKey();
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', hide);
    }

    // 暴露到全局，供 unlock 链接调用
    window._openVIPModal = show;
    window._closeVIPModal = hide;
  }

  // 首页解锁按钮
  function openVIPModal() {
    if (window._openVIPModal) {
      window._openVIPModal();
    }
  }

  // ---------- 网络监听 ----------

  function listenNetwork() {
    function update() {
      if (Utils.isOnline()) {
        Utils.removeClass(offlineBanner, 'show');
      } else {
        Utils.addClass(offlineBanner, 'show');
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
