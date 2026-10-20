import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCell} from '../src/core/canvas';
import {createNativeQueue} from '../src/client/native-queue';
import type {Folium} from '../src/client/host';
import type {CloudSong} from '../src/core/netease';
import {songKey} from '../src/core/model';
const songs:CloudSong[]=Array.from({length:100},(_,i)=>({id:String(i+1),name:`合成歌曲 ${i+1}`,artists:'合成歌手',album:'合成专辑',plays:100-i,cover:null}));
function harness(){const original=[{id:1001,name:'原队列',artists:[]}];let queue:any[]=original,fm=true;const played:number[]=[];let currentSong:any=null;let accepted=true,navigated=false,land=true;const host={playback:{getState:()=>({playQueue:queue,currentSong,isFmMode:fm,activePlaybackContext:'main',setPlayQueue:(q:any[])=>queue=q,setIsFmMode:(v:boolean)=>fm=v})},view:{}};
 const f={playback:{playQueueItem:async(i:number)=>{played.push(i);if(accepted&&land)currentSong=queue[i];return accepted}}} as unknown as Folium;
 const env={loadHost:async()=>host,localCatalogue:async()=>[],navigate:async()=>{navigated=true}};
 return {original,host,env,f,get queue(){return queue},get fm(){return fm},played,get navigated(){return navigated},reject:()=>accepted=false,noLanding:()=>land=false};
}
test('二维重复画布每格有归属，负坐标合法且可到达完整 100 首',()=>{const reached=new Set<number>();for(let row=-30;row<30;row++)for(let col=-10;col<10;col++){const c=rankCell(row,col,100);assert(c.index>=0&&c.index<100);assert(c.column<=col&&c.column+c.span>col);reached.add(c.index)}assert.equal(reached.size,100)});
test('整队替换保留 100 首榜单顺序，从选中的第 73 首开始，先收条再修改队列',async()=>{const h=harness(),queue=createNativeQueue(h.f,h.env);let collapsed=false;const result=await queue.cloud(songs,'73',async()=>{assert.equal(h.queue,h.original);collapsed=true});assert(collapsed);assert.equal(result.added,100);assert.equal(h.queue.length,100);assert.deepEqual(h.queue.map(s=>s.id),songs.map(s=>Number(s.id)));assert.deepEqual(h.played,[72]);assert.equal(h.fm,false);assert(h.navigated)});
test('没有选中项时保持原队列和 FM，不触发收条或导航',async()=>{const h=harness();let collapsed=false;await assert.rejects(()=>createNativeQueue(h.f,h.env).cloud(songs,'missing',async()=>{collapsed=true}),/原队列未更改/);assert.equal(h.queue,h.original);assert(h.fm);assert(!collapsed);assert(!h.navigated)});
test('准备期间被用户改动的队列不得被旧播放操作覆盖',async()=>{const h=harness(),other=[{id:999}];await assert.rejects(()=>createNativeQueue(h.f,h.env).cloud(songs,'1',async()=>{h.host.playback.getState().setPlayQueue(other)}),/队列已更改/);assert.equal(h.queue,other);assert.equal(h.played.length,0)});
test('宿主拒绝播放时恢复原队列和 FM',async()=>{const h=harness();h.reject();await assert.rejects(()=>createNativeQueue(h.f,h.env).cloud(songs,'2'),/未接受/);assert.equal(h.queue,h.original);assert(h.fm);assert(!h.navigated)});
test('收条期间卸载模组会取消交接，不修改队列',async()=>{const h=harness(),service=createNativeQueue(h.f,h.env);await assert.rejects(()=>service.cloud(songs,'2',async()=>service.dispose()),/队列已更改/);assert.equal(h.queue,h.original);assert.equal(h.played.length,0)});
test('未知构建在改变任何队列前失败',async()=>{const h=harness();await assert.rejects(()=>createNativeQueue(h.f,{...h.env,loadHost:async()=>{throw new Error('unsupported build')}}).cloud(songs,'2'),/unsupported/);assert.equal(h.queue,h.original)});

test('宿主受理却未载入歌曲时回滚，不能当作播放成功',async()=>{const h=harness();h.noLanding();await assert.rejects(()=>createNativeQueue(h.f,h.env).cloud(songs,'1'),/未能载入/);assert.equal(h.queue,h.original);assert(!h.navigated)});

test('网易云榜单将封面交给原生拼贴使用的 coverUrl 字段',async()=>{const h=harness();await createNativeQueue(h.f,h.env).cloud([{...songs[0],cover:'https://example.com/cover.jpg'}],'1');assert.equal(h.queue[0].album.coverUrl,'https://example.com/cover.jpg')});

test('档案还原缺少封面的歌曲时附带缓存封面，且不修改原队列对象',async()=>{const h=harness(),song={id:'1001',title:'原队列',artist:'',album:null,source:'netease'},key=songKey(song),cover='data:image/webp;base64,YQ==';(h.f as any).rpc={call:async(name:string)=>name==='archive.songs'?{[key]:song}:{[key]:{url:cover}}};await createNativeQueue(h.f,h.env).local([key],key);assert.equal(h.queue[0].album.coverUrl,cover);assert.equal((h.original[0] as any).album,undefined)});
