/**
 * content.js — 主入口：状态机 + SPA 路由监听 + 各模块协调
 *
 * 职责：
 * - 等 settings 加载完成
 * - 每 800ms tick：探测播放器 → 绑定/换绑 video（片头片尾/ended）→ 按需自动净化
 * - SPA URL 变化（pushState/replaceState/popstate hook + 轮询兜底）→ 重置本集状态
 * - 设置热更新（storage.onChanged）→ 开关即时生效
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.wake) return; // 自动注入与手动恢复交错时避免重复初始化

  VP.state = {
    video: null,          // 当前绑定的主 video
    lastUrl: location.href,
    manualExit: false,    // 用户手动退出影院模式后，本集不再自动净化（URL 变化后重置）
    startedAt: Date.now(),
  };

  /** 片尾/ended 时的回调：返回 true 表示已接手处理（有下一集） */
  function onNeedNext() {
    const s = VP.config.getSync();
    if (!s.autoNext) return false;
    const el = VP.next.findNext();
    if (!el) return false;
    // 异步执行点击/跳转；本函数同步返回「已处理」
    VP.next.go(VP.state.video);
    return true;
  }

  function bindVideo(video) {
    if (VP.state.video === video) return;
    VP.state.video = video;
    VP.skip.detach();
    VP.skip.attach(video, { onNeedNext });
    VP.log('绑定 video:', video.currentSrc ? String(video.currentSrc).slice(0, 80) : '(no src)');
  }

  function onUrlChange() {
    const url = location.href;
    if (url === VP.state.lastUrl) return;
    VP.state.lastUrl = url;
    VP.log('URL 变化 →', url);
    // 新的一集：重置片头片尾标记、恢复自动净化资格
    VP.skip.detach();
    VP.state.video = null;
    VP.state.manualExit = false;
    if (VP.purify.isActive()) VP.purify.reapply();
  }

  function hookHistory() {
    const wrap = (name) => {
      const orig = history[name];
      history[name] = function (...args) {
        const ret = orig.apply(this, args);
        setTimeout(onUrlChange, 0);
        return ret;
      };
    };
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', () => setTimeout(onUrlChange, 0));
  }

  function tick() {
    const s = VP.config.getSync();
    if (!s.enabled || (!VP.purify.isActive() && !VP.windowPlayer?.isActive())) {
      VP.skip.detach();
      VP.state.video = null;
      return;
    }

    onUrlChange(); // 轮询兜底（有些站点绕过 history API）

    const reuse = (VP.state.video && VP.state.video.isConnected) ? VP.state.video : undefined;
    const player = VP.detect.findPlayer({ reuseVideo: reuse });

    if (player) bindVideo(player.video);
  }

  function onSettingsChanged() {
    const s = VP.config.getSync();
    if (s.locale !== undefined) VP.i18n.setLocale(s.locale); // 语言热更新（toast 等即时生效）
  }

  // 引擎（路由 hook + 探测轮询）只启动一次；Alt+V 唤醒与设置变化都安全重复调用
  let engineStarted = false;
  function startEngine() {
    if (engineStarted) { tick(); return; }
    engineStarted = true;
    hookHistory();
    VP.purify.onBroken = () => { VP.state.video = null; }; // 播放器消失，等 tick 重新探测
    tick();
    setInterval(tick, 800);
    VP.log('content.js engine started @', location.host);
  }
  VP.wake = () => {
    VP.config.getSync().enabled = true;
    startEngine();
  }; // 仅在手动开启网页全屏/小窗口成功后唤醒，不持久化开启状态

  function main() {
    VP.config.load().then(() => {
      const s = VP.config.getSync();
      VP.i18n.setLocale(s.locale || 'auto');
      VP.config.onChanged = onSettingsChanged;
      VP.ui.init(); // 快捷键永远注册：Alt+V 随时手动接管
      // 页面默认不接管；兼容初始化前已收到的手动开启消息。
      if (VP.purify.isActive() || VP.windowPlayer?.isActive()) VP.wake();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main, { once: true });
  } else {
    main();
  }
})();
