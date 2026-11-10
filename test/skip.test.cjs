const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../content/skip.js'), 'utf8');
function fixture({duration=2880,headSec=120,tailSec=2760,handled=true}={}) {
 const events={};let next=0;
 const video={duration,currentTime:1,paused:false,ended:false,
  play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true},
  addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const VP={log(){},formatSec:String,config:{getSync:()=>({enabled:true,skipHead:true,skipTail:true}),resolveFor:()=>({headSec,tailSec})}};
 vm.runInNewContext(source,{window:{VP},location:{href:'https://example.test/episode'}});
 VP.skip.attach(video,{onNeedNext:()=>{next++;return handled}});
 return {video,events,next:()=>next};
}
test('00:02:00–00:46:00 preserves the entire middle of a 48 minute episode',()=>{
 const f=fixture();f.events.timeupdate();assert.equal(f.video.currentTime,120);
 for(const time of [120,121,600,1800,2759.9]){
  f.video.currentTime=time;f.events.timeupdate();assert.equal(f.video.currentTime,time);assert.equal(f.next(),0);assert.equal(f.video.paused,false);
 }
 f.video.currentTime=2760;f.events.timeupdate();assert.equal(f.next(),1);
 f.events.timeupdate();f.events.ended();assert.equal(f.next(),1);
});
test('without a next episode, playback still continues until the configured end',()=>{
 const f=fixture({handled:false});f.events.timeupdate();f.events.timeupdate();assert.equal(f.video.currentTime,120);assert.equal(f.video.paused,false);
 f.video.currentTime=2760;f.events.timeupdate();assert.equal(f.video.paused,true);assert.equal(f.next(),1);
});
test('intro beyond a short clip duration never seeks to its end',()=>{
 const f=fixture({duration:60});f.events.timeupdate();assert.equal(f.video.currentTime,1);assert.equal(f.next(),0);
});
test('reversed interval cannot jump across the main content',()=>{
 const f=fixture({headSec:120,tailSec:60});f.events.timeupdate();f.events.timeupdate();assert.equal(f.video.currentTime,1);assert.equal(f.next(),0);
});
test('metadata reload resets once-per-episode intro and tail state',()=>{
 const f=fixture();f.events.timeupdate();f.video.currentTime=2760;f.events.timeupdate();f.events.loadedmetadata();f.video.currentTime=1;f.events.timeupdate();assert.equal(f.video.currentTime,120);f.events.timeupdate();assert.equal(f.next(),1);
});

test('47:22 episode with 01:30–45:00 does not advance at the old 02:22 threshold', () => {
 const f = fixture({ duration: 2842, headSec: 90, tailSec: 2700 });
 f.events.timeupdate();
 assert.equal(f.video.currentTime, 90);
 for (const time of [90, 142, 143, 1800, 2699.9]) {
  f.video.currentTime = time;
  f.events.timeupdate();
  assert.equal(f.next(), 0);
  assert.equal(f.video.currentTime, time);
  assert.equal(f.video.paused, false);
 }
 f.video.currentTime = 2700;
 f.events.timeupdate();
 assert.equal(f.next(), 1);
 f.events.ended();
 assert.equal(f.next(), 1);
});
