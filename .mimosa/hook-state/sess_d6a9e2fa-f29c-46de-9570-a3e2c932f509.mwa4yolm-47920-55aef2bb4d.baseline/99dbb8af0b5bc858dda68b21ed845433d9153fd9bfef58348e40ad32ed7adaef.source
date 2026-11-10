/**
 * config.js — 设置读写与规则匹配
 *
 * 配置模型（按用户实际使用方式简化）：
 * 片头片尾逐剧不同 → 只按「剧集规则」配置；全局默认作为未配置剧集的兜底（默认 0 = 不跳）。
 *
 * settings 结构（chrome.storage.sync）：
 * {
 *   enabled: true,          // 扩展总开关
 *   autoPurify: false,      // 旧版兼容字段，始终关闭；网页全屏只接受手动开启
 *   autoNext: true,         // 自动下一集
 *   locale: 'auto',         // 界面语言：auto（跟随浏览器）/ zh_CN / en
 *   skipHead: true,         // 启用片头跳过
 *   skipTail: true,         // 启用片尾跳过
 *   debug: false,
 *   globalHeadSec: 0,       // 全局兜底片头秒数（未命中规则的剧集用）
 *   globalTailSec: 0,       // 全局兜底片尾秒数
 *   rules: [ { id, name, urlPattern, headSec, tailSec, enabled } ]   // 剧集规则：每部剧一条
 * }
 *
 * 匹配：rules 中 urlPattern 是当前 URL 子串的（取 pattern 最长者 = 最具体优先）→ 全局默认。
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.config) return; // 自动注入与手动恢复交错时避免重复初始化

  const DEFAULTS = {
    enabled: true,
    autoPurify: false,     // 旧版兼容字段，始终关闭；网页全屏只接受手动开启
    autoNext: true,
    locale: 'auto',
    skipHead: true,
    skipTail: true,
    debug: false,
    globalHeadSec: 0,
    globalTailSec: 0,
    rules: [],
  };

  let settings = null;
  let readyPromise = null;

  function normalize(raw) {
    const s = Object.assign({}, DEFAULTS, raw || {});
    s.autoPurify = false; // 忽略旧版保存的自动开启偏好
    s.rules = Array.isArray(raw && raw.rules) ? raw.rules : [];
    return s;
  }

  function load() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (raw) => {
        settings = normalize(raw);
        VP.debug = !!settings.debug;
        resolve(settings);
      });
    });
    return readyPromise;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!settings) return;
    for (const key of Object.keys(changes)) {
      settings[key] = changes[key].newValue;
    }
    settings.autoPurify = false;
    VP.debug = !!settings.debug;
    VP.log('settings changed:', Object.keys(changes).join(','));
    if (VP.config && VP.config.onChanged) VP.config.onChanged(settings);
  });

  /** 当前 URL 命中的剧集规则（最长关键字优先）；未命中返回 null。popup 用它做「更新/删除当前规则」 */
  function matchRule(url) {
    const s = settings || normalize(null);
    let best = null;
    for (const r of s.rules) {
      if (r && r.enabled !== false && r.urlPattern && url.indexOf(r.urlPattern) !== -1) {
        if (!best || r.urlPattern.length > best.urlPattern.length) best = r;
      }
    }
    return best;
  }

  /**
   * 解析当前 URL 应使用的片头/片尾秒数
   * @returns {{headSec:number, tailSec:number, source:string}}
   */
  function resolveFor(url) {
    let head = 0;
    let tail = 0;
    let source = VP.i18n ? VP.i18n.t('src_global') : 'global';

    const best = matchRule(url);
    if (best) {
      head = +best.headSec || 0;
      tail = +best.tailSec || 0;
      // Older popup versions persisted a translated label as the rule name.
      // Use the URL for these generated names; preserve user-authored names.
      const generatedName = /^(?:来自弹窗|From popup)\s+\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}$/.test(best.name || '');
      const displayName = generatedName ? best.urlPattern : (best.name || best.urlPattern);
      source = VP.i18n.t('src_rule', [displayName]);
    } else {
      const s = settings || normalize(null);
      head = +s.globalHeadSec || 0;
      tail = +s.globalTailSec || 0;
    }

    return { headSec: head, tailSec: tail, source };
  }

  VP.config = {
    load,
    get: () => settings,
    /** 同步取缓存（未加载完时给默认值） */
    getSync: () => settings || normalize(null),
    matchRule,
    resolveFor,
    // content.js 会挂接：设置热更新回调
    onChanged: null,
  };

  VP.log('config.js loaded');
})();
