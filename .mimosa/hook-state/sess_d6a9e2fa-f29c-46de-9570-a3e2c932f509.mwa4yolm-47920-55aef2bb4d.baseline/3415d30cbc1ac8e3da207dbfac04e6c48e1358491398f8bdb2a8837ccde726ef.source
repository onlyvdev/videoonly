/**
 * next.js — 自动下一集：定位并切换到下一集
 *
 * 定位顺序：
 *   1. 站点规则（content/rules/*.js 或用户自定义，经 rules-engine 分发）
 *   2. 通用启发式：
 *      a. 文本为「下一集/下一话/下一期/下集/Next」的可点击元素
 *      b. 选集列表中「当前高亮项」的下一项
 *
 * 触发策略：优先点击真实 DOM 元素（SPA 站点最稳）；
 * 点击后 1.5s 无效（URL 没变、进度没动）且有 href → location 跳转兜底。
 * 给网站自身连播逻辑 800ms 优先权，避免「网站连播 + 插件点击」跳两集。
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.next) return; // 自动注入与手动恢复交错时避免重复初始化

  const NEXT_TEXTS = ['下一集', '下一话', '下一期', '下集', 'next episode', 'next'];
  // 精确 class 名匹配（子串 'on' 会误中 button/icon 等一切含 on 的 class，导致匹配到广告位）
  const ACTIVE_CLASSES = ['active', 'cur', 'current', 'selected', 'playing', 'watching', 'on'];

  function textOf(el) {
    return (el.textContent || el.innerText || '').trim().toLowerCase();
  }

  /** 启发式 a：文本匹配「下一集」类按钮/链接
   *  两轮：先只看可见元素；找不到再接受被隐藏的（净化模式下剧集列表往往已 display:none，
   *  而对隐藏元素 dispatch click 依然有效） */
  function findByText() {
    const nodes = Array.from(document.querySelectorAll(
      'a, button, [role="button"], [onclick], li, div[class], span[class]'
    )).filter((el) => !VP.isOwnUi(el));

    const match = (el) => {
      const t = textOf(el);
      const alt = ((el.getAttribute('aria-label') || '') + ' ' + (el.title || '')).trim().toLowerCase();
      if (t.length > 16 && alt.length > 16) return 0;
      if (t.indexOf('预告') !== -1 || alt.indexOf('预告') !== -1) return 0; // 「下一集预告」不是下一集
      if (NEXT_TEXTS.indexOf(t) !== -1 || NEXT_TEXTS.indexOf(alt) !== -1) return 2; // 精确
      if (NEXT_TEXTS.some((w) => t.startsWith(w)) || NEXT_TEXTS.some((w) => alt.startsWith(w))) return 1; // 前缀（「下一集 →」）
      return 0;
    };

    let visiblePrefix = null;
    let hiddenMatch = null;
    for (const el of nodes) {
      const m = match(el);
      if (!m) continue;
      const visible = VP.visibleArea(el) > 0;
      if (visible && m === 2) return el;          // 可见 + 精确，最优
      if (visible && m === 1) visiblePrefix = visiblePrefix || el;
      else if (!visible) hiddenMatch = hiddenMatch || el;
    }
    return visiblePrefix || hiddenMatch; // 隐藏元素 dispatch click 依然有效
  }

  /** 启发式 b：选集列表当前高亮项的下一项（同样接受被净化隐藏的列表） */
  function findByList() {
    const lists = document.querySelectorAll('[class*="list" i], [class*="episode" i], [class*="playlist" i]');
    for (const list of lists) {
      if (VP.isOwnUi(list)) continue;
      const items = Array.from(list.querySelectorAll('[class*="item" i], li, a'));
      if (items.length < 2) continue;
      // 从后往前找当前高亮项（多季/长列表时通常靠后的高亮才是当前集）
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const isActive = (it.classList && ACTIVE_CLASSES.some((c) => it.classList.contains(c))) ||
          it.getAttribute && it.getAttribute('aria-current') === 'true';
        if (isActive) {
          for (let j = i + 1; j < items.length; j++) {
            const nx = items[j];
            // 下一项需要有可导航性（链接）或可点击性
            const a = nx.tagName === 'A' ? nx : nx.querySelector('a');
            if (a && a.href) return nx;
            if (nx.tagName === 'A' || nx.hasAttribute('onclick') || nx.getAttribute('role') === 'button') return nx;
          }
          break;
        }
      }
    }
    return null;
  }

  /** 定位下一集元素：站点规则（可插拔）优先，找不到返回 null */
  function findNext() {
    let el = VP.rules.callFindNext();
    if (el) return el;
    el = findByText();
    if (el) return el;
    el = findByList();
    return el;
  }

  let lockUntil = 0;

  /**
   * 切换到下一集。
   * @returns {boolean} 是否找到下一集
   */
  async function go(video) {
    const now = Date.now();
    if (now < lockUntil) return true; // 已有一次进行中，视为已处理
    lockUntil = now + 6000;

    const el = findNext();
    if (!el) {
      VP.log('未找到下一集元素');
      lockUntil = 0;
      return false;
    }

    const beforeUrl = location.href;
    const beforeTime = video ? video.currentTime : -1;

    // 1) 给网站自身连播逻辑 800ms 优先权（避免双跳）
    await new Promise((r) => setTimeout(r, 800));
    const urlChanged = location.href !== beforeUrl;
    const timeMoved = video && Math.abs(video.currentTime - beforeTime) > 2;
    // 之前已播到中途、现在却在重新加载 → 网站自己开始换集了
    const reloading = video && video.readyState < 2 && beforeTime > 2;
    if (urlChanged || timeMoved || reloading) {
      VP.log('网站已自行切换下一集');
      lockUntil = 0;
      return true;
    }

    // 2) 点击真实元素（display:none 的元素 dispatchEvent 依然有效）
    VP.log('点击下一集元素:', el.tagName, (el.className || '').slice(0, 60));
    VP.realClick(el);
    // 点击已发出，立即释放锁——不能让防抖窗口吃掉新一集（短剧集）的片尾触发
    lockUntil = 0;

    // 3) 1.5s 后校验，无效则走 href 兜底
    const anchor = el.tagName === 'A' ? el : (el.closest ? el.closest('a') : null);
    const href = anchor && anchor.href && anchor.href !== location.href ? anchor.href : null;
    setTimeout(() => {
      const stillSame = location.href === beforeUrl &&
        (!video || Math.abs(video.currentTime - beforeTime) < 2);
      if (stillSame && href) {
        VP.log('点击无效，跳转到', href);
        location.assign(href);
      }
    }, 1500);
    return true;
  }

  VP.next = { findNext, go };

  VP.log('next.js loaded');
})();
