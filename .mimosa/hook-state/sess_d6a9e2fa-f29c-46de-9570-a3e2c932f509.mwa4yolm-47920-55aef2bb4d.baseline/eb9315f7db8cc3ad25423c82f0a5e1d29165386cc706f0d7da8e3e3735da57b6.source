/**
 * common.js — 全局命名空间与通用工具
 * 所有 content 模块共享 window.VP（MV3 content script 不支持 ES module）
 */
(function () {
  'use strict';

  const VP = (window.VP = window.VP || {});
  if (VP.log) return; // 自动注入与手动恢复交错时避免重复初始化

  /** 是否输出调试日志（扩展设置面板可开启） */
  VP.debug = false;
  VP.log = function (...args) {
    if (VP.debug) console.log('[VP]', ...args);
  };
  VP.warn = function (...args) {
    console.warn('[VP]', ...args);
  };

  /** 节流：delay ms 内只执行最后一次 */
  VP.throttle = function (fn, delay) {
    let timer = null;
    let lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        fn.apply(this, lastArgs);
      }, delay);
    };
  };

  /** 等待 DOM ready */
  VP.onReady = function (cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => cb(), { once: true });
    } else {
      cb();
    }
  };

  /** 元素可见面积（px²），不可见返回 0 */
  VP.visibleArea = function (el) {
    if (!el || !el.getBoundingClientRect) return 0;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return 0;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return 0;
    return r.width * r.height;
  };

  /** 元素或其祖先是否被标记为插件自身 UI（净化时跳过） */
  VP.isOwnUi = function (el) {
    return !!(el && el.closest && el.closest('[data-vp-ui="1"]'));
  };

  /** 秒 → "1:23" 显示 */
  VP.formatSec = function (sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  };

  /** 当前页 host（去 www. 前缀），如 "bilibili.com" */
  VP.pageHost = function () {
    try {
      return location.hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  };

  /** 触发一次真实的鼠标点击（比 .click() 更接近用户操作，SPA 路由站需要 bubbles） */
  VP.realClick = function (el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ block: 'center', inline: 'center' });
    } catch (e) { /* ignore */ }
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    return true;
  };

  VP.log('common.js loaded');
})();
