/* Move the existing tab so playback and page state survive window changes. */
'use strict';
const busy = new Set();
const connections = new Map();
const expectedFailures = new Set([
  'window_unavailable', 'window_page_unavailable', 'window_busy',
  'toast_no_video', 'player_in_frame', 'player_frame_unknown', 'player_not_ready', 'player_failed',
]);
const keyFor = id => `playerWindow:${id}`;
async function step(label, action) {
  try { return await action(); }
  catch (error) { throw new Error(label + ': ' + (error?.message || String(error))); }
}
async function recordFor(id) {
  return (await chrome.storage.session.get(keyFor(id)))[keyFor(id)];
}
async function notify(id, message) {
  try { return await chrome.tabs.sendMessage(id, message, { frameId: 0 }); } catch (_) { return null; }
}
// Recovery is only requested by an explicit playback action; passive status reads never inject.
async function ensurePage(id) {
  if (connections.has(id)) return connections.get(id);
  const pending = (async () => {
    const ready = await notify(id, { type: 'vp-cinema-status' });
    if (ready?.ok) return true;
    const tab = await chrome.tabs.get(id);
    if (!/^https?:\/\//.test(tab.url || '')) return false;
    try {
      const files = chrome.runtime.getManifest().content_scripts[0].js;
      await chrome.scripting.executeScript({ target: { tabId: id, frameIds: [0] }, files });
      return !!(await notify(id, { type: 'vp-cinema-status' }))?.ok;
    } catch (_) {
      // Restricted pages, withheld site access or navigation can prevent reconnection.
      return false;
    }
  })();
  connections.set(id, pending);
  try { return await pending; }
  finally { connections.delete(id); }
}
async function status(id) {
  const record = await recordFor(id);
  if (!record) return { active: false };
  const tab = await step('tabs.get', () => chrome.tabs.get(id));
  if (tab.windowId !== record.popupWindowId) return { active: false };
  return { active: true, wasActive: record.wasActive };
}
async function openPlayer(id) {
  if ((await status(id)).active) return { ok: true, active: true };
  const tab = await step('tabs.get', () => chrome.tabs.get(id));
  if (!/^https?:\/\//.test(tab.url || '')) throw Error('window_unavailable');
  let prepared = await notify(id, { type: 'vp-window-prepare' });
  if (!prepared && await ensurePage(id)) prepared = await notify(id, { type: 'vp-window-prepare' });
  if (!prepared) throw Error('window_page_unavailable');
  if (prepared.ok === false) throw Error(prepared.error || 'player_failed');
  // A ready page can move even while its video is loading.
  // The content script retries cinema detection after the window opens.
  const record = { windowId: tab.windowId, index: tab.index, wasActive: prepared.wasActive };
  try {
    // Persist before moving: the action popup may close as soon as focus changes.
    await step('storage.session.set', () => chrome.storage.session.set({ [keyFor(id)]: record }));
    const win = await step('windows.create', () => chrome.windows.create({ tabId: id, type: 'popup', incognito: tab.incognito, width: 800, height: 500, focused: true }));
    if (!Number.isInteger(win?.id)) throw Error('windows.create: browser returned no window ID');
    record.popupWindowId = win.id;
    await step('storage.session.set', () => chrome.storage.session.set({ [keyFor(id)]: record }));
  } catch (error) {
    await notify(id, { type: 'vp-window-stop', wasActive: record.wasActive });
    await chrome.storage.session.remove(keyFor(id));
    throw error;
  }
  await notify(id, { type: 'vp-window-start' });
  return { ok: true, active: true, warning: prepared.playerFound === false ? 'player_not_ready' : undefined };
}
async function restorePlayer(id) {
  const record = await recordFor(id);
  if (!record) return { ok: true, active: false };
  let destination;
  try { destination = await chrome.windows.get(record.windowId); } catch (_) {}
  // tabs.move only supports normal windows. Convert the popup via windows.create first.
  const tab = await step('tabs.get', () => chrome.tabs.get(id));
  const current = await chrome.windows.get(tab.windowId);
  if (current.type !== 'normal') {
    await chrome.windows.create({ tabId: id, type: 'normal', incognito: tab.incognito, focused: true });
  }
  if (destination?.type === 'normal') {
    try {
      const tabs = await chrome.tabs.query({ windowId: destination.id });
      await chrome.tabs.move(id, { windowId: destination.id, index: Math.min(record.index, tabs.length) });
      await chrome.tabs.update(id, { active: true });
      await chrome.windows.update(destination.id, { focused: true });
    } catch (_) {
      // If the original window closes during return, the tab remains in its new normal window.
    }
  }
  await chrome.storage.session.remove(keyFor(id));
  await notify(id, { type: 'vp-window-stop', wasActive: record.wasActive });
  return { ok: true, active: false };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['vp-window-status', 'vp-window-open', 'vp-window-return', 'vp-page-connect'].includes(message?.type)) return;
  const id = sender.tab?.id ?? message.tabId;
  if (!Number.isInteger(id) || sender.id !== chrome.runtime.id) return;
  (async () => {
    if (message.type === 'vp-window-status') return status(id);
    if (message.type === 'vp-page-connect') {
      return await ensurePage(id) ? { ok: true } : { ok: false, error: 'window_page_unavailable' };
    }
    if (busy.has(id)) throw Error('window_busy');
    busy.add(id);
    try {
      return await (message.type === 'vp-window-open' ? openPlayer(id) : restorePlayer(id));
    } finally { busy.delete(id); }
  })().then(respond, error => {
    if (!expectedFailures.has(error.message)) console.error('[VP] Window operation failed:', message.type, error);
    respond({ ok: false, error: error.message });
  });
  return true;
});
chrome.tabs.onRemoved.addListener(id => { chrome.storage.session.remove(keyFor(id)).catch(() => {}); });
