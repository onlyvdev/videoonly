const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'content/i18n.js'),'utf8');
function fixture(language='en',fetcher){
 const VP={log(){},warn(){}};
 const document={documentElement:{},querySelectorAll:()=>[]};
 const context={window:{VP},document,navigator:{language},chrome:{runtime:{getURL:p=>p}},fetch:fetcher||(async p=>({json:async()=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))}))};
 vm.runInNewContext(source.replace('const DICTS = {','const DICTS = window.dictionaries = {'),context);
 return {VP,context,dicts:context.window.dictionaries};
}
function noDuplicates(text,pattern,label){
 const seen=new Set();for(const match of text.matchAll(pattern)){assert.ok(!seen.has(match[1]),label+' duplicate '+match[1]);seen.add(match[1]);}
}
const placeholders=text=>(text.match(/\$\d+/g)||[]).sort();
test('all 32 dictionaries have the same 82 nonempty keys, correct placeholders and no duplicates',()=>{
 const f=fixture();const dictionaries={...f.dicts};
 for(const locale of ['zh_CN','en']){
  const part=source.split('    '+locale+': {')[1].split('\n    },')[0];
  noDuplicates(part,/^      (\w+):/gm,locale);
 }
 for(const file of fs.readdirSync(path.join(root,'content/locales'))){
  const raw=fs.readFileSync(path.join(root,'content/locales',file),'utf8');
  noDuplicates(raw,/^\s*"([^"\n]+)"\s*:/gm,file);
  dictionaries[path.basename(file,'.json')]=JSON.parse(raw);
 }
 assert.deepEqual(Object.keys(dictionaries).sort(),Array.from(f.VP.i18n.available()).sort());
 const keys=Object.keys(dictionaries.en).sort();assert.equal(keys.length,82);
 for(const [locale,dict] of Object.entries(dictionaries)){
  assert.deepEqual(Object.keys(dict).sort(),keys,locale+' key coverage');
  for(const key of keys){
   assert.equal(typeof dict[key],'string',locale+' '+key);
   assert.ok(dict[key].trim(),locale+' '+key+' empty');
   assert.deepEqual(placeholders(dict[key]),placeholders(dictionaries.en[key]),locale+' '+key+' placeholders');
   assert.ok(!dict[key].includes('\uFFFD'),locale+' '+key+' encoding');
  }
  assert.ok(!/\$[23]\s*s\b/.test(dict.pop_cur_match),locale+' must format timestamps, not seconds');
 }
});
test('all literal translation references and manifest messages resolve',()=>{
 const {dicts}=fixture();const keys=new Set(Object.keys(dicts.en));
 function scan(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name);if(item.isDirectory())scan(file);
  else if(/\.(?:js|html)$/.test(file)){
   const raw=fs.readFileSync(file,'utf8');
   for(const re of [/\bt\(\s*['"]([\w]+)['"]/g,/data-i18n(?:-title|-placeholder)?=["']([\w]+)["']/g]){
    for(const match of raw.matchAll(re))assert.ok(keys.has(match[1]),file+' unknown key '+match[1]);
   }
  }
 }}
 for(const dir of ['content','popup','options'])scan(path.join(root,dir));
 const manifest=fs.readFileSync(path.join(root,'manifest.json'),'utf8');
 for(const locale of fs.readdirSync(path.join(root,'_locales'))){
  const file=path.join(root,'_locales',locale,'messages.json'),raw=fs.readFileSync(file,'utf8');
  noDuplicates(raw,/^  "([^"\n]+)"\s*:/gm,file);const messages=JSON.parse(raw);
  for(const [,key] of manifest.matchAll(/__MSG_(\w+)__/g))assert.ok(messages[key]?.message,locale+' '+key);
 }
});
test('all locale files load and every error uses its own translated value',async()=>{
 const f=fixture();
 for(const locale of f.VP.i18n.available()){
  await new Promise(resolve=>f.VP.i18n.setLocale(locale,resolve));
  assert.equal(f.VP.i18n.locale(),locale);
  const dict=f.context.window.dictionaries[locale];
  for(const key of Object.keys(dict).filter(k=>/^(window_|player_|toast_|dismiss_notice|playback_notice)/.test(k)))assert.equal(f.VP.i18n.t(key),dict[key]);
  f.VP.i18n.applyDom();assert.equal(f.context.document.documentElement.lang,locale.replace('_','-'));
 }
});
test('Norwegian browser codes and regional locale tags normalize correctly',async()=>{
 for(const [code,expected] of [['nb-NO','no'],['nn-NO','no'],['zh-Hant-HK','zh_TW'],['pt_BR','pt'],['fr-CA','fr']]){
  const f=fixture(code);await new Promise(resolve=>f.VP.i18n.setLocale('auto',resolve));assert.equal(f.VP.i18n.locale(),expected);
 }
});
test('a delayed locale updates a visible notice without reopening a dismissed one',async()=>{
 let finish;const f=fixture('en',()=>new Promise(resolve=>{finish=()=>resolve({json:async()=>JSON.parse(fs.readFileSync(path.join(root,'content/locales/ja.json'),'utf8'))});}));
 const elements=Object.fromEntries(['windowPlayer','playbackStatus','playbackNotice','dismissPlaybackNotice','autoPurify'].map(id=>[id,{hidden:true,textContent:'',focus(){}}]));
 f.context.document.getElementById=id=>elements[id];
 f.context.chrome.tabs={query:async()=>[{id:1,url:'https://example.test/watch'}],sendMessage:async()=>({ok:true,active:false})};
 f.context.chrome.runtime.sendMessage=async msg=>msg.type==='vp-window-status'?{ok:true,active:false}:{ok:false,error:'player_frame_unknown'};
 vm.runInNewContext(fs.readFileSync(path.join(root,'popup/window-player.js'),'utf8'),f.context);
 await new Promise(r=>setImmediate(r));await elements.windowPlayer.onchange();
 assert.equal(elements.playbackStatus.textContent,f.dicts.en.player_frame_unknown);
 const loaded=new Promise(resolve=>f.VP.i18n.setLocale('ja',resolve));finish();await loaded;
 assert.equal(elements.playbackStatus.textContent,f.dicts.ja.player_frame_unknown);
 elements.dismissPlaybackNotice.onclick();f.VP.i18n.setLocale('en');
 assert.equal(elements.playbackNotice.hidden,true);assert.equal(elements.playbackStatus.textContent,'');
});
