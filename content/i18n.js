/**
 * i18n.js — 多语言运行时（数十种语言，按需加载）
 *
 * - zh_CN / en 内置保底；其余语言字典在 content/locales/<code>.json，
 *   setLocale 时按需 fetch + JSON.parse（MV3 CSP 禁止 eval，不能加载 JS 并执行），
 *   加载后自动应用。
 * - 语言选择：settings.locale = 'auto' | 任意受支持代码
 *   auto = 跟随浏览器界面语言（chrome.i18n.getUILanguage 归一化匹配）
 * - 新增语言三步：locales/ 加一个 JSON 字典 → AVAILABLE_LOCALES 加代码 → 语言选择页自动出现
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.i18n) return; // 自动注入与手动恢复交错时避免重复初始化

  // 支持的全部语言（内置 + 可按需加载；设置页列表与 auto 探测共用）
  const AVAILABLE_LOCALES = [
    'zh_CN', 'zh_TW', 'en', 'ja', 'ko', 'es', 'pt', 'fr', 'de', 'it',
    'ru', 'ar', 'hi', 'th', 'vi', 'id', 'tr', 'pl', 'nl', 'sv',
    'uk', 'cs', 'ro', 'hu', 'el', 'he', 'fa', 'ms', 'da', 'fi', 'no', 'bn',
  ];

  const DICTS = {
    zh_CN: {
      playback_notice: "播放提示",
      dismiss_notice: "关闭提示",
      pop_rule_heading: "当前页规则",
      pop_rule_empty: "未配置",
      pop_rule_summary: "正片从 $1 / 正片到 $2",
      window_page_unavailable: "视频页尚未连接插件，请刷新视频页后重试。",
      window_open: "小窗口播放",
      window_return: "返回普通窗口",
      window_retry: "返回失败，点击重试",
      window_no_video: "未找到播放器，请等待视频加载；若刚更新插件，请刷新视频页。",
      window_unavailable: "此页面不支持小窗口播放",
      window_busy: "正在切换窗口，请稍候",
      window_failed: "窗口切换失败，请重试",

      toast_cinema_on: '影院模式 · 按 $1 返回原网页',
      rule_invalid_interval: '正片结束时间必须晚于开始时间（00:00:00 表示不设置片尾）。',
      toast_no_video: '未检测到视频 · 请先播放再试',
      player_in_frame: "播放器位于 iframe 中，当前版本无法接管。请在独立页面打开视频后重试。",
      player_frame_unknown: "未检测到可接管的视频；页面含无法读取的 iframe，视频可能位于其中。请打开视频原页面后重试。",
      player_not_ready: "检测到视频，但播放器尚未就绪或不可见。请开始播放后重试。",
      player_failed: "播放器操作失败，请刷新页面后重试。",

      toast_mini_fail: '此页面不支持小窗口播放',
      key_mac: '⌥ V',
      key_win: 'Alt + V',
      nav_title: '设置',
      nav_sub: '影院模式 · 自动连播 · 片头片尾',
      grp_general: '通用',
      grp_language: '语言',
      lang_auto: '自动',
      lang_auto_sub: '跟随浏览器界面语言',
      lang_search_ph: '搜索语言',
      lang_zh: '简体中文',
      lang_en: 'English',
      opt_enabled: '启用扩展',
      opt_enabled_sub: '关闭后所有页面恢复原样',
      opt_autoPurify: '网页全屏',
      opt_autoPurify_sub: '默认关闭；点击网页全屏开关或按 $1 手动开启。',
      opt_autoNext: '自动下一集',
      opt_autoNext_sub: '播完或到达片尾点时自动切换',
      opt_debug: '调试日志',
      opt_debug_sub: '控制台输出 [VP] 前缀信息',
      grp_skip: '片头片尾',
      opt_skipHead: '跳过片头',
      opt_skipTail: '跳过片尾',
      grp_episode_rule: '剧集规则',
      label_head_sec: '正片从',
      label_tail_sec: '正片到',
      label_head_to: '正片从',
      label_tail_to: '正片到',
      label_url_key: 'URL',
      ph_url_key: '如 /play/1234',
      btn_save_rule: '应用规则',
      btn_delete_rule: '删除规则',
      btn_saved: '✓ 已应用',
      btn_delete: '删除',
      btn_settings: '完整设置',
      foot_priority: '剧集规则只在工具栏弹窗中对当前页面定义',
      grp_shortcut: '快捷键',
      shortcut_toggle: '切换影院模式',
      shortcut_window: '小窗口播放',
      grp_about: '关于',
      version_label: '版本',
      intro_hook: '追剧时，只想安静看完这一集',
      intro_f1: '网页全屏 · 按 Alt+V，视频铺满整个窗口，画面更沉浸',
      intro_f2: '小窗播放 · 按 Alt+P，边追剧边聊天，剧停在屏幕一角',
      intro_f3: '自动下一集 · 一集播完自动接上，不用每集手动点',
      intro_f4: '跳过片头片尾 · 每部剧单独记住，正片直接开始',
      intro_f5: '简单 · 两个快捷键，像开关灯一样容易',
      foot_shortcut: '$1 切换影院模式 · 所有修改自动保存',
      alert_need_key: '请填写 URL 关键字',
      pop_title: 'onlyV',
      pop_tagline: '仅看视频',
      pop_site: 'onlyv.dev',
      pop_grp_current: '为当前页建规则',
      pop_cur_match: '当前生效：$1 · 正片从 $2 / 正片到 $3',
      pop_end_unset: '未设置',
      pop_preview: '预览：新规则 片头 $1s / 片尾 $2s（保存后生效）',
      pop_no_url: '(无法读取当前页 URL)',
      pop_mismatch: '⚠ 关键字与当前 URL 不匹配',
      pop_hint: '$1 切换影院模式',
      pop_rule_name_default: '来自弹窗 ',
      src_global: '全局默认',
      src_rule: '规则「$1」',
    },
    en: {
      playback_notice: "Playback notice",
      dismiss_notice: "Dismiss notice",
      pop_rule_heading: "Page rule",
      pop_rule_empty: "Not configured",
      pop_rule_summary: "Starts at $1 / ends at $2",
      window_page_unavailable: "The page is not connected to the extension. Refresh the video page and retry.",
      window_open: "Open in small window",
      window_return: "Return to browser",
      window_retry: "Could not return. Retry",
      window_no_video: "No player found. Wait for the video, or refresh after updating the extension.",
      window_unavailable: "This page cannot open in a small window",
      window_busy: "Switching windows. Please wait.",
      window_failed: "Could not switch windows. Please retry.",

      toast_cinema_on: 'Cinema mode · Press $1 to restore the page',
      rule_invalid_interval: 'The end must be after the start (00:00:00 disables the end point).',
      toast_no_video: 'No video detected · try after playback starts',
      player_in_frame: "The video is inside an iframe, which this version cannot control. Open the video in its own page and retry.",
      player_frame_unknown: "No controllable video found. An inaccessible iframe may contain the player. Open the original video page and retry.",
      player_not_ready: "A video was found, but its player is not ready or visible. Start playback and retry.",
      player_failed: "Player operation failed. Refresh the page and retry.",

      toast_mini_fail: 'Mini window not supported on this page',
      key_mac: '⌥ V',
      key_win: 'Alt + V',
      nav_title: 'Settings',
      nav_sub: 'Cinema mode · Auto next · Intro/outro skip',
      grp_general: 'General',
      grp_language: 'Language',
      lang_auto: 'Automatic',
      lang_auto_sub: 'Follow browser UI language',
      lang_search_ph: 'Search languages',
      lang_zh: '简体中文',
      lang_en: 'English',
      opt_enabled: 'Enable extension',
      opt_enabled_sub: 'All pages restore to original when off',
      opt_autoPurify: 'Web fullscreen',
      opt_autoPurify_sub: 'Off by default. Use the web fullscreen switch or $1 to turn it on manually.',
      opt_autoNext: 'Auto next episode',
      opt_autoNext_sub: 'Switch automatically at end or outro point',
      opt_debug: 'Debug logging',
      opt_debug_sub: 'Log [VP] prefixed messages to console',
      grp_skip: 'Intro / Outro',
      opt_skipHead: 'Skip intro',
      opt_skipTail: 'Skip outro',
      grp_episode_rule: 'Series rules',
      label_head_sec: 'Starts at',
      label_tail_sec: 'Ends at',
      label_head_to: 'Starts at',
      label_tail_to: 'Ends at',
      label_url_key: 'URL',
      ph_url_key: 'e.g. /play/1234',
      btn_save_rule: 'Apply',
      btn_delete_rule: 'Delete rule',
      btn_saved: '✓ Applied',
      btn_delete: 'Delete',
      btn_settings: 'Full settings',
      foot_priority: 'Series rules are defined per page from the toolbar popup',
      grp_shortcut: 'Shortcut',
      shortcut_toggle: 'Toggle cinema mode',
      shortcut_window: 'Mini window playback',
      grp_about: 'About',
      version_label: 'Version',
      intro_hook: 'When you binge a show, you just want to watch the show',
      intro_f1: 'Web fullscreen · Press Alt+V and the video fills the whole window',
      intro_f2: 'Mini window · Press Alt+P — keep chatting while the show stays in a corner',
      intro_f3: 'Auto next episode · Plays on by itself, no tapping every episode',
      intro_f4: 'Skip intro & outro · Remembered per show, straight to the story',
      intro_f5: 'Simple · Two shortcuts, as easy as flipping a light switch',
      foot_shortcut: '$1 toggles cinema mode · changes save automatically',
      alert_need_key: 'Please enter a URL keyword',
      pop_title: 'onlyV',
      pop_tagline: 'Videos only',
      pop_site: 'onlyv.dev',
      pop_grp_current: 'Rule for this page',
      pop_cur_match: 'Active: $1 · starts at $2 / ends at $3',
      pop_end_unset: 'Not set',
      pop_preview: 'Preview: new rule intro $1s / outro $2s (after saving)',
      pop_no_url: '(cannot read current page URL)',
      pop_mismatch: '⚠ keyword does not match current URL',
      pop_hint: '$1 toggles cinema mode',
      pop_rule_name_default: 'From popup ',
      src_global: 'Global default',
      src_rule: 'Rule "$1"',
    },
  };

  let currentLocale = 'en';
  let currentDict = DICTS.en;
  let wantedLocale = null;      // 正在异步加载的目标语言
  const localeListeners = new Set();
  const loading = {};           // code -> Promise

  /** 浏览器 UI 语言归一化到受支持代码（'zh-TW'→zh_TW，'pt-BR'→pt，未知→en） */
  function normalizeUiLang(ui) {
    const m = String(ui || '').toLowerCase();
    if (/^zh.*(tw|hk|hant)/.test(m)) return 'zh_TW';
    if (/^zh/.test(m)) return 'zh_CN';
    if (/^pt/.test(m)) return 'pt';
    if (/^(no|nb|nn)(?:[-_]|$)/.test(m)) return 'no';
    const base = m.split(/[-_]/)[0];
    return AVAILABLE_LOCALES.indexOf(base) !== -1 ? base : 'en';
  }

  /** 跟随浏览器界面语言探测 */
  function detectLocale() {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
        return normalizeUiLang(chrome.i18n.getUILanguage());
      }
    } catch (e) { /* ignore */ }
    return normalizeUiLang(typeof navigator !== 'undefined' ? navigator.language : 'en');
  }

  function applyDict(code) {
    currentLocale = DICTS[code] ? code : 'en';
    currentDict = DICTS[currentLocale];
    VP.log('i18n locale applied:', code);
    for (const listener of localeListeners) listener(currentLocale);
  }

  /** 按需加载语言字典（content/locales/<code>.json）。
   *  必须 fetch + JSON.parse——MV3 扩展页面/内容脚本的 CSP 禁止 eval。 */
  function ensureDict(code) {
    if (DICTS[code]) return Promise.resolve(true);
    if (!AVAILABLE_LOCALES.includes(code)) return Promise.resolve(false);
    if (!loading[code]) {
      loading[code] = (async () => {
        try {
          const url = chrome.runtime.getURL('content/locales/' + code + '.json');
          const dict = await fetch(url).then((r) => r.json());
          if (dict && dict.nav_title) DICTS[code] = dict;
        } catch (e) {
          VP.warn('locale load failed:', code, e && e.message);
        }
        return !!DICTS[code];
      })();
    }
    return loading[code];
  }

  /**
   * 设置语言：'auto' 探测浏览器；否则用指定字典。
   * 字典已内置则同步生效；否则异步加载完成后自动应用并调用 cb(applied)。
   */
  function setLocale(pref, cb) {
    const target = (pref && pref !== 'auto' && AVAILABLE_LOCALES.includes(pref)) ? pref : detectLocale();
    wantedLocale = target;
    if (DICTS[target]) {
      applyDict(target);
      if (cb) cb(true);
      return;
    }
    ensureDict(target).then((ok) => {
      const applied = wantedLocale === target;
      if (applied) applyDict(ok ? target : 'en');
      if (cb) cb(applied);
    });
  }
  setLocale('auto');

  function t(key, substitutions) {
    let s = currentDict[key] || DICTS.en[key] || '';
    (substitutions || []).forEach((v, i) => { s = s.split('$' + (i + 1)).join(v); });
    return s;
  }

  const isMac = (typeof navigator !== 'undefined' &&
    (/mac/i.test(navigator.platform || '') ||
      (navigator.userAgentData && navigator.userAgentData.platform === 'macOS') ||
      /Macintosh/.test(navigator.userAgent || '')));

  VP.i18n = {
    /** 取文案，$1..$n 用 substitutions 替换 */
    t,
    /** 当前语言代码 */
    locale: () => currentLocale,
    /** 全部受支持语言代码（设置页列表用） */
    available: () => AVAILABLE_LOCALES.slice(),
    /** locales/<code>.js 文件末尾调用：注册一份字典 */
    registerDict(code, dict) {
      DICTS[code] = dict;
    },
    setLocale,
    /** 用翻译键保存的动态提示在语言包加载后重新渲染。 */
    onChange(listener) {
      localeListeners.add(listener);
      return () => localeListeners.delete(listener);
    },
    /** 当前平台快捷键的显示名（Mac: ⌥ V / 其他: Alt + V） */
    shortcutLabel() {
      return t(isMac ? 'key_mac' : 'key_win');
    },
    /** 快捷键的键帽 HTML（"Alt + V" → <kbd>Alt</kbd> + <kbd>V</kbd>） */
    kbdShortcut() {
      return this.shortcutLabel()
        .split('+').map((s) => s.trim()).filter(Boolean)
        .map((p) => '<kbd>' + p + '</kbd>').join(' + ');
    },
    /** 替换 DOM 上 data-i18n 系列属性标记的文本。
     *  字典缺 key 返回空时保留原文本（html 内置的中文默认值），避免空白。 */
    applyDom(root) {
      const scope = root || document;
      if (scope === document && document.documentElement) {
        document.documentElement.lang = currentLocale.replace('_', '-');
      }
      scope.querySelectorAll('[data-i18n]').forEach((el) => {
        const m = t(el.getAttribute('data-i18n'));
        if (m) el.textContent = m;
      });
      scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const m = t(el.getAttribute('data-i18n-placeholder'));
        if (m) el.setAttribute('placeholder', m);
      });
      scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const m = t(el.getAttribute('data-i18n-title'));
        if (m) el.setAttribute('title', m);
      });
    },
  };

  VP.log('i18n.js loaded, locale =', currentLocale);
})();
