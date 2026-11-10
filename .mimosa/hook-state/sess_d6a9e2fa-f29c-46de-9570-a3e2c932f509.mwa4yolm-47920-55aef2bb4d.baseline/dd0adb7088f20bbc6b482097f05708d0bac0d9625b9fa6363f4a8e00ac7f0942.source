/**
 * detect.js — 主视频与播放器容器探测（通用启发式 + 适配器增强）
 *
 * findPlayer() 返回 { video, container, path } 或 null：
 *   video     主 <video> 元素（可见面积最大者）
 *   container 播放器容器（净化后 fixed 铺满整个窗口的元素）
 *   path      container → … → body 的祖先链数组（净化时逐层隐藏兄弟分支）
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.detect) return; // 自动注入与手动恢复交错时避免重复初始化

  const PLAYER_WORDS = [
    'player', 'video', 'dplayer', 'prism-player', 'dylan', 'dxa', 'iqp',
    'bpx-player', 'playerbox', 'playbox', 'stage', 'player-wrap',
  ];

  // URL 含视频特征 → 视为「视频详情页」，净化门槛低（8% 视口面积）；
  // 无特征（首页/频道/推荐流）→ 门槛提高到 40%，挡住首页 hero 轮播预览的误触发
  // （优酷/腾讯首页轮播预览视频大面积自动播放，但用户通常不是来看它的）
  const VIDEO_URL_HINTS = [
    /\/video\//, /\/watch/, /v_show/, /bangumi/, /\/play\//, /\/v_[a-z0-9]+\.s?html/,
    /BV1[a-zA-Z0-9]+/, /\/x\/cover\//, /\/ep\d+/, /\/shorts\//, /\/live\//,
    /\/episode/, /\/film\//, /\/show\//, /\/v\/ac\d+/, /\/voddetail\//, /\/vod\//, /\/vplay\//,
    /view_video\.php/, /viewkey=/, /\/embed\//,
  ];
  function looksLikeVideoUrl() {
    return VIDEO_URL_HINTS.some((re) => re.test(location.href));
  }

  /** class/id 是否命中播放器关键词 */
  function looksLikePlayer(el) {
    const sig = ((el.className && String(el.className)) + ' ' + (el.id || '')).toLowerCase();
    if (!sig.trim()) return false;
    return PLAYER_WORDS.some((w) => sig.indexOf(w) !== -1);
  }

  // 单独的进度条/滑块不足以证明是播放器操作条。
  const CONTROL_SELECTOR = '[class*="control" i], [class*="ctrl" i], [id*="control" i], [id*="ctrl" i], [aria-controls]';

  function findExternalControls(video, container) {
    const found = [];
    const ids = new Set([video.id, container.id].filter(Boolean));
    const videos = Array.from(document.querySelectorAll('video'));
    const vr = video.getBoundingClientRect();
    const localRoots = [];
    let parent = container.parentElement;
    for (let i = 0; i < 2 && parent && parent !== document.body; i++, parent = parent.parentElement) {
      localRoots.push(parent);
    }
    // 快速通道：容器的直接兄弟中含「control/ctrl」关键词 + 按钮的元素（最常见的分离操作条结构）
    for (const root of localRoots) {
      for (const el of root.children) {
        if (el === container || container.contains(el) || el.contains(container)) continue;
        const sig = String(el.className || '') + ' ' + (el.id || '');
        if (!/control|ctrl/i.test(sig)) continue;
        if (!el.querySelector('button, [role="button"], input, svg')) continue;
        if (!found.includes(el) && !found.some(f => f.contains(el))) found.push(el);
      }
    }
    for (const el of document.querySelectorAll(CONTROL_SELECTOR)) {
      if (container.contains(el) || el.contains(container) || VP.isOwnUi(el)) continue;
      if (el.closest('aside, nav, [role="complementary"], [role="navigation"]')) continue;
      const targets = (el.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean);
      const linked = targets.some(id => ids.has(id));
      if (targets.length && !linked) continue;
      const sig = String(el.className || '') + ' ' + (el.id || '');
      const named = /(?:player|playback|video|media|plyr|prism|dplayer|vjs|jw)[\w-]*(?:control|ctrl)|(?:control|ctrl)[\w-]*(?:player|playback|video|media)/i.test(sig);
      const interactive = el.querySelectorAll('button, [role="button"], input[type="range"], [role="slider"]');
      if (!linked && !named && interactive.length < 2) continue;
      // 不把另一个播放器的操作条挂到当前视频上。
      const local = localRoots.some(root => root.contains(el) &&
        Array.from(root.querySelectorAll('video')).every(v => v === video));
      if (!linked && !local && (videos.length !== 1 || getComputedStyle(el).position !== 'fixed' || !named)) continue;
      const r = el.getBoundingClientRect();
      if (!linked && r.width > 0 && r.height > 0) {
        const aligned = r.right > vr.left && r.left < vr.right;
        const nearBottom = r.top >= vr.top + vr.height * 0.5 && r.top <= vr.bottom + 80;
        const viewportBottom = getComputedStyle(el).position === 'fixed' && Math.abs(r.bottom - window.innerHeight) <= 80;
        // 全屏后视频已脱离原布局；延迟加载的兄弟操作条仍处在旧位置。
        const lateLocal = local && VP.purify && VP.purify.cls && container.classList.contains(VP.purify.cls.stage);
        if (!aligned || r.height > Math.max(160, vr.height * 0.35) || (!nearBottom && !viewportBottom && !lateLocal)) continue;
      } else if (!linked && !local) continue;
      if (found.some(root => root.contains(el))) continue;
      found.push(el);
    }
    return found.filter(el => !found.some(other => other !== el && other.contains(el)));
  }

  /** 从 video 向上挑播放器容器 */
  function pickContainer(video) {
    // Plyr 的视频包装层与控制栏是兄弟节点，必须保留完整根节点。
    const plyr = video.closest('.plyr');
    if (plyr) return plyr;

    const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
    const vh = window.innerHeight || document.documentElement.clientHeight || 720;

    const ancestors = [];
    let p = video.parentElement;
    while (p && p !== document.documentElement && ancestors.length < 14) {
      ancestors.push(p);
      p = p.parentElement;
    }
    if (!ancestors.length) return video;

    let container = null;

    // 规则 A：最深的「命中播放器关键词 且 宽度 >= 40% 视口」的祖先
    for (const el of ancestors) {
      const r = el.getBoundingClientRect();
      if (looksLikePlayer(el) && r.width >= vw * 0.4) { container = el; break; }
    }

    // 规则 B：最深的「宽度 >= 55% 视口 且 高度 <= 2.5 倍视口高」的祖先
    if (!container) {
      for (const el of ancestors) {
        const r = el.getBoundingClientRect();
        if (r.width >= vw * 0.55 && r.height <= vh * 2.5 && r.height > 0) { container = el; break; }
      }
    }

    // 兜底：video 直接父级
    if (!container) container = ancestors[0];

    // 保持视频容器尺寸逻辑；兄弟操作条另外保留，不能据此扩大到页面布局。
    return container;
  }

  /** path: container（含）到 body（含）的祖先链 */
  function chainToBody(el) {
    const path = [];
    let cur = el;
    while (cur && cur !== document.documentElement) {
      path.push(cur);
      if (cur === document.body) break;
      cur = cur.parentElement;
    }
    if (path[path.length - 1] !== document.body) path.push(document.body);
    return path;
  }

  /** 是否在 display:none 的子树内（如优酷首页轮播预览：video 在隐藏容器里预载播放）。
   *  这类 video 的 rect 恒为 0 但可能 playing，必须与「rect 失真的真播放器」（YouTube）区分。 */
  function inHiddenTree(el) {
    let n = el;
    while (n && n !== document.body) {
      if (getComputedStyle(n).display === 'none') return true;
      n = n.parentElement;
    }
    return false;
  }

  /**
   * 探测当前页主播放器。
   * @param {{reuseVideo?:HTMLVideoElement}} opts 净化激活时可传入旧 video 复用容器，避免闪烁
   */
  function findPlayer(opts) {
    opts = opts || {};
    const manual = !!opts.manual; // 手动 Alt+V：宽松模式，跳过保守门槛
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return null;

    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const viewportArea = vw * vh;

    // 手动模式：直接选最大的非隐藏 video，不做门槛检查
    if (manual) {
      let bestVideo = null, bestScore = 0;
      for (const v of videos) {
        if (VP.isOwnUi(v) || inHiddenTree(v)) continue;
        const area = VP.visibleArea(v);
        const r = v.getBoundingClientRect();
        const playing = !v.paused && v.readyState >= 1 && !!v.currentSrc;
        const score = Math.max(area, playing ? viewportArea * 0.05 : 0);
        if (score > bestScore) { bestScore = score; bestVideo = v; }
      }
      if (!bestVideo) return null;
      // 容器选择同正常逻辑
      let container = VP.rules.callFindPlayer(bestVideo);
      if (!container || !container.contains(bestVideo)) container = pickContainer(bestVideo);
      return { video: bestVideo, container, path: chainToBody(container), controls: findExternalControls(bestVideo, container) };
    }

    // 自动模式（原有保守逻辑）
    let best = null;
    let bestArea = 0;
    let bestRectBroken = false;
    for (const v of videos) {
      if (VP.isOwnUi(v)) continue;
      if (inHiddenTree(v)) continue;
      const area = VP.visibleArea(v);
      const rect = v.getBoundingClientRect();
      const rectBroken = rect.width <= 0 || rect.height <= 0;
      const playing = !v.paused && !v.ended && v.readyState >= 2 && !!v.currentSrc;
      const score = rectBroken && playing ? Math.max(area, viewportArea * 0.1) : area;
      if (score > bestArea) {
        bestArea = score;
        best = v;
        bestRectBroken = rectBroken;
      }
    }
    if (!best) return null;

    const playingNow = !best.paused && !best.ended && best.readyState >= 2 && !!best.currentSrc;
    const realArea = VP.visibleArea(best);
    const realWidth = best.getBoundingClientRect().width;
    const looksDetail = (VP.rules.callIsVideoUrl(location.href) !== undefined)
      ? VP.rules.callIsVideoUrl(location.href)
      : looksLikeVideoUrl();
    if (!bestRectBroken) {
      if (looksDetail) {
        // 视频详情页：8% 门槛即可
        if (realArea < viewportArea * 0.08 && realWidth < 400) return null;
      } else {
        // 非详情页（首页/频道）：要求 28% 以上大视频，且排除静音预告位
        // （优酷/腾讯首页 hero 轮播预览 = muted + 循环或短时长，内容在轮换、用户未选择它；
        //   门槛取 28%：普通视频页播放器典型占 30%+，播放器带页边距时不致误杀）
        const trailer = best.muted && (best.loop ||
          (isFinite(best.duration) && best.duration > 0 && best.duration < 180));
        if (realArea < viewportArea * 0.28 || trailer) return null;
      }
    } else if (!playingNow || !looksDetail) {
      return null; // rect 失真但没在播 / 或不是视频详情页：保守放弃（挡优酷首页轮播预览）
    }

    const video = (opts.reuseVideo && videos.includes(opts.reuseVideo)) ? opts.reuseVideo : best;

    // 容器：站点规则（可插拔）优先，未命中走通用启发式
    let container = VP.rules.callFindPlayer(video);
    if (!container || !container.contains(video)) {
      container = pickContainer(video);
    }

    return { video, container, path: chainToBody(container),
      controls: findExternalControls(video, container) };
  }

  /** 页面当前是否视为「视频页」（用于 autoPurify 判断） */
  function isVideoPage() {
    return !!findPlayer();
  }

  VP.detect = { findPlayer, isVideoPage, looksLikePlayer };
  VP.log('detect.js loaded');
})();
