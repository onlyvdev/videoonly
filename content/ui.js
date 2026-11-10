/**
 * ui.js — 快捷键与轻提示（画面零遮挡，不设浮动按钮）
 *
 * - Alt+V 切换影院模式 / 返回原网页
 * - Alt+P 切换小窗口播放 / 返回普通窗口
 * - 成功/失败都有毛玻璃 toast 反馈，4 秒后自动淡出
 *   成功 = 深色玻璃；失败 = 暖色玻璃 + ⚠
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.ui) return; // 自动注入与手动恢复交错时避免重复初始化

  // 随机前缀，防止与站点 CSS 冲突
  const TP = '_t' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const TOAST_ID = TP;
  const SHOW = TP + '-on';
  const ERROR = TP + '-err';
  const TOAST_MS = 4000;

  let hideTimer = null;
  let lastAnnounceAt = 0;

  function ensureToast() {
    let el = document.getElementById(TOAST_ID);
    if (el && el.isConnected) return el;
    const style = document.createElement('style');
    style.setAttribute('data-vp-ui', '1');
    style.textContent = `
#${TOAST_ID} {
  position: fixed; top: 14px; left: 50%; transform: translate(-50%, -10px);
  z-index: 2147483647; pointer-events: none;
  display: flex; align-items: center; gap: 8px;
  max-width: min(86vw, 480px);
  padding: 9px 18px; border-radius: 999px;
  font: 500 13px/1.4 -apple-system, "SF Pro Text", "Segoe UI", "Microsoft YaHei", sans-serif;
  color: rgba(255, 255, 255, 0.96);
  background: rgba(28, 28, 30, 0.68);
  backdrop-filter: blur(18px) saturate(1.6); -webkit-backdrop-filter: blur(18px) saturate(1.6);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28), inset 0 0 0 0.5px rgba(255, 255, 255, 0.14);
  opacity: 0; transition: opacity .28s ease, transform .28s ease, background .28s ease;
}
#${TOAST_ID}.${SHOW} { opacity: 1; transform: translate(-50%, 0); }
#${TOAST_ID}.${ERROR} {
  background: rgba(180, 56, 38, 0.72);
  box-shadow: 0 6px 24px rgba(120, 30, 15, 0.3), inset 0 0 0 0.5px rgba(255, 200, 180, 0.2);
}
#${TOAST_ID} kbd {
  font: 600 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  padding: 3px 6px; border-radius: 5px;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.28);
}`;
    document.documentElement.appendChild(style);

    el = document.createElement('div');
    el.id = TOAST_ID;
    el.setAttribute('data-vp-ui', '1');
    el.setAttribute('role', 'status');
    document.documentElement.appendChild(el);
    return el;
  }

  /** 显示轻提示；isError = true 时暖色背景 + ⚠ */
  function toast(html, isError) {
    const el = ensureToast();
    el.innerHTML = (isError ? '<span style="font-size:15px">⚠</span> ' : '') + html;
    el.classList.toggle(ERROR, !!isError);
    void el.offsetWidth;
    el.classList.add(SHOW);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove(SHOW), TOAST_MS);
  }

  /** 进入影院模式时的操作提示（8 秒冷却） */
  function announceEnter() {
    const now = Date.now();
    if (now - lastAnnounceAt < 8000) return;
    lastAnnounceAt = now;
    toast(VP.i18n.t('toast_cinema_on', [VP.i18n.kbdShortcut()]));
  }

  function announceError(key) {
    lastAnnounceAt = Date.now();
    toast(VP.i18n.t(key), true);
  }

  function toggleFromUi() {
    const wasActive = VP.purify.isActive();
    try { VP.purify.toggle({ manual: true }); } // 手动触发 → 宽松探测（跳过面积/预告片门槛）
    catch (_) { announceError('player_failed'); return; }
    const nowActive = VP.purify.isActive();
    if (VP.state) {
      VP.state.manualExit = !nowActive;
      if (!nowActive) VP.state.video = null;
    }
    if (!nowActive) VP.skip?.detach();
    if (nowActive) {
      if (VP.wake) VP.wake();
      announceEnter();
    } else if (!wasActive) {
      // 想进入但失败了（页面上没检测到可接管的视频）
      announceError(VP.diagnostics.failureReason());
    }
  }

  /** 小窗播放切换（Alt+P）：已在小窗中 → 返回普通窗口；否则开启小窗 */
  function toggleWindowPlayer() {
    const inWindow = VP.windowPlayer && VP.windowPlayer.isActive();
    try {
      chrome.runtime.sendMessage({ type: inWindow ? 'vp-window-return' : 'vp-window-open' })
        .then((result) => {
          if (!result || result.ok === false) {
            const reason = result && result.error;
            announceError(reason && VP.i18n.t(reason) ? reason : 'toast_mini_fail');
          } else if (result.warning) {
            announceError(result.warning);
          }
        })
        .catch(() => announceError('window_page_unavailable'));
    } catch (e) {
      announceError('window_page_unavailable');
    }
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if (!e.altKey || e.ctrlKey || e.shiftKey) return;
      if (e.code === 'KeyV') {
        e.preventDefault();
        toggleFromUi();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        toggleWindowPlayer();
      }
    }, true);
  }

  VP.ui = { init, toast, announceEnter, announceError };

  VP.log('ui.js loaded');
})();
