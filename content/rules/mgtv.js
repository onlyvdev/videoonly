/**
 * 规则：芒果TV
 * 通用启发式不够用的点：播放器容器选择器。
 */
(function () {
  'use strict';
  window.VP.rules.register({
    id: 'mgtv',
    hosts: ['mgtv.com'],
    playerSelector: '#mgsdkplayer, .video-area',
    nextSelector: '.next-icon, a[title*="下一"]',
    isVideoUrl(url) {
      return /\/b\/\d+\/\d+\.html|\/l\//.test(url);
    },
  });
})();
