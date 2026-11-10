/** options.js — 设置页逻辑：所有修改自动保存到 chrome.storage.sync
 *  极简：语言 + 功能开关。片头片尾只在工具栏弹窗中对当前页面配置。 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const t = (key, subs) => window.VP.i18n.t(key, subs);

  let settings = null;
  let saveTimer = null;

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.sync.set(settings), 250);
  }

  /* ---------------- 语言：入口行 + 独立选择页（搜索 + 列表，即时生效） ---------------- */
  // 语言以各自的自称显示（native name）
  const NATIVE_NAMES = {
    zh_CN: '简体中文', zh_TW: '繁體中文', en: 'English', ja: '日本語', ko: '한국어',
    es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano',
    ru: 'Русский', ar: 'العربية', hi: 'हिन्दी', th: 'ไทย', vi: 'Tiếng Việt',
    id: 'Indonesia', tr: 'Türkçe', pl: 'Polski', nl: 'Nederlands', sv: 'Svenska',
    uk: 'Українська', cs: 'Čeština', ro: 'Română', hu: 'Magyar', el: 'Ελληνικά',
    he: 'עברית', fa: 'فارسی', ms: 'Melayu', da: 'Dansk', fi: 'Suomi', no: 'Norsk', bn: 'বাংলা',
  };

  function langDisplayName(loc) {
    return loc === 'auto' ? t('lang_auto') : (NATIVE_NAMES[loc] || loc);
  }

  function buildLangList() {
    const box = $('langList');
    box.innerHTML = '';
    // 自动（跟随浏览器）
    const auto = document.createElement('div');
    auto.className = 'lang-item';
    auto.setAttribute('data-locale', 'auto');
    auto.setAttribute('data-search', 'auto ' + t('lang_auto'));
    auto.innerHTML = '<div class="lang-text" style="flex:1"><span class="lang-name">' + t('lang_auto') +
      '</span><span class="lang-sub">' + t('lang_auto_sub') + '</span></div><span class="dot"></span>';
    box.appendChild(auto);
    for (const code of window.VP.i18n.available()) {
      const item = document.createElement('div');
      item.className = 'lang-item';
      item.setAttribute('data-locale', code);
      item.setAttribute('data-search', (NATIVE_NAMES[code] || code) + ' ' + code);
      item.innerHTML = '<span class="lang-name">' + (NATIVE_NAMES[code] || code) +
        '</span><span class="lang-code">' + code + '</span><span class="dot"></span>';
      box.appendChild(item);
    }
  }

  function refreshLangSelection() {
    const pref = (settings && settings.locale) || 'auto';
    document.querySelectorAll('.lang-item').forEach((item) => {
      item.classList.toggle('selected', item.getAttribute('data-locale') === pref);
    });
    // 自动模式仅显示「自动」，不附加探测出的语言
    const cur = $('langCurrent');
    if (cur) cur.textContent = langDisplayName(pref);
  }

  function applyTexts() {
    window.VP.i18n.applyDom();
    $('langSearch').setAttribute('placeholder', t('lang_search_ph'));
  }

  function bindLang() {
    // 入口 → 语言页（iOS push）
    $('langEntry').addEventListener('click', () => {
      const v = $('langView');
      v.hidden = false;
      requestAnimationFrame(() => v.classList.add('show'));
    });
    $('langBack').addEventListener('click', () => {
      const v = $('langView');
      v.classList.remove('show');
      setTimeout(() => { v.hidden = true; }, 300);
    });
    // 搜索过滤
    $('langSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.lang-item').forEach((item) => {
        const hit = !q || (item.getAttribute('data-search') || '').toLowerCase().includes(q);
        item.classList.toggle('hidden-by-search', !hit);
      });
    });
    // 选择语言
    $('langList').addEventListener('click', (e) => {
      const item = e.target.closest('.lang-item');
      if (!item) return;
      const loc = item.getAttribute('data-locale');
      if (!settings || settings.locale === loc) return;
      settings.locale = loc;
      chrome.storage.sync.set({ locale: loc });
      // 字典可能需要异步加载（JSON），加载完成后刷新整页文案
      window.VP.i18n.setLocale(loc, (applied) => {
        if (applied) {
          applyTexts();
          buildLangList();
          bindLangListOnce();
          refreshLangSelection();
          fillStaticInfo();
        }
      });
      refreshLangSelection();
    });
  }

  // 语言列表点击用事件委托（buildLangList 重建后无需重绑；此函数保留入口以防重复绑定）
  function bindLangListOnce() { /* 委托已由 bindLang 绑定在 #langList 容器上 */ }

  /* ---------------- 快捷键 + 关于 ---------------- */
  function fillStaticInfo() {
    const kbd = $('shortcutKbd');
    if (kbd) kbd.innerHTML = window.VP.i18n.kbdShortcut();
    const wk = $('windowKbd');
    if (wk) {
      // 小窗播放快捷键固定 Alt+P（跨平台一致）
      const label = window.VP.i18n.shortcutLabel().indexOf('⌥') === 0 ? '⌥ P' : 'Alt + P';
      wk.innerHTML = '<kbd>' + label.replace(/\s+\+\s+/, '</kbd> + <kbd>') + '</kbd>';
    }
    const ver = $('aboutVersion');
    if (ver) {
      let v = '0.1.0';
      try { v = chrome.runtime.getManifest().version; } catch (e) { /* 非扩展环境 */ }
      ver.textContent = t('version_label') + ' ' + v;
    }
  }

  /* ---------------- 事件绑定 ----------------
   * 功能开关（启用/网页全屏/自动下一集/调试）已全部在工具栏弹窗中，
   * 本页只负责语言选择。 */

  chrome.storage.sync.get(null, (raw) => {
    settings = Object.assign({
      enabled: true, autoPurify: false, autoNext: true, locale: 'auto',
      skipHead: true, skipTail: true, debug: false, rules: [],
    }, raw);
    settings.rules = Array.isArray(raw.rules) ? raw.rules : [];

    window.VP.i18n.setLocale(settings.locale || 'auto', () => {
      applyTexts();
      buildLangList();
      refreshLangSelection();
    });
    applyTexts();
    buildLangList();
    bindLang();
    refreshLangSelection();
    fillStaticInfo();
  });
})();
