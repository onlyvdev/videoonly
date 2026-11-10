/**
 * 规则：YouTube
 * 通用启发式不够用的点：video 元素 rect 恒为高 0（detect 有专门放行），
 * 播放器必须取 #movie_player（含控制栏/字幕层），下一集用播放器原生按钮。
 */
(function () {
  'use strict';
  window.VP.rules.register({
    id: 'youtube',
    hosts: ['youtube.com'],
    playerSelector: '#movie_player, ytd-player',
    nextSelector: '.ytp-next-button',
    isVideoUrl(url) {
      return /\/watch|\/shorts\/|\/live\//.test(url);
    },
    findNext(doc) {
      const btn = doc.querySelector('.ytp-next-button');
      // 播放列表无下一项时按钮为 disabled
      return btn && !btn.classList.contains('ytp-button-disable') && !btn.disabled ? btn : null;
    },
  });
})();
