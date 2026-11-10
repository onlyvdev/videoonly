/* A return button remains accessible even when a popup window has no toolbar. */
(function () {
  'use strict';
  const VP = window.VP;
  if (VP.windowPlayer) return; // 自动注入与手动恢复交错时避免重复初始化
  let active = false;
  let timer = null;
  let host = null;
  function stop(wasActive) {
    active = false;
    clearInterval(timer);
    timer = null;
    if (host) host.remove();
    host = null;
    if (!wasActive) {
      VP.purify.exit();
      VP.skip?.detach();
      if (VP.state) { VP.state.manualExit = true; VP.state.video = null; }
    }
  }
  function start() {
    if (active) return;
    active = true;
    host = document.createElement('div');
    host.setAttribute('data-vp-ui', '1');
    host.style.cssText = 'position:fixed!important;top:10px!important;right:10px!important;z-index:2147483647!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    // 用户提供的品牌图标：圆形 + 粗箭头返回，简洁有力
    style.textContent = [
      'button{display:grid;place-items:center;width:44px;height:44px;',
      'border:0;border-radius:50%;padding:0;background:transparent;',
      'cursor:pointer;-webkit-tap-highlight-color:transparent;',
      'transition:transform .15s ease,opacity .15s ease;}',
      'button:hover{transform:scale(1.08)}',
      'button:active{transform:scale(.92)}',
      'button:disabled{opacity:.5;cursor:default;transform:none}',
      'button:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(255,255,255,.5);border-radius:50%}',
      'button svg{display:block;width:32px;height:32px}',
    ].join('');
    const button = document.createElement('button');
    button.title = VP.i18n.t('window_return');
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">'
      + '<path d="M512 0C229.2224 0 0 229.2224 0 512s229.2224 512 512 512 512-229.2224 512-512S794.7776 0 512 0z m221.696 712.3968s-3.7376 11.2128-9.9328 0c0 0-67.1744-204.032-231.3728-153.0368v63.4368s-2.5088 36.096-34.816 12.4416l-161.7408-139.264s-33.5872-18.688 2.5088-43.52l164.1984-140.5952s23.6544-17.408 29.8496 11.2128v68.4032s304.7424 14.8992 241.3056 320.9216z" fill="#D6336C"/></svg>';
    const label = () => { button.title = VP.i18n.t('window_return'); };
    label();
    button.onclick = async () => {
      button.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'vp-window-return' });
        if (!result?.ok) throw Error();
      } catch (_) {
        button.disabled = false;
        button.style.opacity = '0.5';
        setTimeout(() => { button.style.opacity = ''; }, 1200);
      }
    };
    shadow.append(style, button);
    document.documentElement.appendChild(host);
    const keepPlayer = () => {
      if (!VP.purify.isActive()) VP.purify.enter();
      label();
    };
    keepPlayer();
    if (VP.wake) VP.wake();
    if (!VP.purify.isActive()) VP.ui.announceError(VP.diagnostics.failureReason());
    timer = setInterval(keepPlayer, 800);
  }
  VP.windowPlayer = { isActive: () => active };
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'vp-cinema-status') {
      respond({ ok: true, active: VP.purify.isActive() });
    } else if (message.type === 'vp-cinema-set') {
      try {
        if (message.active) {
          if (!VP.purify.enter()) {
            respond({ ok: false, error: VP.diagnostics.failureReason() }); return;
          }
          if (VP.state) VP.state.manualExit = false;
          if (VP.wake) VP.wake();
        } else {
          VP.purify.exit();
          VP.skip?.detach();
          if (VP.state) { VP.state.manualExit = true; VP.state.video = null; }
        }
        respond({ ok: true, active: VP.purify.isActive() });
      } catch (_) { respond({ ok: false, error: 'player_failed' }); }
    } else if (message.type === 'vp-window-prepare') {
      const wasActive = VP.purify.isActive();
      try {
        const playerFound = wasActive || VP.purify.enter();
        const error = playerFound ? undefined : VP.diagnostics.failureReason();
        // A top-level video still loading can be moved; other failures are explicit.
        respond({ ok: playerFound || error === 'player_not_ready', playerFound, wasActive, error });
      } catch (_) { respond({ ok: false, error: 'player_failed', wasActive }); }
    } else if (message.type === 'vp-window-start') {
      start(); respond({ ok: true });
    } else if (message.type === 'vp-window-stop') {
      stop(message.wasActive); respond({ ok: true });
    }
  });
  // Recreate the return button and cinema mode after reload or episode navigation.
  chrome.runtime.sendMessage({ type: 'vp-window-status' }).then(result => {
    if (result?.active) start();
  }).catch(() => {});
})();
