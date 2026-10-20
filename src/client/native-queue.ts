import {songKey,type Song} from '../core/model';
import type {CloudSong} from '../core/netease';
import type {Folium} from './host';

type HostSong={id:string|number;name:string;artists:{id?:string|number;name:string}[];album?:{id?:string|number;name:string;picUrl?:string;coverUrl?:string};[key:string]:any};
export type QueueResult={added:number;missing:number;preview?:boolean};
export type BeforeQueue=()=>Promise<void>;
const dto=(s:HostSong):Song=>({id:String(s.id),title:s.name,artist:s.artists.map(a=>a.name).join(' / '),album:s.album?.name||null,source:s.sourceRef?.kind||null});
export function cloudQueueSong(s:CloudSong):HostSong{return {id:Number(s.id),name:s.name,artists:s.artistItems?.map(a=>({id:a.id,name:a.name}))||s.artists.split(' / ').map(name=>({name})),album:{id:s.albumId,name:s.album,coverUrl:s.cover||undefined},providerId:'netease',sourceRef:{kind:'online',providerId:'netease',mediaId:s.id}}}

// Version-pinned compatibility adapter. No host files are patched, no React internals are inspected.
// Folium 1.6 does not expose queue replacement; load the already-running host's own queue store.
// Unknown builds fail before any queue mutation. Keep these fingerprints separate from the UI.
async function loadHost(){
 const load=(name:string)=>import(/* @vite-ignore */ new URL('assets/'+name,document.baseURI).href);
 try{const [p,v]=await Promise.all([load('usePlaybackStore-CwllCiWH.js'),load('useAppViewStore-DalASwv2.js')]);
  if(typeof p.C?.getState!=='function'||typeof p.C.getState().setPlayQueue!=='function'||typeof v.l?.getState!=='function')throw new Error();
  return {playback:p.C,view:v.l};
 }catch{throw new Error('当前 Folia 构建不支持整队播放接入；原队列未更改（适配版本：0.7.21）')}
}
async function localCatalogue():Promise<any[]>{
 return new Promise((resolve,reject)=>{const request=indexedDB.open('KineticPlayerDB');request.onupgradeneeded=()=>{request.transaction?.abort()};request.onerror=()=>reject(new Error('无法读取 Folia 本地曲库'));
  request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('local_music')){db.close();resolve([]);return}const transaction=db.transaction('local_music','readonly'),read=transaction.objectStore('local_music').getAll();read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(new Error('无法读取 Folia 本地曲库'));transaction.oncomplete=()=>db.close();transaction.onabort=()=>db.close()};
 });
}
function localCarrier(record:any,archive:Song):HostSong{
 return {id:archive.id!,name:archive.title,artists:archive.artist.split(' / ').map(name=>({id:0,name})),album:{id:0,name:archive.album||''},durationMs:record.duration,isLocal:true,localRef:{songId:record.id},sourceRef:{kind:'local',mediaId:record.id}};
}
function matchingLocal(record:any,song:Song){
 const names=record.titleOrigin==='import'?record.importedMetadata?.artistNames:record.onlineMetadata?.artists?.map((a:any)=>a.name)||record.importedMetadata?.artistNames;
 return songKey({id:null,title:record.title||'',artist:(names||[]).join(' / '),album:null,source:'local'})===songKey(song);
}
type NativeEnvironment={loadHost():Promise<any>;localCatalogue():Promise<any[]>;navigate(host:any):Promise<void>};
export function createNativeQueue(f:Folium,env:NativeEnvironment={loadHost,localCatalogue,navigate:async host=>{   // Use the native command, which owns history and the collage entrance, rather than setting view.
   if(host.view.getState().view!=='lattice'){
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'b',code:'KeyB',ctrlKey:!navigator.platform.includes('Mac'),metaKey:navigator.platform.includes('Mac'),bubbles:true,cancelable:true}));
    await new Promise(r=>setTimeout(r,80));
    if(host.view.getState().view!=='lattice')throw new Error('队列已替换并开始播放；请使用 Folia 的队列拼贴入口进入画布');
   }
}}){
 let busy=false,disposed=false;
 const start=async(resolve:(queue:HostSong[])=>Promise<{songs:HostSong[];start:number;missing:number}>,before?:BeforeQueue):Promise<QueueResult>=>{
  if(busy)throw new Error('正在准备播放队列');if(disposed)throw new Error('模组已停用');busy=true;
  try{const host=await env.loadHost(),base=host.playback.getState().playQueue;
   if(host.playback.getState().activePlaybackContext==='stage')throw new Error('请先退出外部 Stage 播放');
   const next=await resolve(base);if(next.start<0||!next.songs.length)throw new Error('所选歌曲已不在曲库中，原队列未更改');
   if(disposed||host.playback.getState().playQueue!==base)throw new Error('准备期间队列已更改，请重新播放');
   await before?.();if(disposed||host.playback.getState().playQueue!==base)throw new Error('队列已更改，请重新播放');
   const previousFm=host.playback.getState().isFmMode;
   host.playback.getState().setIsFmMode(false);host.playback.getState().setPlayQueue(next.songs);
   try{const accepted=await f.playback.playQueueItem!(next.start);if(!accepted)throw new Error('Folia 未接受播放请求');const current=host.playback.getState().currentSong,chosen=next.songs[next.start];const identity=(s:any)=>{if(!s)return '';const ref=s.sourceRef;if(ref)return ref.kind+':'+(ref.providerId||'')+':'+ref.mediaId;if(s.isLocal||s.localRef)return 'local::'+s.localRef.songId;return 'online:'+(s.providerId||'netease')+':'+s.id};if(!current||identity(current)!==identity(chosen))throw new Error('歌曲未能载入，请检查本地文件权限或平台播放权限')}
   catch(e){if(host.playback.getState().playQueue===next.songs){host.playback.getState().setPlayQueue(base);host.playback.getState().setIsFmMode(previousFm)}throw e}
   await env.navigate(host);
   return {added:next.songs.length,missing:next.missing};
  }finally{busy=false}
 };
 return {
  local:(keys:string[],selected:string,before?:BeforeQueue)=>start(async queue=>{
   const records=await f.rpc.call<Record<string,Song>>('archive.songs',keys),catalogue=await env.localCatalogue(),songs:HostSong[]=[];let start=-1;
   // The native collage consumes album.coverUrl, not the legacy picUrl field.
   // Archive records intentionally store no artwork; recover it from the separate cover cache.
   const artwork:Record<string,{url:string}>={};
   for(let offset=0;offset<keys.length;offset+=500)Object.assign(artwork,await f.rpc.call('archive.artworks',keys.slice(offset,offset+500)));
   for(const key of [...new Set(keys)]){const record=records[key];let song=queue.find(q=>songKey(dto(q))===key&&(!record?.id||String(q.id)===record.id));
    if(!song&&record?.source==='local'){const found=catalogue.filter(c=>matchingLocal(c,record));if(found.length===1)song=localCarrier(found[0],record)}
    if(!song&&record?.source==='netease'&&record.id&&/^\d+$/.test(record.id))song=cloudQueueSong({id:record.id,name:record.title,artists:record.artist,album:record.album||'',cover:null,plays:0});
    if(song){const cover=song.album?.coverUrl||song.album?.picUrl||artwork[key]?.url;if(cover)song={...song,album:{...song.album,name:song.album?.name||record?.album||'',coverUrl:cover}};if(key===selected)start=songs.length;songs.push(song)}
   }return {songs,start,missing:keys.length-songs.length};
  },before),
  cloud:(songs:CloudSong[],selected:string,before?:BeforeQueue)=>start(async()=>({songs:songs.map(cloudQueueSong),start:songs.findIndex(s=>s.id===selected),missing:0}),before),
  dispose(){disposed=true},
 };
}
