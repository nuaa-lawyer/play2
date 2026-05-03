// ============================================================
// 法简AI - 通用UI组件模块
// 弹窗 / Toast / Loading / 骨架屏 / 空状态
// ============================================================

const Components = (function () {
  'use strict';

  // ---------- Toast 轻提示 ----------

  let _toastTimer = null;

  function showToast(msg, type) {
    type = type || 'info'; // info | success | error | warning

    // 复用已有 toast
    let toast = Utils.$('#global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.className = 'global-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.className = 'global-toast toast-' + type + ' toast-show';

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      toast.classList.remove('toast-show');
    }, 2800);
  }

  // ---------- Modal 弹窗 ----------

  /**
   * 创建不可关闭的高级弹窗
   * @param {Object} opts
   *   title    - 标题文字
   *   content  - 内部 HTML 字符串
   *   showMask - 是否显示蒙层，默认 true
   *   onEsc    - 按 ESC 回调（默认无操作，阻止关闭）
   *   cls      - 额外 class
   */
  function showModal(opts) {
    opts = opts || {};

    // 移除已有弹窗
    closeModal();

    const mask = document.createElement('div');
    mask.className = 'modal-mask' + (opts.cls ? ' ' + opts.cls : '');
    if (!opts.showMask && opts.showMask !== undefined) {
      mask.classList.add('modal-mask-transparent');
    }

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.innerHTML = [
      '<div class="modal-header">',
        '<h3 class="modal-title">' + Utils.escapeHTML(opts.title || '') + '</h3>',
      '</div>',
      '<div class="modal-body">' + (opts.content || '') + '</div>'
    ].join('');

    mask.appendChild(dialog);
    document.body.appendChild(mask);

    // 禁止 ESC 关闭（规范第13条）
    mask._escHandler = function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof opts.onEsc === 'function') opts.onEsc();
      }
    };
    document.addEventListener('keydown', mask._escHandler, true);

    // 点击蒙层空白不关闭（仅密钥弹窗模式可关闭）
    if (opts.closableByMask) {
      mask.addEventListener('click', function (e) {
        if (e.target === mask) closeModal();
      });
    }

    // 禁止浏览器返回手势关闭
    mask._popstateHandler = function (e) {
      e.preventDefault();
      history.pushState(null, '', location.href);
    };
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', mask._popstateHandler);

    return mask;
  }

  /** 关闭弹窗 */
  function closeModal() {
    const mask = Utils.$('.modal-mask');
    if (!mask) return;

    if (mask._escHandler) {
      document.removeEventListener('keydown', mask._escHandler, true);
    }
    if (mask._popstateHandler) {
      window.removeEventListener('popstate', mask._popstateHandler);
    }

    mask.classList.add('modal-closing');
    setTimeout(() => {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
    }, 280);
  }

  // ---------- Loading 加载动画 ----------

  function showLoading(containerId, text) {
    const container = Utils.$(containerId);
    if (!container) return;

    container.innerHTML = [
      '<div class="loading-wrapper">',
        '<div class="loading-spinner"></div>',
        '<p class="loading-text">' + Utils.escapeHTML(text || '正在解析中...') + '</p>',
      '</div>'
    ].join('');
  }

  function hideLoading(containerId) {
    const container = Utils.$(containerId);
    if (container) container.innerHTML = '';
  }

  // ---------- 骨架屏 ----------

  function showSkeleton(containerId, lines) {
    lines = lines || 5;
    const container = Utils.$(containerId);
    if (!container) return;

    let html = '<div class="skeleton-wrapper">';
    for (let i = 0; i < lines; i++) {
      const w = 60 + Math.floor(Math.random() * 40);
      html += '<div class="skeleton-line" style="width:' + w + '%"></div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  // ---------- 空状态 ----------

  function showEmpty(containerId, msg) {
    const container = Utils.$(containerId);
    if (!container) return;
    container.innerHTML = [
      '<div class="empty-state">',
        '<p class="empty-text">' + Utils.escapeHTML(msg || '暂无数据') + '</p>',
      '</div>'
    ].join('');
  }

  // ---------- 错误提示 ----------

  function showError(containerId, msg) {
    const container = Utils.$(containerId);
    if (!container) return;
    container.innerHTML = [
      '<div class="error-state">',
        '<p class="error-text">' + Utils.escapeHTML(msg || '加载失败，请稍后重试') + '</p>',
      '</div>'
    ].join('');
  }

  // ---------- 公开 API ----------
  return Object.freeze({
    showToast,
    showModal,
    closeModal,
    showLoading,
    hideLoading,
    showSkeleton,
    showEmpty,
    showError
  });
})();
