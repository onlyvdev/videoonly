// Uses the same external Playwright/Chromium environment as browser-diagnostics.cjs.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const video = '<div id="video-wrap" style="width:640px;height:360px"><video id="main-video" controls style="width:100%;height:100%"></video></div>';
const controls = '<div id="controls" class="playback-controls" style="height:40px;background:#333"><button>Play</button><input type="range" aria-label="Seek"></div>';
const fixed = controls.replace('height:40px', 'position:fixed;bottom:0;left:0;width:640px;height:40px');
const cases = [
  ['native', video, false],
  ['sibling', '<main>'+video+controls+'</main>', true],
  ['nested sibling', '<main><section>'+video+'</section>'+controls+'</main>', true],
  ['body portal', video+fixed, true],
  ['compact portal', video+fixed.replace('width:640px;', ''), true],
  ['wrapped portal', video+'<div id="portal" style="position:relative;z-index:1">'+fixed+'<div id="portal-ad">Ad</div></div>', true],
  ['unrelated range', '<main style="display:flex">'+video+'<aside id="sidebar">Recommendations<input type="range"></aside></main>', false],
  ['unrelated controls', '<main style="display:flex">'+video+'<aside id="sidebar"><div class="controls"><button>Previous</button><button>Next</button></div></aside></main>', false],
  ['unrelated floater', video+'<div id="sidebar" class="timeline-control" style="position:fixed;bottom:0">Ad</div>', false],
  ['other video controls', video+'<section><video id="other"></video>'+fixed.replace('class="playback-controls"','class="playback-controls" aria-controls="other"')+'</section>', false],
  ['linked portal', video+fixed.replace('class="playback-controls"','aria-controls="main-video"'), true],
  ['plyr', '<main class="plyr">'+video+controls+'</main>', true],
];
(async () => {
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
  try {
    for (const viewport of [{width:1280,height:800},{width:800,height:500}]) {
      for (const [name, html, expectedControls] of cases) {
        const page = await browser.newPage({viewport});
        await page.setContent('<style>body{margin:0}button{height:30px}</style>'+html);
        await page.addScriptTag({path:path.join(root,'content/common.js')});
        await page.evaluate(()=>{VP.rules={callFindPlayer:()=>null,callIsVideoUrl:()=>true};});
        for (const file of ['detect.js','purify.js']) await page.addScriptTag({path:path.join(root,'content',file)});
        assert.equal(await page.evaluate(()=>VP.purify.enter()), true, name+' enters');
        const inspect = () => page.evaluate(()=>{
          const c=document.getElementById('controls');
          const s=document.getElementById('sidebar');
          const ad=document.getElementById('portal-ad');
          const rect=document.querySelector('video').getBoundingClientRect();
          const cr=c?.getBoundingClientRect();
          const top=c && cr.height ? document.elementFromPoint(cr.left+5,cr.top+5) : null;
          return {container:VP.purify.getPlayer().container.id,controls:!!cr?.height,
            sidebar:s?!!s.getBoundingClientRect().height:false,ad:ad?!!ad.getBoundingClientRect().height:false,
            width:rect.width,height:rect.height,bottom:cr?.bottom,onTop:!!top&&(top===c||c.contains(top))};
        });
        const result=await inspect();
        assert.equal(result.controls,expectedControls,name+' controls');
        assert.equal(result.sidebar,false,name+' sidebar');
        assert.equal(result.ad,false,name+' ad');
        if(name!=='plyr') {
          assert.equal(result.container,'video-wrap',name+' keeps video container');
          assert.equal(result.width,viewport.width,name+' fills viewport width');
          assert.equal(result.height,viewport.height,name+' fills viewport height');
          if(expectedControls) {
            assert.equal(result.bottom,viewport.height,name+' anchors controls');
            assert.equal(result.onTop,true,name+' controls receive pointer input');
          }
        }
        await page.evaluate(()=>VP.purify.reapply());
        assert.deepEqual(await inspect(),result,name+' reapply is stable');
        await page.evaluate(()=>VP.purify.exit());
        assert.equal(await page.locator('.vp-on,.vp-hide,.vp-path,.vp-stage,.vp-controls,.vp-controls-path').count(),0,name+' cleans up');
        await page.close();
        console.log('PASS '+viewport.width+' '+name);
      }
    }
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    await page.setContent('<main>'+video+'</main>');
    await page.addScriptTag({path:path.join(root,'content/common.js')});
    await page.evaluate(()=>{VP.rules={callFindPlayer:()=>null,callIsVideoUrl:()=>true};});
    for(const file of ['detect.js','purify.js'])await page.addScriptTag({path:path.join(root,'content',file)});
    await page.evaluate(()=>VP.purify.enter());
    await page.evaluate(html=>document.querySelector('main').insertAdjacentHTML('beforeend',html),controls);
    await page.waitForFunction(()=>document.querySelector('#controls.vp-controls'));
    await page.evaluate(()=>document.getElementById('controls').outerHTML=document.getElementById('controls').outerHTML.replace('id="controls"','id="replacement"'));
    await page.waitForFunction(()=>VP.purify.getPlayer().controls[0]?.id==='replacement');
    await page.evaluate(()=>document.getElementById('replacement').remove());
    await page.waitForFunction(()=>VP.purify.getPlayer().controls.length===0);
    await page.evaluate(()=>VP.purify.exit());
    assert.equal(await page.locator('.vp-on,.vp-hide,.vp-path,.vp-stage,.vp-controls,.vp-controls-path').count(),0);
    console.log('PASS late controls, replacement, removal and exit');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
