// ============================================================
// 法简AI - 通用工具函数模块
// ============================================================

const Utils = (function () {
  'use strict';

  // ---------- DOM 操作 ----------

  /** 安全获取 DOM 元素 */
  function $(selector, parent) {
    return (parent || document).querySelector(selector);
  }

  /** 安全获取所有 DOM 元素 */
  function $$(selector, parent) {
    return Array.from((parent || document).querySelectorAll(selector));
  }

  /** 显示元素 */
  function show(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.style.display = '';
  }

  /** 隐藏元素 */
  function hide(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.style.display = 'none';
  }

  /** 添加/移除 class */
  function addClass(el, cls) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.add(cls);
  }

  function removeClass(el, cls) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.remove(cls);
  }

  function toggleClass(el, cls) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.toggle(cls);
  }

  /** 设置元素文本 */
  function setText(el, text) {
    if (typeof el === 'string') el = $(el);
    if (el) el.textContent = text;
  }

  /** 设置元素 HTML */
  function setHTML(el, html) {
    if (typeof el === 'string') el = $(el);
    if (el) el.innerHTML = html;
  }

  /** 设置元素值 */
  function setValue(el, val) {
    if (typeof el === 'string') el = $(el);
    if (el) el.value = val;
  }

  /** 获取元素值 */
  function getValue(el) {
    if (typeof el === 'string') el = $(el);
    return el ? el.value.trim() : '';
  }

  // ---------- 字符串 ----------

  /** 去除首尾空格 */
  function trim(str) {
    return (str || '').trim();
  }

  /** HTML 转义 */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- 存储 ----------

  /** 安全读写 localStorage */
  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 安全读写 sessionStorage */
  function sessionGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function sessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- 防抖 ----------

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ---------- 网络 ----------

  function isOnline() {
    return navigator.onLine !== false;
  }

  // ---------- 复制 ----------

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  }

  // ---------- 随机ID ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  // ---------- 公开 API ----------
  return {
    $, $$, show, hide,
    addClass, removeClass, toggleClass,
    setText, setHTML, setValue, getValue,
    trim, escapeHTML,
    storageGet, storageSet, storageRemove,
    sessionGet, sessionSet,
    debounce, isOnline,
    copyToClipboard, uid
  };
})();
