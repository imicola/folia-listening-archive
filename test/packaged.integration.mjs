import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),activate=require('../dist/listening-archive/index.cjs');
const root=path.resolve('.test-build/packaged-'+Date.now());fs.mkdirSync(root,{recursive:true});
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
  a.call('netease.account',{uid:'42',nickname:'Packaged fixture'});
  a.call('netease.rank','42','week',{code:200,weekData:[{playCount:7,song:{id:123,name:'Cloud fixture',ar:[{id:1,name:'Artist'}],al:{id:1,name:'Album'}}}]});
  a.call('netease.report','42','week',{code:200,data:{listenTime:120000,cookie:'must-not-persist'}});
  const cloudConfig=a.call('netease.state').config;
  a.call('netease.configure',{...cloudConfig,mappings:{week:{path:'data.listenTime',unit:'milliseconds'}}});
  const d=start('a'),cloud=d.call('netease.state');assert.equal(cloud.loggedIn,false);assert.equal(cloud.ranks.week.songs[0].plays,7);assert.equal(cloud.reports.week.seconds,120);
  assert.equal((await d.call('archive.query',query)).summary.plays,1);
  assert(!fs.readFileSync(path.join(root,'a/netease/report-week.json'),'utf8').includes('must-not-persist'));
  console.log('Packaged NetEase RPC: separate snapshots, duration units, credential stripping and restart passed.');
  console.log('Packaged main + worker: recording, query, trajectory, artwork, settings, restart and backup round-trip passed.');
}finally{instances.forEach(list=>list.forEach(fn=>fn()));await new Promise(resolve=>setTimeout(resolve,200));fs.rmSync(root,{recursive:true,force:true})}
