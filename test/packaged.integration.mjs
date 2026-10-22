import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),activate=require('../dist/listening-archive/index.cjs');
const root=path.resolve('.test-build/packaged-'+Date.now());fs.mkdirSync(root,{recursive:true});
const packaged=path.resolve('dist/listening-archive');
assert.deepEqual(fs.readdirSync(packaged).sort(),['CHANGELOG.md','LICENSE','README.md','THIRD_PARTY_NOTICES.txt','analytics.cjs','client.mjs','index.cjs','mod.json','preview.jpg'].sort());
for(const entry of ['client.mjs','index.cjs','analytics.cjs']){
 const text=fs.readFileSync(path.join(packaged,entry),'utf8');
 for(const forbidden of ['KineticPlayerDB','indexedDB','usePlaybackStore-','useAppViewStore-','KeyboardEvent','getNeteasePort','online_provider:','netease_cookie','MUSIC_U','window.electron','http://127.0.0.1:'])assert(!text.includes(forbidden),`${entry}: forbidden private dependency ${forbidden}`);
}
const manifest=JSON.parse(fs.readFileSync(path.join(packaged,'mod.json'),'utf8'));
assert.deepEqual(manifest.experimental,['platform.raw']);
assert.deepEqual(manifest.permissions.sort(),['filesystem.data','stageLayers','playback.control','platform.netease.read'].sort());
assert.equal(manifest.version,JSON.parse(fs.readFileSync('package.json','utf8')).version);
const instances=[];
function start(name){const rpc=new Map(),dispose=[],warnings=[];const api={storage:{paths:{data:path.join(root,name)}},paths:{documents:path.join(root,'documents')},rpc:{handle:(name,fn)=>rpc.set(name,fn)},log:{warn:s=>warnings.push(s),info:()=>{}},onDispose:fn=>dispose.push(fn)};activate(api);instances.push(dispose);return {rpc,warnings,call:(name,...args)=>rpc.get(name)(...args)}}
try{
  const a=start('a'),now=Date.now()-60000,song={id:'fixture',title:'Local test',artist:'Artist',album:'Album',source:'local'};
  const record={id:'packaged-integration',revision:1,closed:true,startedAt:now,endedAt:now+30000,duration:30,song,segments:[{start:now,end:now+30000,seconds:30,offset:new Date(now).getTimezoneOffset()}]};
  const query={start:now-1000,end:now+60000,period:'day'};
  assert.equal(a.call('archive.record',record).accepted,true);
  assert.equal(a.call('archive.record',record).accepted,false);
  let result=await a.call('archive.query',query);assert.equal(result.summary.plays,1);assert.equal(result.summary.seconds,30);
  const key=result.songs[0].key;
  const data='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6O0AAAAASUVORK5CYII=';
  a.call('archive.artwork.save',key,data);assert.equal(a.call('archive.artworks',[key])[key].url,data);
  a.call('archive.settings',{lowPerformance:true});assert.equal(a.call('archive.settings').lowPerformance,true);
  const trajectory=await a.call('archive.trajectory',key,'month');assert.equal(trajectory.summary.plays,1);
  const backup=a.call('archive.export'),text=fs.readFileSync(backup.path,'utf8');assert.equal(backup.records,1);
  const b=start('b');assert.equal(b.call('archive.import',text).added,1);assert.equal(b.call('archive.import',text).added,0);
  result=await b.call('archive.query',query);assert.equal(result.summary.seconds,30);assert.equal(result.summary.plays,1);
  const c=start('a');assert.equal((await c.call('archive.query',query)).summary.plays,1);assert.equal(c.call('archive.artworks',[key])[key].url,data);
  assert.equal(c.call('archive.settings').lowPerformance,true);
  assert.deepEqual([...a.warnings,...b.warnings,...c.warnings],[]);
  a.call('netease.account',{accountKey:'42',nickname:'Packaged fixture'});
  a.call('netease.rank','42','week',{code:200,weekData:[{playCount:7,song:{id:123,name:'Cloud fixture',ar:[{id:1,name:'Artist'}],al:{id:1,name:'Album'}}}]});
  a.call('netease.report','42','week',{code:200,data:{listenTime:120000,cookie:'must-not-persist',message:'MUSIC_U=must-not-persist'}});
  a.call('netease.configure',{...a.call('netease.state').config,mappings:{week:{path:'data.listenTime',unit:'milliseconds'}}});
  const d=start('a');assert.equal(d.call('netease.state').loggedIn,false);assert.equal(d.call('netease.state').reports.week.seconds,120);
  assert(!fs.readFileSync(path.join(root,'a/netease/report-week.json'),'utf8').includes('must-not-persist'));
  a.call('netease.invalidate');assert.deepEqual(a.call('netease.state').ranks,{});assert(!fs.existsSync(path.join(root,'a/netease/report-week.json')));
  assert.equal((await a.call('archive.query',query)).summary.plays,1);
  console.log('Packaged main + worker: recording, query, trajectory, artwork, settings, restart and backup round-trip passed.');
}finally{instances.forEach(list=>list.forEach(fn=>fn()));await new Promise(resolve=>setTimeout(resolve,200));fs.rmSync(root,{recursive:true,force:true})}
