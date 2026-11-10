/**
 * 规则：优酷
 * 通用启发式不够用的点：播放器容器（.youku-player 覆盖旧版两种内核）。
 * 注：优酷首页 hero 轮播预览由 detect 的预告位排除逻辑挡住，无需在此处理。
 */
(function () {
  'use strict';
  window.VP.rules.register({
    id: 'youku',
    hosts: ['youku.com'],
    playerSelector: '#ykPlayer, .youku-player, .prism-player',
    isVideoUrl(url) {
      return /v_show|\/v_?[a-z0-9]+\.s?html/.test(url);
    },
  });
})();
