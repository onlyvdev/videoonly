/**
 * 规则：Bilibili
 * 通用启发式不够用的点：容器必须取 #bilibili-player（含弹幕层/控制栏）；
 * 页面结构为 sticky 布局（purify 有专门处理）；下一集优先控制栏按钮，番剧用选集列表。
 */
(function () {
  'use strict';

  /** 选集列表：当前高亮项的下一个（含番剧多季列表） */
  function nextFromPlaylist(doc) {
    const lists = doc.querySelectorAll('.video-pod__list, .squirtle-progress-list, [class*="eplist"]');
    for (const list of lists) {
      const items = Array.from(list.querySelectorAll('[class*="item"], li'));
      for (let i = items.length - 1; i >= 0; i--) {
        const sig = (String(items[i].className) + ' ' + (items[i].getAttribute('aria-current') || '')).toLowerCase();
        if (/(^|\s)(active|cur|on|selected)(\s|$)/.test(sig) || items[i].getAttribute('aria-current') === 'true') {
          if (i + 1 < items.length) return items[i + 1];
          break;
        }
      }
    }
    return null;
  }

  window.VP.rules.register({
    id: 'bilibili',
    hosts: ['bilibili.com'],
    playerSelector: '#bilibili-player, .bpx-player-container',
    findNext(doc) {
      const btn = doc.querySelector('.bpx-player-ctrl-next');
      if (btn && !btn.classList.contains('bpx-state-disable')) return btn;
      return nextFromPlaylist(doc);
    },
    isVideoUrl(url) {
      return /\/video\/BV|\/bangumi\/play|\/festival\//.test(url);
    },
  });
})();
