/**
 * 规则：直播平台（斗鱼 / 虎牙 / B站直播）
 * 特点：没有「下一集」概念，只净化页面；给精确播放器容器。
 */
(function () {
  'use strict';
  window.VP.rules.register([
    {
      id: 'douyu',
      hosts: ['douyu.com'],
      live: true,
      playerSelector: '.layout-Player-video, #player-ctnr',
    },
    {
      id: 'huya',
      hosts: ['huya.com'],
      live: true,
      playerSelector: '#player-ctnr, #ja-video-player',
    },
    {
      id: 'live-bilibili',
      hosts: ['live.bilibili.com'],
      live: true,
      playerSelector: '#live-player, .player-area',
    },
  ]);
})();
