/**
 * purify.js — 影院模式：隐藏播放器外一切内容 + 网页全屏（fixed 铺满窗口）
 *
 * - 所有注入 class 使用随机前缀，杜绝与站点 CSS 冲突
 * - CSS 动态构建（class 名运行时生成），classList 操作全部走常量
 * - MutationObserver 守护：网站重渲染后节流重算
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.purify) return;

  // 随机前缀：每次页面加载生成一次，不可能与站点 class 冲突
  const P = '_x' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const C = {
    hide: P + 'h',
    path: P + 'p',
    stage: P + 's',
    on: P + 'on',
    ctrl: P + 'c',
    ctrlPath: P + 'cp',
  };
  const SEL = {
    all: '.' + C.hide + ', .' + C.path + ', .' + C.stage + ', .' + C.ctrl + ', .' + C.ctrlPath,
  };
  const CLASSES = [C.hide, C.path, C.stage, C.ctrl, C.ctrlPath];
  const STYLE_ID = P + 'st';

  function buildCSS() {
    return `
.${C.hide} { display: none !important; }
html.${C.on}, html.${C.on} body { overflow: hidden !important; }
html.${C.on} .${C.path} {
  transform: none !important;
  filter: none !important;
  perspective: none !important;
  clip-path: none !important;
  overflow: visible !important;
}
html.${C.on} .${C.stage} {
  position: fixed !important;
  left: 0 !important; top: 0 !important; right: 0 !important; bottom: 0 !important;
  width: 100vw !important; height: 100vh !important;
  max-width: 100vw !important; max-height: 100vh !important;
  min-width: 0 !important; min-height: 0 !important;
  aspect-ratio: auto !important;
  margin: 0 !important; padding: 0 !important;
  border: 0 !important; outline: 0 !important;
  box-sizing: border-box !important;
  z-index: 2147483647 !important;
  background: #000 !important;
}
html.${C.on} .${C.ctrlPath} { position: relative !important; z-index: 2147483646 !important; }
html.${C.on} .${C.ctrl} {
  position: fixed !important;
  left: 0 !important; right: 0 !important; top: auto !important; bottom: 0 !important;
  width: 100vw !important; max-width: 100vw !important;
  box-sizing: border-box !important;
  z-index: 2147483646 !important;
}
html.${C.on} .${C.stage} video { object-fit: contain !important; }`;
  }

  let active = false;
  let observer = null;
  let lastPlayer = null;
  let missSince = 0;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCSS();
    document.documentElement.appendChild(style);
  }

  function clearAllClasses() {
    for (const el of document.querySelectorAll(SEL.all)) el.classList.remove(...CLASSES);
    document.documentElement.classList.remove(C.on);
  }

  function keepPaths(player) {
    const keep = new Set(player.path);
    for (const c of player.controls || []) {
      for (let el = c; el && el !== document.documentElement; el = el.parentElement) keep.add(el);
    }
    return keep;
  }

  function isInteractiveOverlay(el, vr) {
    if (!el || !vr || vr.width === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 5) return false;
    if (r.left >= vr.right || r.right <= vr.left) return false;
    if (r.top >= vr.bottom || r.bottom <= vr.top) return false;
    if (r.height > vr.height * 0.2) return false;
    if (r.bottom < vr.bottom - vr.height * 0.3) return false;
    if (r.width < vr.width * 0.5) return false;
    if (!el.querySelector('button, [role="button"], input, [role="slider"], progress')) return false;
    if (el.closest('aside, nav, [role="complementary"], [role="navigation"]')) return false;
    return true;
  }

  function hideOffChain(player) {
    const keep = keepPaths(player);
    const vr = player.video.getBoundingClientRect();
    for (const cur of keep) {
      const parent = cur.parentElement;
      if (!parent) continue;
      for (const child of parent.children) {
        if (VP.isOwnUi(child)) { child.classList.remove(C.hide); continue; }
        if (keep.has(child)) {
          child.classList.remove(C.hide);
          child.classList.add(C.path);
        } else if (isInteractiveOverlay(child, vr)) {
          child.classList.remove(C.hide);
        } else {
          child.classList.add(C.hide);
        }
      }
    }
    document.body.classList.add(C.path);
    for (const c of player.controls || []) {
      c.classList.add(C.ctrl);
      for (let el = c.parentElement; el && !player.path.includes(el); el = el.parentElement) {
        el.classList.add(C.ctrlPath);
      }
    }
  }

  function hideFloaters(player) {
    const keep = keepPaths(player);
    const roots = [player.container, ...(player.controls || [])];
    const vh = window.innerHeight || 800;
    for (const el of document.body.querySelectorAll('*')) {
      if (el.classList.contains(C.hide) || VP.isOwnUi(el)) continue;
      if (keep.has(el) || roots.some(root => root.contains(el))) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      const hasInteractive = el.querySelector('button, [role="button"], input, [role="slider"], progress');
      const inZone = hasInteractive && r.height < vh * 0.3 && (r.bottom > vh * 0.7 || r.top < vh * 0.15);
      if (inZone) continue;
      el.classList.add(C.hide);
    }
  }

  const hideFloatersThrottled = VP.throttle(() => {
    if (!active || !lastPlayer) return;
    hideFloaters(lastPlayer);
  }, 800);

  function reapply() {
    if (!active) return;
    const reuse = lastPlayer && lastPlayer.video.isConnected ? lastPlayer.video : undefined;
    const player = VP.detect.findPlayer({ reuseVideo: reuse });
    if (!player) {
      if (!missSince) missSince = Date.now();
      if (Date.now() - missSince > 2000) {
        VP.log('reapply: player gone, exiting');
        exit();
        if (VP.purify.onBroken) VP.purify.onBroken();
      }
      return;
    }
    missSince = 0;
    if (lastPlayer && (lastPlayer.container !== player.container ||
        (lastPlayer.controls || []).length !== (player.controls || []).length)) clearAllClasses();
    lastPlayer = player;
    hideOffChain(player);
    player.container.classList.remove(C.hide);
    player.container.classList.add(C.stage);
    document.documentElement.classList.add(C.on);
    hideFloatersThrottled();
  }

  const reapplyThrottled = VP.throttle(reapply, 250);

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((muts) => {
      let structural = false;
      for (const m of muts) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) { structural = true; break; }
      }
      if (structural) reapplyThrottled();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function enter(opts) {
    if (active) { reapply(); return true; }
    const player = VP.detect.findPlayer(opts);
    if (!player) return false;
    ensureStyle();
    active = true;
    lastPlayer = player;
    hideOffChain(player);
    player.container.classList.add(C.stage);
    document.documentElement.classList.add(C.on);
    hideFloaters(player);
    startObserver();
    VP.log('cinema ON');
    return true;
  }

  function exit() {
    if (!active) return;
    active = false;
    missSince = 0;
    if (observer) { observer.disconnect(); observer = null; }
    clearAllClasses();
    lastPlayer = null;
    VP.log('cinema OFF');
  }

  function toggle(opts) {
    if (active) exit();
    else enter(opts);
    return active;
  }

  VP.purify = { enter, exit, toggle, reapply, isActive: () => active, getPlayer: () => lastPlayer, onBroken: null, cls: C };
  VP.log('purify.js loaded, prefix =', P);
})();
