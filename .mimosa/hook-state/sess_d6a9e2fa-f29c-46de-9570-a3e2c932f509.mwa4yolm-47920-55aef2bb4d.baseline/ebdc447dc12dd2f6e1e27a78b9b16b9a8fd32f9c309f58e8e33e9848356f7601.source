/**
 * skip.js — 片头/片尾跳过状态机
 *
 * 每集（video 重新加载 / SPA URL 变化）各跳一次：
 * - 片头：timeupdate 时 currentTime < headSec → seek(headSec)，并恢复播放状态
 * - 片尾：currentTime >= tailSec（正片结束时间点） → 触发 onNeedNext；
 *         无下一集时 seek 到结尾前 0.5s 并暂停（避免反复触发）
 * - ended：无论是否配置片尾，都给 onNeedNext 一次机会
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.skip) return; // 自动注入与手动恢复交错时避免重复初始化

  const boundVideos = new WeakSet();
  let detachFn = null;

  function attach(video, opts) {
    if (!video || boundVideos.has(video)) return;
    boundVideos.add(video);
    opts = opts || {};

    let headDone = false;
    let tailFired = false;
    let seekingByUs = false;
    let tailNoNextPaused = false;

    const cfg = function () {
      return VP.config.resolveFor(location.href);
    };

    function onTimeUpdate() {
      const v = video;
      if (!v.duration || !isFinite(v.duration)) return; // 直播流不处理
      const s = VP.config.getSync();
      const rule = cfg();
      const head = Number(rule.headSec) || 0;
      const tail = Number(rule.tailSec) || 0;
      // A rule for a full episode must not seek a shorter clip to its end.
      // Reject reversed intervals instead of jumping directly from intro to tail.
      if (!Number.isFinite(head) || !Number.isFinite(tail) || head < 0 || tail < 0 ||
          head >= v.duration || (tail > 0 && tail <= head)) return;

      // ---- 片头 ----
      if (s.skipHead && !headDone && v.currentTime > 0.1 && v.currentTime < cfg().headSec - 0.5) {
        headDone = true;
        seekingByUs = true;
        const wasPlaying = !v.paused && !v.ended;
        VP.log('跳片头 →', VP.formatSec(cfg().headSec), '(' + cfg().source + ')');
        try { v.currentTime = cfg().headSec; } catch (e) { seekingByUs = false; }
        if (wasPlaying) {
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        }
        return;
      }

      // ---- 片尾（tailSec 为绝对时间戳：视频进度到达此时刻切下一集） ----
      if (s.skipTail && !tailFired && !tailNoNextPaused) {
        if (tail > 0 && v.currentTime >= tail && v.currentTime > 1 && tail < v.duration) {
          tailFired = true;
          VP.log('到片尾点，触发下一集');
          const handled = opts.onNeedNext && opts.onNeedNext();
          if (!handled) {
            tailNoNextPaused = true;
            seekingByUs = true;
            try { v.currentTime = Math.max(0, v.duration - 0.5); } catch (e) { seekingByUs = false; }
            v.pause();
          }
        }
      }
    }

    function onEnded() {
      // 前面片尾逻辑已处理过则不重复；未配片尾时 ended 直接给一次机会
      if (tailFired || tailNoNextPaused) return;
      tailFired = true;
      VP.log('video ended，触发下一集');
      if (opts.onNeedNext) opts.onNeedNext();
    }

    function onLoadedMeta() {
      // 换集（同元素重新加载）→ 重置本集标记
      headDone = false;
      tailFired = false;
      tailNoNextPaused = false;
      VP.log('loadedmetadata：新的一集，重置片头片尾标记');
    }

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('loadedmetadata', onLoadedMeta);

    detachFn = function () {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      boundVideos.delete(video);
    };
  }

  VP.skip = {
    attach,
    detach: function () { if (detachFn) { detachFn(); detachFn = null; } },
    /** SPA URL 变化（同元素不重新加载）时由 content.js 调用 */
    resetForNewEpisode: function () {
      // detach + re-attach 简单可靠地复位所有内部标记
      if (detachFn) {
        const v = null; // detachFn 闭包内已持有 video
        detachFn();
        detachFn = null;
        // content.js 会在下一轮 tick 重新 attach
      }
    },
  };

  VP.log('skip.js loaded');
})();
