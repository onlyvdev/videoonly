/** popup.js — 快速开关 + 为当前页一键创建片头片尾规则
 *  片头/片尾使用时:分:秒；失焦及保存时限制范围并补齐两位数字。 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const t = (key, subs) => window.VP.i18n.t(key, subs);
  const CHECK_KEYS = ['autoNext', 'skipHead', 'skipTail'];
  let curUrl = '';

  // Keep typing uninterrupted; normalize on blur and again before saving.
  function normalizeTimeInput(input) {
    const value = Number(input.value);
    const bounded = Math.min(Number(input.max), Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0));
    input.value = String(bounded).padStart(2, '0');
    return bounded;
  }
  for (const prefix of ['head', 'tail']) {
    for (const unit of ['H', 'M', 'S']) {
      const input = $(prefix + unit);
      input.addEventListener('blur', () => normalizeTimeInput(input));
    }
  }

  /** 三个 H:M:S 输入框 → 总秒数 */
  function readTime(prefix) {
    const h = normalizeTimeInput($(prefix + 'H'));
    const m = normalizeTimeInput($(prefix + 'M'));
    const s = normalizeTimeInput($(prefix + 'S'));
    return h * 3600 + m * 60 + s;
  }

  /** 总秒数 → 三个 H:M:S 输入框预填 */
  function fillTime(prefix, totalSec) {
    totalSec = Math.max(0, Math.floor(totalSec || 0));
    $(prefix + 'H').value = String(Math.min(24, Math.floor(totalSec / 3600))).padStart(2, '0');
    $(prefix + 'M').value = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    $(prefix + 'S').value = String(totalSec % 60).padStart(2, '0');
  }

  /** 总秒数 → 显示用字符串 */
  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return String(h).padStart(2, '0') + ':' + mm + ':' + ss;
  }

  function applyTexts() {
    window.VP.i18n.applyDom();
  }
  chrome.storage.sync.get({ locale: 'auto' }, ({ locale }) => {
    window.VP.i18n.setLocale(locale || 'auto', () => { applyTexts(); refreshMatch(); });
    applyTexts();
  });

  // 取当前激活标签页
  chrome.windows.getCurrent({ populate: true }, (win) => {
    const tabs = (win && win.tabs) || [];
    const tab = tabs.find((t) => t.active) || tabs[0];
    curUrl = (tab && tab.url) || '';
    syncRuleForm();
  });

  chrome.storage.sync.get({ autoNext: true, skipHead: true, skipTail: true }, (s) => {
    for (const k of CHECK_KEYS) $(k).checked = !!s[k];
    for (const k of CHECK_KEYS) {
      $(k).onchange = (e) => {
        const patch = {}; patch[k] = e.target.checked;
        chrome.storage.sync.set(patch);
      };
    }
  });

  $('openOptions').onclick = () => chrome.runtime.openOptionsPage();

  function refreshMatch() {
    if (!curUrl) return;
    window.VP.config.load().then(() => {
      const m = window.VP.config.resolveFor(curUrl);
      $('matchInfo').innerHTML = t('pop_cur_match', ['<b>' + esc(m.source) + '</b>', formatTime(m.headSec), m.tailSec > 0 ? formatTime(m.tailSec) : t('pop_end_unset')]);
    });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /** 当前页命中的规则（用于预填 / 更新 / 删除） */
  let matchedRule = null;

  /** 命中规则时：预填其值（URL + H:M:S 时间戳）；否则预填 URL 路径 */
  function syncRuleForm() {
    if (!curUrl) return;
    window.VP.config.load().then(() => {
      matchedRule = window.VP.config.matchRule(curUrl) || null;
      if (matchedRule) {
        $('rulePattern').value = matchedRule.urlPattern;
        fillTime('head', matchedRule.headSec);
        fillTime('tail', matchedRule.tailSec);
        $('deleteRule').hidden = false;
      } else {
        try { $('rulePattern').value = new URL(curUrl).pathname; } catch (e) { $('rulePattern').value = curUrl; }
      }
      refreshMatch();
    });
  }
  window.VP.config.onChanged = refreshMatch;

  $('saveRule').onclick = () => {
    const pattern = $('rulePattern').value.trim();
    if (!pattern) return alert(t('alert_need_key'));
    const headSec = readTime('head');
    const tailSec = readTime('tail');
    if (tailSec > 0 && tailSec <= headSec) {
      $('matchInfo').textContent = t('rule_invalid_interval');
      return;
    }
    chrome.storage.sync.get({ rules: [] }, (stored) => {
      const rules = stored.rules || [];
      if (matchedRule) {
        const idx = rules.findIndex((r) => r.id === matchedRule.id);
        const updated = Object.assign({}, matchedRule, { urlPattern: pattern, headSec, tailSec });
        if (idx >= 0) rules[idx] = updated; else rules.push(updated);
      } else {
        rules.push({
          id: crypto.randomUUID(),
          name: pattern,
          urlPattern: pattern,
          headSec, tailSec,
          enabled: true,
        });
      }
      chrome.storage.sync.set({ rules }, () => {
        if (chrome.runtime.lastError) { $('matchInfo').textContent = chrome.runtime.lastError.message; return; }
        matchedRule = rules.find((r) => r.urlPattern === pattern) || null;
        $('deleteRule').hidden = !matchedRule;
        const btn = $('saveRule');
        btn.textContent = t('btn_saved');
        setTimeout(() => (btn.textContent = t('btn_save_rule')), 1200);
        refreshMatch();
      });
    });
  };

  $('deleteRule').onclick = () => {
    if (!matchedRule) return;
    chrome.storage.sync.get({ rules: [] }, (stored) => {
      const rules = (stored.rules || []).filter((r) => r.id !== matchedRule.id);
      chrome.storage.sync.set({ rules }, () => {
        matchedRule = null;
        fillTime('head', 0);
        fillTime('tail', 0);
        $('deleteRule').hidden = true;
        refreshMatch();
      });
    });
  };
})();
