/**
 * rules-engine.js — 站点规则引擎（可插拔）
 *
 * 规则来源：content/rules/*.js 每站一个文件，文件末尾调用 VP.rules.register() 自注册。
 * 新增站点支持 = 新建一个规则文件 + manifest 的 js 数组加一行，核心代码零改动。
 * （按用户配置模型：片头片尾逐剧配置，无站点级配置；选择器规则只存在于代码层。）
 *
 * 规则接口（全部字段可选，只覆盖通用启发式不够用的部分）：
 * {
 *   id: 'youtube',
 *   hosts: ['youtube.com'],        // host 精确或父域匹配（m.bilibili.com 命中 bilibili.com）
 *   live: false,                   // 直播站：无下一集概念
 *   findPlayer(video, doc),        // → 播放器容器元素 | null（null 走通用启发式）
 *   findNext(doc),                 // → 可点击元素 | {url} | null（null 走通用启发式）
 *   isVideoUrl(url),               // → boolean | undefined（undefined 走通用 URL 特征）
 *   // 简单声明式字段（引擎注册时自动包装为上面的钩子）：
 *   playerSelector: '#movie_player',
 *   nextSelector: '.ytp-next-button',
 *   videoUrlPattern: '/watch,/shorts',   // 字符串，逗号分隔多个子串
 * }
 *
 * 解析顺序：规则钩子 → 通用启发式（detect.js / next.js 内置），永远有兜底。
 */
(function () {
  'use strict';

  const VP = window.VP;
  if (VP.rules) return; // 自动注入与手动恢复交错时避免重复初始化

  const builtinRules = [];   // 内置规则（代码注册）
  let cachedMatch = { host: null, rules: [] };

  /** host 是否命中规则（精确或父域） */
  function hostMatches(host, hosts) {
    return (hosts || []).some((h) => host === h || host.endsWith('.' + h));
  }

  /** 声明式字段包装为函数钩子（注册时执行一次） */
  function materialize(rule) {
    const r = Object.assign({}, rule);
    if (!r.findPlayer && r.playerSelector) {
      r.findPlayer = (video) => {
        for (const sel of r.playerSelector.split(',').map((s) => s.trim()).filter(Boolean)) {
          try {
            const el = document.querySelector(sel);
            if (el && (!video || el.contains(video))) return el;
          } catch (e) { /* 无效选择器跳过 */ }
        }
        return null;
      };
    }
    if (!r.findNext && r.nextSelector) {
      r.findNext = () => {
        for (const sel of r.nextSelector.split(',').map((s) => s.trim()).filter(Boolean)) {
          try {
            const el = document.querySelector(sel);
            if (el) return el;
          } catch (e) { /* ignore */ }
        }
        return null;
      };
    }
    if (!r.isVideoUrl && r.videoUrlPattern) {
      const parts = r.videoUrlPattern.split(',').map((s) => s.trim()).filter(Boolean);
      r.isVideoUrl = (url) => parts.some((p) => url.indexOf(p) !== -1);
    }
    return r;
  }

  /** 当前页命中的规则（按 host 缓存） */
  function forCurrentPage() {
    const host = VP.pageHost();
    if (cachedMatch.host === host) return cachedMatch.rules;
    const hit = builtinRules.filter((r) => hostMatches(host, r.hosts));
    cachedMatch = { host, rules: hit };
    return cachedMatch.rules;
  }

  /** 分发钩子：任一规则返回非空即短路 */
  function dispatch(hookName, ...args) {
    const rules = forCurrentPage();
    for (const r of rules) {
      const fn = r[hookName];
      if (typeof fn !== 'function') continue;
      try {
        const ret = fn.apply(r, args);
        if (ret) return ret;
      } catch (e) {
        VP.warn('rule', r.id, hookName, 'error:', e && e.message);
      }
    }
    return null;
  }

  VP.rules = {
    /** 注册一个规则或一组规则（注册时把声明式字段包装为钩子） */
    register(rule) {
      for (const item of (Array.isArray(rule) ? rule : [rule])) {
        if (item.id && builtinRules.some(existing => existing.id === item.id)) continue;
        builtinRules.push(materialize(item));
      }
      cachedMatch = { host: null, rules: [] };
    },

    /** 播放器容器：规则优先，全部未命中返回 null（调用方走通用启发式） */
    callFindPlayer(video) {
      const el = dispatch('findPlayer', video, document);
      return el && el.isConnected ? el : null;
    },

    /** 下一集：规则优先 */
    callFindNext() {
      const ret = dispatch('findNext', document);
      if (!ret) return null;
      if (ret.nodeType === 1) return ret.isConnected ? ret : null; // DOM 元素
      if (ret.url) return { url: ret.url };
      return null;
    },

    /** URL 是否视频详情页：规则显式返回 boolean 才采用，否则 undefined（走通用） */
    callIsVideoUrl(url) {
      const rules = forCurrentPage();
      for (const r of rules) {
        if (typeof r.isVideoUrl !== 'function') continue;
        try {
          const ret = r.isVideoUrl(url);
          if (typeof ret === 'boolean') return ret;
        } catch (e) { /* ignore */ }
      }
      return undefined;
    },

    isLive() {
      return forCurrentPage().some((r) => r.live);
    },

    /** 调试：当前页命中的规则 id */
    activeIds() {
      return forCurrentPage().map((r) => r.id);
    },
  };

  VP.log('rules-engine.js loaded');
})();
