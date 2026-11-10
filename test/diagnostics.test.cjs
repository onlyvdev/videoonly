const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function page(video = false, frames = []) {
  return { querySelector: () => video ? {} : null, querySelectorAll: () => frames };
}
function diagnose(doc) {
  const VP = {};
  vm.runInNewContext(source('content/diagnostics.js'), { window: { VP }, document: doc });
  return VP.diagnostics.failureReason();
}
test('no video, loading video, same-origin frame and inaccessible frame are distinct', () => {
  assert.equal(diagnose(page()), 'toast_no_video');
  assert.equal(diagnose(page(true)), 'player_not_ready');
  assert.equal(diagnose(page(false, [{contentDocument: page(true)}])), 'player_in_frame');
  assert.equal(diagnose(page(false, [{contentDocument: null}])), 'player_frame_unknown');
  assert.equal(diagnose(page(false, [{get contentDocument(){throw Error('SecurityError')}}])), 'player_frame_unknown');
  assert.equal(diagnose(page(false, [{contentDocument: page()}])), 'toast_no_video');
});
test('nested frame video is confirmed; inaccessible frame does not mask confirmed video', () => {
  assert.equal(diagnose(page(false, [{contentDocument:null}, {contentDocument:page(false,[{contentDocument:page(true)}])}])), 'player_in_frame');
});
function popup({ connected = true, error, warning, url = 'https://example.test', cinemaActive = false } = {}) {
  const elements = Object.fromEntries(['windowPlayer','playbackStatus','playbackNotice','dismissPlaybackNotice','autoPurify'].map(id=>[id,{checked:false,textContent:'',disabled:true,hidden:true,focus(){}}]));
  const writes=[];let closed=false;
  const chrome={tabs:{query:async()=>[{id:7,url}],sendMessage:async(id,msg)=>{if(!connected)throw Error('disconnected');if(msg.type==='vp-cinema-status')return{ok:true,active:cinemaActive};if(error)return{ok:false,error};cinemaActive=msg.active;return{ok:true,active:cinemaActive}}},storage:{sync:{set:async patch=>writes.push(patch)}},runtime:{sendMessage:async msg=>msg.type==='vp-window-status'?{active:false}:error?{ok:false,error}:{ok:true,active:true,warning}}};
  vm.runInNewContext(source('popup/window-player.js'),{document:{getElementById:id=>elements[id]},window:{VP:{i18n:{t:k=>k}},close:()=>closed=true},chrome});
  return {elements,writes,closed:()=>closed};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('popup fullscreen displays disconnected content script and restores switch', async()=>{
 const f=popup({connected:false});await flush();f.elements.autoPurify.checked=true;await f.elements.autoPurify.onchange();
 assert.equal(f.elements.playbackStatus.textContent,'window_page_unavailable');assert.equal(f.elements.autoPurify.checked,false);assert.equal(f.writes.length,0);
});
test('popup fullscreen displays precise detection failures; success only changes current page',async()=>{
 for(const error of ['toast_no_video','player_in_frame','player_frame_unknown','player_failed']){
 const f=popup({error});await flush();f.elements.autoPurify.checked=true;await f.elements.autoPurify.onchange();assert.equal(f.elements.playbackStatus.textContent,error);assert.equal(f.writes.length,0);
 }
 const f=popup();await flush();f.elements.autoPurify.checked=true;await f.elements.autoPurify.onchange();assert.equal(f.writes.length,0);assert.equal(f.elements.autoPurify.checked,true);
 f.elements.autoPurify.checked=false;await f.elements.autoPurify.onchange();assert.equal(f.elements.autoPurify.checked,false);
});
test('mini window failure remains visible; loading warning does not close popup',async()=>{
 const f=popup({error:'player_in_frame'});await flush();await f.elements.windowPlayer.onchange();assert.equal(f.elements.playbackStatus.textContent,'player_in_frame');assert.equal(f.closed(),false);
 const g=popup({warning:'player_not_ready'});await flush();await g.elements.windowPlayer.onchange();assert.equal(g.elements.playbackStatus.textContent,'player_not_ready');assert.equal(g.closed(),false);
});
test('both playback failures share one dismissible notice and retry reopens it',async()=>{
 const f=popup({error:'player_frame_unknown'});await flush();
 f.elements.autoPurify.checked=true;await f.elements.autoPurify.onchange();
 await f.elements.windowPlayer.onchange();
 assert.equal(f.elements.playbackNotice.hidden,false);
 assert.equal(f.elements.playbackStatus.textContent,'player_frame_unknown');
 assert.equal(f.elements.autoPurify.checked,false);
 assert.equal(f.elements.windowPlayer.checked,false);
 f.elements.dismissPlaybackNotice.onclick();
 assert.equal(f.elements.playbackNotice.hidden,true);
 assert.equal(f.elements.playbackStatus.textContent,'');
 await f.elements.windowPlayer.onchange();
 assert.equal(f.elements.playbackNotice.hidden,false);
});
test('popup has one live status and a real close button',()=>{
 const html=source('popup/popup.html');
 assert.equal((html.match(/role="status"/g)||[]).length,1);
 assert.match(html,/id="dismissPlaybackNotice"[^>]*type="button"/);
 assert.doesNotMatch(html,/id="(?:cinemaStatus|windowPlayerStatus)"/);
});
test('content message handler returns diagnosis for both entry points', () => {
 for (const reason of ['toast_no_video','player_in_frame','player_frame_unknown']) {
  let listener;
  const VP={purify:{isActive:()=>false,enter:()=>false},diagnostics:{failureReason:()=>reason}};
  vm.runInNewContext(source('content/window-player.js'),{window:{VP},chrome:{runtime:{id:'test',onMessage:{addListener:f=>listener=f},sendMessage:async()=>({active:false})}}});
  for(const type of ['vp-cinema-set','vp-window-prepare']){
   let result;listener({type,active:true},{id:'test'},r=>result=r);
   assert.equal(result.ok,false);assert.equal(result.error,reason);
  }
 }
});

test('popup reads current tab cinema state without activating it',async()=>{
 const f=popup({cinemaActive:true});await flush();assert.equal(f.elements.autoPurify.checked,true);assert.equal(f.writes.length,0);
 const g=popup();await flush();assert.equal(g.elements.autoPurify.checked,false);
});
