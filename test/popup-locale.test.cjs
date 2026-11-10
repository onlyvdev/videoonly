const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
async function fixture(name, locale='en', tailSec=2640) {
 const rule={id:'saved',name,urlPattern:'/watch/show',headSec:90,tailSec,enabled:true};
 const elements={}; const el=id=>elements[id]||(elements[id]={value:'00',max:60,addEventListener(){},textContent:'',innerHTML:''});
 const data={locale,rules:[rule]};
 const chrome={storage:{sync:{get:(defaults,cb)=>cb({...defaults,...data}),set:(patch,cb)=>{Object.assign(data,patch);cb?.()}},onChanged:{addListener(){}}},windows:{getCurrent:(opts,cb)=>cb({tabs:[{active:true,url:'https://example.test/watch/show/1'}]})},runtime:{openOptionsPage(){}}};
 const context=vm.createContext({window:{},chrome,document:{getElementById:el,querySelectorAll:()=>[]},navigator:{language:locale},setTimeout:()=>{},clearTimeout(){},URL,crypto:{randomUUID:()=> 'new-id'}});
 for(const file of ['content/common.js','content/i18n.js','content/config.js','popup/popup.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 return {context,elements,rule,data};
}
test('English footer handles existing Chinese generated names and timestamp endpoints',async()=>{
 const f=await fixture('来自弹窗 2026/11/9');
 assert.equal(f.elements.matchInfo.innerHTML,'Active: <b>Rule "/watch/show"</b> · starts at 00:01:30 / ends at 00:44:00');
 assert.equal(f.rule.name,'来自弹窗 2026/11/9');
});
test('Chinese footer handles existing English generated names',async()=>{
 const f=await fixture('From popup 11/9/2026','zh_CN');
 assert.match(f.elements.matchInfo.innerHTML,/规则「\/watch\/show」/);
 assert.doesNotMatch(f.elements.matchInfo.innerHTML,/From popup/);
});
test('custom names are preserved and escaped as text',async()=>{
 const f=await fixture('我的剧 &lt;svg&gt;');
 assert.match(f.elements.matchInfo.innerHTML,/我的剧 &amp;lt;svg&amp;gt;/);
});
test('unset ending is not presented as midnight',async()=>{
 const f=await fixture('Custom','en',0);
 assert.match(f.elements.matchInfo.innerHTML,/ends at Not set$/);
});
test('new popup rules store a language-neutral matching path',async()=>{
 const f=await fixture('Old');
 f.elements.deleteRule.onclick();
 f.elements.rulePattern.value='/watch/new';
 f.elements.headM.value='1';f.elements.headS.value='30';f.elements.tailM.value='44';
 f.elements.saveRule.onclick();
 assert.equal(f.data.rules[0].name,'/watch/new');
 assert.equal(f.data.rules[0].headSec,90);
 assert.equal(f.data.rules[0].tailSec,2640);
});
