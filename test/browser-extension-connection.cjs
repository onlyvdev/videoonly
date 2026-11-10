// Uses an isolated extension copy and browser profile; never touches the user's browser.
// Localhost host permission stands in for the temporary activeTab grant in this automated fixture.
const { chromium }=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'onlyv-connection-'));
 const extension=path.join(temp,'extension');fs.mkdirSync(extension);
 for(const name of ['content','background','popup','options','_locales','icons','assets'])fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 // Disable automatic injection in the fixture to reproduce an already-open, unconnected page.
 manifest.content_scripts[0].matches=['http://unmatched.invalid/*'];
 manifest.host_permissions=['http://127.0.0.1/*'];
 fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
 // Exercise the registered worker handler with action-popup sender metadata.
 // A test page opened as an extension tab would have sender.tab and target itself.
 const background=path.join(extension,'background/window-player.js');
 fs.writeFileSync(background,`const addMessageListener = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage);
 chrome.runtime.onMessage.addListener = listener => { globalThis.testMessageListener = listener; addMessageListener(listener); };
`+fs.readFileSync(background,'utf8'));
 const server=http.createServer((req,res)=>res.end('<!doctype html><div id="player" style="width:900px;height:600px"><video controls style="width:100%;height:100%"></video></div>'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let context;
 try{
  context=await chromium.launchPersistentContext(path.join(temp,'profile'),{headless:false,args:['--headless=new','--no-sandbox',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const url='http://127.0.0.1:'+server.address().port+'/watch';
  const tab=await worker.evaluate(async url=>chrome.tabs.create({url}),url);
  const send=type=>worker.evaluate(({type,tabId})=>new Promise(resolve=>globalThis.testMessageListener({type,tabId},{id:chrome.runtime.id},resolve)),{type,tabId:tab.id});
  const inspect=()=>worker.evaluate(async tabId=>(await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>({initialized:!!window.VP?.windowPlayer,active:!!window.VP?.purify?.isActive()})}))[0].result,tab.id);
  assert.equal((await inspect()).initialized,false);
  await send('vp-window-status');assert.equal((await inspect()).initialized,false);
  const opened=await send('vp-window-open');
  assert.equal(opened.ok,true,JSON.stringify(opened));
  assert.equal((await inspect()).active,true);
  const moved=await worker.evaluate(async tabId=>{const t=await chrome.tabs.get(tabId);return {id:t.id,window:await chrome.windows.get(t.windowId)};},tab.id);
  assert.equal(moved.id,tab.id);assert.equal(moved.window.type,'popup');
  assert.equal((await send('vp-window-return')).ok,true);
  assert.equal((await inspect()).active,false);
  console.log('PASS real extension: disconnected page recovered, same tab moved and returned');
  // Reinjecting the manifest files must preserve module identities and a single Alt+V listener.
  const same=await worker.evaluate(async tabId=>{
   await chrome.scripting.executeScript({target:{tabId},func:()=>{window.savedVP={purify:VP.purify,ui:VP.ui,rules:VP.rules,wake:VP.wake};}});
   await chrome.scripting.executeScript({target:{tabId},files:chrome.runtime.getManifest().content_scripts[0].js});
   return (await chrome.scripting.executeScript({target:{tabId},func:()=>{
    const same=Object.entries(window.savedVP).every(([key,value])=>VP[key]===value);
    document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyV',altKey:true,bubbles:true}));
    return {same,active:VP.purify.isActive()};
   }}))[0].result;
  },tab.id);
  assert.deepEqual(same,{same:true,active:true});
  console.log('PASS real extension: reinjection is idempotent and Alt+V toggles once');
  await worker.evaluate(async tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>VP.purify.exit()}),tab.id);
  const nextWorker=context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.runtime.reload()).catch(()=>{});
  worker=await nextWorker;
  const afterReload=await send('vp-window-open');
  assert.equal(afterReload.ok,true,JSON.stringify(afterReload));
  assert.equal((await inspect()).active,true);
  assert.equal((await send('vp-window-return')).ok,true);
  console.log('PASS real extension: reload recovery works without refreshing the video page');
 }finally{
  if(context)await context.close();await new Promise(resolve=>server.close(resolve));
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
