/**
 * 规则：腾讯视频
 * 通用启发式不够用的点：选集列表下一项定位（SPA 路由卡片多为 JS 点击）。
 */
(function () {
  'use strict';
  window.VP.rules.register({
    id: 'tencent',
    hosts: ['v.qq.com'],
    playerSelector: '#player, .container-video, #mod_player',
    findNext(doc) {
      const btn = doc.querySelector('.player_next, [data-role="next"]');
      if (btn) return btn;
      // 选集列表：当前集的下一项
      const lists = doc.querySelectorAll('.episode-list, ._play_list, [class*="episode"]');
      for (const list of lists) {
        const items = Array.from(list.querySelectorAll('[class*="item"], li, a'));
        for (let i = items.length - 1; i >= 0; i--) {
          const cls = String(items[i].className || '');
          if (/(^|\s)(current|active|cur)(\s|$)/.test(cls)) {
            if (i + 1 < items.length) return items[i + 1];
            break;
          }
        }
      }
      return null;
    },
    isVideoUrl(url) {
      return /\/x\/(cover|page)\//.test(url);
    },
  });
})();
