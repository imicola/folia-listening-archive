export type CloudScope='week'|'all';
export type Metric='total'|'week'|'month';
export type DurationMapping={path:string;unit:'seconds'|'minutes'|'milliseconds'};
export type CloudConfig={endpoint:string;uid:string;mappings:Partial<Record<Metric,DurationMapping>>};
export type CloudSong={id:string;name:string;artists:string;album:string;cover:string|null;plays:number;artistItems?:{id:string;name:string}[];albumId?:string};
export type CloudKind='songs'|'artists'|'albums';
export type CloudGroup={key:string;name:string;subtitle:string;plays:number;songs:CloudSong[]};
export function cloudGroups(songs:CloudSong[],kind:CloudKind):CloudGroup[]{
 if(kind==='songs')return songs.map(s=>({key:s.id,name:s.name,subtitle:s.artists,plays:s.plays,songs:[s]}));
 const groups=new Map<string,CloudGroup>();
 for(const s of songs){const labels=kind==='artists'?(s.artistItems?.length?s.artistItems:s.artists.split(' / ').filter(Boolean).map(name=>({id:name,name}))):[{id:s.albumId||`${s.album}|${s.artists}`,name:s.album||'未知专辑'}];
  for(const item of new Map(labels.map(l=>[l.id,l])).values()){const key=`${kind}:${item.id}`;let g=groups.get(key);if(!g){g={key,name:item.name,subtitle:'',plays:0,songs:[]};groups.set(key,g)}g.plays+=s.plays;g.songs.push(s)}
 }
 return [...groups.values()].sort((a,b)=>b.plays-a.plays).map(g=>({...g,subtitle:`${g.songs.length} 首榜内歌曲 · 汇总贡献` }));
}
export type CloudRank={uid:string;scope:CloudScope;syncedAt:number;songs:CloudSong[]};
export type CloudReport={uid:string;metric:Metric;syncedAt:number;seconds:number|null;fields:{path:string;value:number}[];periodStart?:number;periodEnd?:number;error?:string};
// Platform month-report text labels listening durations in minutes; distribution totals equal daily sums.
export function knownReportMapping(metric:Metric,data:any):DurationMapping|undefined{
 if(metric==='total')return undefined;
 if(data?.type!==undefined&&data.type!==metric)throw new Error('平台报告周期与请求不一致，保留上次结果');
 const block=data?.listenTimeDistributionBlock;
 if(data?.type===metric&&typeof block?.blockType==='string'&&block.blockType.startsWith('LISTEN_TIME_DISTRIBUTION')&&Number.isFinite(block.playDuration)&&block.playDuration>=0)return {path:'data.listenTimeDistributionBlock.playDuration',unit:'minutes'};
 return undefined;
}
export type CloudState={config:CloudConfig;loggedIn:boolean;nickname:string;ranks:Partial<Record<CloudScope,CloudRank>>;reports:Partial<Record<Metric,CloudReport>>};
export interface CloudService{
 play?(songs:CloudSong[],selected:string,before?:()=>Promise<void>):Promise<{added:number;missing:number;preview?:boolean}>;
 state():Promise<CloudState>; configure(config:CloudConfig):Promise<CloudState>;
 connect():Promise<CloudState>;
 sync(scope:CloudScope):Promise<CloudState>;reports():Promise<CloudState>;
}
export function normalizeRank(raw:any,uid:string,scope:CloudScope):CloudRank{
 if(raw?.code!==200)throw new Error('排行榜不可用：请检查登录状态、用户 ID 和隐私权限');
 const list=raw[scope==='week'?'weekData':'allData'];
 if(!Array.isArray(list))throw new Error('排行榜返回结构变化，保留上次结果');
 const seen=new Set<string>();
 const songs:CloudSong[]=list.slice(0,1000).map((entry:any)=>{
  const s=entry.song,id=String(s?.id??'');
  if(!/^\d+$/.test(id)||!s?.name||!Number.isFinite(entry.playCount)||entry.playCount<0||seen.has(id))throw new Error('排行榜条目无效，保留上次结果');
  seen.add(id);const album=s.al||s.album;const cover=album?.picUrl;
  const artistItems=(s.ar||s.artists||[]).map((a:any)=>({id:String(a.id??a.name),name:String(a.name||'')})).filter((a:any)=>a.name);
  return {id,name:String(s.name),artists:artistItems.map((a:any)=>a.name).join(' / '),artistItems,albumId:album?.id?String(album.id):undefined,album:String(album?.name||''),cover:typeof cover==='string'&&/^https?:\/\/[^/]+\.music\.126\.net\//i.test(cover)?cover.replace(/^http:/,'https:'):null,plays:entry.playCount};
 });
 return {uid,scope,syncedAt:Date.now(),songs};
}
// Only numeric leaves of the report data are candidates. No guessed units or synthetic daily events.
export function numericFields(value:unknown,prefix='data',depth=0):{path:string;value:number}[]{
 if(depth>6)return [];
 if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return [{path:prefix,value}];
 if(!value||typeof value!=='object'||Array.isArray(value))return [];
 return Object.entries(value).slice(0,100).flatMap(([k,v])=>numericFields(v,`${prefix}.${k}`,depth+1)).slice(0,200);
}
export function mappedSeconds(fields:{path:string;value:number}[],mapping?:DurationMapping):number|null{
 if(!mapping)return null;const field=fields.find(f=>f.path===mapping.path);if(!field)return null;
 const factor={seconds:1,minutes:60,milliseconds:.001}[mapping.unit];if(!factor)return null;
 const value=field.value*factor;return Number.isFinite(value)?value:null;
}
