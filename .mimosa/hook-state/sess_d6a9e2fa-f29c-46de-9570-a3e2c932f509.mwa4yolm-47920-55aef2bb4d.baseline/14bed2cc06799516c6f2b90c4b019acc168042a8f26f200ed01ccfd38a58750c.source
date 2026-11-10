/**
 * 规则：爱奇艺（含海外版 iq.com，同播放器内核）
 * 通用启发式不够用的点：播放器内核容器 .iqp-player；下一集按钮。
 */
(function () {
  'use strict';
  window.VP.rules.register({
    id: 'iqiyi',
    hosts: ['iqiyi.com', 'iq.com'],
    playerSelector: '.iqp-player, #flashbox, #player',
    nextSelector: '.iqp-btn-next, [data-player-hook="next"]',
    isVideoUrl(url) {
      return /\/v_[a-z0-9]+\.s?html|\/play\//.test(url);
    },
  });
})();
