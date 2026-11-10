// NODE_PATH=<temporary dependencies>/node_modules node test/browser-diagnostics.cjs
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req,res)=>{
 const file=path.join(root,new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
 window.mockFailure='window_page_unavailable';
 window.chrome={i18n:{getUILanguage:()=> 'en'},storage:{onChanged:{addListener(){}},sync:{get:(defaults,cb)=>cb(defaults),set:async()=>{}}},runtime:{id:'local-test',getURL:p=>'/'+p,onMessage:{addListener:f=>window.messageHandler=f},sendMessage:async msg=>msg.type==='vp-window-status'?{active:false}:{ok:false,error:window.mockFailure}},tabs:{query:async()=>[{id:1,url:'http://localhost/video'}],sendMessage:async()=>{throw Error('Receiving end does not exist')}},windows:{getCurrent:(opts,cb)=>cb({tabs:[]})}};
 });
 const base='http://127.0.0.1:'+server.address().port;
 const scripts=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).content_scripts[0].js;
 for(const [kind,expected] of [['empty','No video detected'],['frame','inside an iframe'],['opaque','inaccessible iframe']]){
 await page.goto(base+'/test/diagnostics-page.html?case='+kind);
 if(kind!=='empty')await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.length===0);
 for(const script of scripts)await page.addScriptTag({url:base+'/'+script});
 await page.waitForTimeout(100);
 await page.keyboard.press('Alt+v');
 const toast=page.locator('#vp-toast');await toast.waitFor({state:'visible'});assert.match(await toast.textContent(),new RegExp(expected));
 console.log('PASS browser Alt+V '+kind);
 await page.evaluate(()=>{window.mockFailure=VP.diagnostics.failureReason();});
 await page.keyboard.press('Alt+p');
 await page.waitForTimeout(50);
 assert.match(await toast.textContent(),new RegExp(expected));
 console.log('PASS browser Alt+P '+kind);
 }
 await page.goto(base+'/test/diagnostics-page.html?case=loading');
 for(const script of scripts)await page.addScriptTag({url:base+'/'+script});
 assert.equal(await page.evaluate(()=>VP.diagnostics.failureReason()),'player_not_ready');console.log('PASS browser loading diagnosis');
 // A saved automatic-start preference must never activate a fresh page.
 await page.goto(base+'/test/diagnostics-page.html?case=empty');
 await page.evaluate(()=>{
   document.body.innerHTML='<div id="player" style="width:900px;height:600px"><video style="width:100%;height:100%"></video></div>';
   chrome.storage.sync.get=(defaults,cb)=>cb({...defaults,autoPurify:true});
 });
 for(const script of scripts)await page.addScriptTag({url:base+'/'+script});
 await page.waitForTimeout(1900);
 assert.equal(await page.evaluate(()=>VP.purify.isActive()),false);
 assert.equal(await page.evaluate(()=>VP.state.video),null);
 assert.equal(await page.evaluate(()=>VP.config.getSync().autoPurify),false);
 await page.keyboard.press('Alt+v');
 assert.equal(await page.evaluate(()=>VP.purify.isActive()),true);
 assert.equal(await page.evaluate(()=>VP.state.video===document.querySelector('video')),true);
 assert.equal(await page.evaluate(()=>{let reply;window.messageHandler({type:'vp-cinema-status'},{id:'local-test'},r=>reply=r);return reply.active;}),true);
 await page.evaluate(()=>VP.config.onChanged());
 assert.equal(await page.evaluate(()=>VP.purify.isActive()),true);
 await page.keyboard.press('Alt+v');
 assert.equal(await page.evaluate(()=>VP.purify.isActive()),false);
 assert.equal(await page.evaluate(()=>VP.state.video),null);
 await page.keyboard.press('Alt+v');
 assert.equal(await page.evaluate(()=>VP.state.video===document.querySelector('video')),true);
 await page.evaluate(()=>window.messageHandler({type:'vp-cinema-set',active:false},{id:'local-test'},()=>{}));
 assert.equal(await page.evaluate(()=>VP.purify.isActive()),false);
 await page.evaluate(()=>window.messageHandler({type:'vp-cinema-set',active:true},{id:'local-test'},()=>{}));
 assert.equal(await page.evaluate(()=>VP.state.video===document.querySelector('video')),true);
 await page.reload();
 for(const script of scripts)await page.addScriptTag({url:base+'/'+script});
 assert.equal(await page.evaluate(()=>VP.purify.isActive()),false);
 console.log('PASS browser legacy auto-start ignored, Alt+V, current-tab status, settings update, re-entry and reload');
 await page.goto(base+'/popup/popup.html');await page.waitForFunction(()=>!document.getElementById('windowPlayer').disabled);
 await page.evaluate(async()=>{const el=document.getElementById('autoPurify');el.checked=true;await el.onchange();});
 assert.match(await page.locator('#playbackStatus').textContent(),/not connected/);assert.equal(await page.locator('#autoPurify').isChecked(),false);
 await page.evaluate(async()=>{window.mockFailure='player_in_frame';await document.getElementById('windowPlayer').onchange();});
 assert.match(await page.locator('#playbackStatus').textContent(),/inside an iframe/);console.log('PASS browser popup failure messages and switch rollback');
 await page.evaluate(()=>{
   chrome.tabs.sendMessage=async()=>({ok:false,error:'player_frame_unknown'});
   window.mockFailure='player_frame_unknown';
 });
 await page.evaluate(async()=>{const el=document.getElementById('autoPurify');el.checked=true;await el.onchange();});
 await page.evaluate(async()=>{await document.getElementById('windowPlayer').onchange();});
 assert.equal(await page.locator('[role="status"]:visible').count(),1);
 assert.match(await page.locator('#playbackStatus').textContent(),/inaccessible iframe/);
 await page.locator('#dismissPlaybackNotice').click();
 assert.equal(await page.locator('#playbackNotice').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'windowPlayer');
 await page.evaluate(async()=>{await document.getElementById('windowPlayer').onchange();});
 assert.equal(await page.locator('#playbackNotice').isVisible(),true);
 await page.evaluate(()=>{chrome.tabs.sendMessage=async(id,msg)=>({ok:true,active:msg.active});});
 await page.evaluate(async()=>{const el=document.getElementById('autoPurify');el.checked=true;await el.onchange();});
 assert.equal(await page.locator('#playbackNotice').isVisible(),false);
 assert.equal(await page.locator('#autoPurify').isChecked(),true);
 console.log('PASS browser shared notice, dismissal, retry, focus and success cleanup');
 await page.setViewportSize({width:340,height:600});
 const locales=await page.evaluate(()=>VP.i18n.available());
 for (const locale of locales) {
  await page.evaluate(async locale=>{await new Promise(resolve=>VP.i18n.setLocale(locale,resolve));VP.i18n.applyDom();window.mockFailure='player_frame_unknown';await document.getElementById('windowPlayer').onchange();},locale);
  assert.equal(await page.evaluate(()=>VP.i18n.locale()),locale);
  assert.equal(await page.locator('#playbackStatus').textContent(),await page.evaluate(()=>VP.i18n.t('player_frame_unknown')));
  assert.equal(await page.locator('#dismissPlaybackNotice').getAttribute('title'),await page.evaluate(()=>VP.i18n.t('dismiss_notice')));
  for (const colorScheme of ['light','dark']) {
   await page.emulateMedia({colorScheme});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth),false);
   if(process.env.ONLYV_SCREENSHOT_DIR)await page.screenshot({path:process.env.ONLYV_SCREENSHOT_DIR+'/popup-'+locale+'-'+colorScheme+'.png',clip:{x:0,y:0,width:340,height:600}});
  }
 }
 console.log('PASS browser all 32 locales: translated notices, close labels, light/dark themes and no horizontal overflow');
 assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
