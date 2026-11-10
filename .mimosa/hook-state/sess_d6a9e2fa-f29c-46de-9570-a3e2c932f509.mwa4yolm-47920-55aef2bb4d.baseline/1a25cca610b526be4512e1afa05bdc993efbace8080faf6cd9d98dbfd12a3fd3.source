(function () {
  'use strict';
  const button = document.getElementById('windowPlayer');
  const status = document.getElementById('playbackStatus');
  const notice = document.getElementById('playbackNotice');
  const dismiss = document.getElementById('dismissPlaybackNotice');
  let noticeTrigger = null;
  let noticeKey = null;
  const t = key => window.VP.i18n.t(key);
  function renderNotice() {
    if (noticeKey) status.textContent = t(noticeKey);
  }
  window.VP.i18n.onChange?.(renderNotice);
  function clearNotice() {
    notice.hidden = true;
    noticeKey = null;
    status.textContent = '';
  }
  function showNotice(key, trigger) {
    noticeKey = key;
    renderNotice();
    noticeTrigger = trigger;
    notice.hidden = false;
  }
  dismiss.onclick = () => {
    clearNotice();
    if (noticeTrigger && !noticeTrigger.disabled) noticeTrigger.focus();
  };
  function showError(error, trigger = button) {
    const reason = typeof error === 'string' ? error : error?.message;
    const translated = reason && t(reason);
    showNotice(translated ? reason : (trigger === button ? 'window_failed' : 'player_failed'), trigger);
  }
  const cinema = document.getElementById('autoPurify');
  cinema.checked = false;
  cinema.disabled = true;
  chrome.tabs.query({ active: true, currentWindow: true }).then(async tabs => {
    const tab = tabs[0];
    if (!tab || !/^https?:\/\//.test(tab.url || '')) return;
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'vp-cinema-status' });
    if (result?.ok) cinema.checked = !!result.active;
  }).catch(() => {}).finally(() => { cinema.disabled = false; });
  cinema.onchange = async () => {
    const wanted = cinema.checked;
    cinema.disabled = true;
    clearNotice();
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || !/^https?:\/\//.test(tab.url || '')) throw Error('window_unavailable');
      let result;
      try { result = await chrome.tabs.sendMessage(tab.id, { type: 'vp-cinema-set', active: wanted }); }
      catch (_) {
        try {
          const connected = await chrome.runtime.sendMessage({ type: 'vp-page-connect', tabId: tab.id });
          if (!connected?.ok) throw Error();
          result = await chrome.tabs.sendMessage(tab.id, { type: 'vp-cinema-set', active: wanted });
        } catch (_) { throw Error('window_page_unavailable'); }
      }
      if (!result?.ok) throw Error(result?.error || 'window_page_unavailable');
      cinema.checked = !!result.active;
    } catch (error) {
      cinema.checked = !wanted;
      showError(error, cinema);
    } finally { cinema.disabled = false; }
  };
  let tabId;
  let active = false;
  chrome.tabs.query({ active: true, currentWindow: true }).then(async tabs => {
    const tab = tabs[0];
    if (!tab || !/^https?:\/\//.test(tab.url || '')) {
      showError('window_unavailable'); return;
    }
    tabId = tab.id;
    const result = await chrome.runtime.sendMessage({ type: 'vp-window-status', tabId });
    if (!result || result.ok === false) {
      showError(result?.error || 'No response from extension background'); return;
    }
    active = !!result.active;
    button.checked = active;
    button.disabled = false;
  }).catch(showError);
  button.onchange = async () => {
    button.disabled = true;
    clearNotice();
    try {
      const result = await chrome.runtime.sendMessage({ type: active ? 'vp-window-return' : 'vp-window-open', tabId });
      if (!result?.ok) {
        showError(result?.error || 'No response from extension background');
        button.checked = active;
        button.disabled = false; return;
      }
      active = !!result.active;
      button.checked = active;
      if (result.warning) {
        showNotice(t(result.warning) ? result.warning : 'player_not_ready', button);
        button.disabled = false;
      } else window.close();
    } catch (error) {
      showError(error);
      button.checked = active;
      button.disabled = false;
    }
  };
})();
