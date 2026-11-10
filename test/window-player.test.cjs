const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../background/window-player.js'), 'utf8');
function fixture({ noVideo = false, disconnected = false, failCreate = false, prepareError, recover = false, injectError = false, lostReply = false } = {}) {
  let listener, nextWindow = 20;
  const data = {}, notices = [], creates = [], injections = [], errors = [];
  let connected = !disconnected;
  const tab = { id: 7, windowId: 1, index: 2, url: 'https://example.com/watch', incognito: false };
  const windows = new Map([[1, { id: 1, type: 'normal' }]]);
  const chrome = {
    runtime: { id: 'extension', getManifest:()=>({content_scripts:[{js:['content/common.js','content/window-player.js']}]}), onMessage: { addListener: fn => listener = fn } },
    scripting: { executeScript: async options => { injections.push(options); if(injectError)throw Error('Cannot access this page'); if(recover)connected=true; } },
    storage: { session: {
      get: async key => ({ [key]: data[key] }),
      set: async patch => Object.assign(data, JSON.parse(JSON.stringify(patch))),
      remove: async key => { delete data[key]; },
    } },
    tabs: {
      get: async () => ({ ...tab }),
      query: async () => [{ id: 8 }],
      move: async (id, options) => {
        assert.equal(windows.get(tab.windowId).type, 'normal');
        assert.equal(windows.get(options.windowId).type, 'normal');
        tab.windowId = options.windowId;
      },
      update: async () => {},
      sendMessage: async (id, msg, options) => {
        assert.equal(options.frameId,0);
        notices.push(msg);
        if (!connected) { if(lostReply)return undefined;throw Error("Receiving end does not exist"); }
        return msg.type === 'vp-window-prepare' ? (prepareError ? { ok: false, error: prepareError } : { ok: true, playerFound: !noVideo, wasActive: false }) : { ok: true };
      },
      onRemoved: { addListener() {} },
    },
    windows: {
      get: async id => { if (!windows.has(id)) throw Error('closed'); return windows.get(id); },
      update: async () => {},
      create: async options => {
        if (failCreate) throw Error('create failed');
        assert.equal(options.tabId, 7);
        assert.equal(options.url, undefined); // no reload/duplicate video
        creates.push(options);
        const win = { id: nextWindow++, type: options.type };
        windows.set(win.id, win); tab.windowId = win.id;
        return win;
      },
    },
  };
  vm.runInNewContext(source, { chrome, Set, console: { error(...args) { errors.push(args); } } });
  const send = type => new Promise(resolve => listener({ type, tabId: 7 }, { id: 'extension' }, resolve));
  return { send, tab, windows, creates, notices, data, injections, errors };
}
test('opens existing tab; repeated open is idempotent; returns to source via normal window', async () => {
  const f = fixture();
  assert.equal((await f.send('vp-window-open')).ok, true);
  assert.equal((await f.send('vp-window-status')).active, true);
  await f.send('vp-window-open');
  assert.equal(f.creates.length, 1);
  assert.equal(f.creates[0].type, 'popup');
  assert.equal((await f.send('vp-window-return')).ok, true);
  assert.equal(f.tab.windowId, 1);
  assert.equal(f.creates[1].type, 'normal');
  assert.equal((await f.send('vp-window-status')).active, false);
  assert.equal(f.notices.at(-1).type, 'vp-window-stop');
});
test('closed source window returns into a new normal window', async () => {
  const f = fixture(); await f.send('vp-window-open'); f.windows.delete(1);
  assert.equal((await f.send('vp-window-return')).ok, true);
  assert.equal(f.windows.get(f.tab.windowId).type, 'normal');
});
test('video still loading does not prevent moving the existing tab', async () => {
  const f = fixture({ noVideo: true });
  assert.equal((await f.send('vp-window-open')).ok, true);
  assert.equal(f.creates.length, 1);
  assert.equal((await f.send('vp-window-return')).ok, true);
});
test('failed window creation restores cinema state and removes tracking', async () => {
  const f = fixture({ failCreate: true });
  const result = await f.send('vp-window-open');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'windows.create: create failed');
  assert.equal(f.tab.windowId, 1);
  assert.equal(Object.keys(f.data).length, 0);
  assert.equal(f.notices.at(-1).type, 'vp-window-stop');
});

test('disconnected content script gets a distinct refresh message', async () => {
  const f = fixture({ disconnected: true });
  assert.equal((await f.send('vp-window-open')).error, 'window_page_unavailable');
  assert.equal(f.creates.length, 0);
  assert.equal(f.errors.length,0);
});

test('explicit detection failure never moves the tab', async () => {
  for (const reason of ['toast_no_video', 'player_in_frame', 'player_frame_unknown', 'player_failed']) {
    const f = fixture({ prepareError: reason });
    assert.equal((await f.send('vp-window-open')).error, reason);
    assert.equal(f.creates.length, 0);
    assert.equal(Object.keys(f.data).length, 0);
  }
});

test('missing receiver is reconnected on demand before moving the existing tab',async()=>{
 for(const lostReply of [false,true]){
  const f=fixture({disconnected:true,recover:true,lostReply});
  const result=await f.send('vp-window-open');assert.equal(result.ok,true);
  assert.equal(f.injections.length,1);assert.equal(f.injections[0].target.tabId,7);
  assert.deepEqual(Array.from(f.injections[0].target.frameIds),[0]);
  assert.equal(f.creates.length,1);assert.equal(f.errors.length,0);
 }
});
test('reconnection is passive for status and shared by concurrent connect requests',async()=>{
 const f=fixture({disconnected:true,recover:true});
 await f.send('vp-window-status');assert.equal(f.injections.length,0);
 const results=await Promise.all([f.send('vp-page-connect'),f.send('vp-page-connect')]);
 assert.ok(results.every(r=>r.ok));assert.equal(f.injections.length,1);assert.equal(f.creates.length,0);
});
test('denied injection returns the localized error without moving a tab or logging a crash',async()=>{
 const f=fixture({disconnected:true,injectError:true});
 assert.equal((await f.send('vp-window-open')).error,'window_page_unavailable');
 assert.equal(f.creates.length,0);assert.equal(f.errors.length,0);
 const broken=fixture({failCreate:true});await broken.send('vp-window-open');assert.equal(broken.errors.length,1);
});
