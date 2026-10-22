import {catalogue} from './demo';
import type {CloudService,CloudState,Metric} from '../core/netease';
import type {ArchiveService,Artwork} from '../core/model';
import {makeRange} from '../core/model';
export function previewCloud(local:ArchiveService,empty=false):CloudService{
 let state:CloudState={config:{endpoint:'预览 · 不连接 Folia',accountKey:'',mappings:{}},loggedIn:false,nickname:'',ranks:{},reports:{}};
 let ready:Promise<void>|null=null;
 const init=()=>ready??=(async()=>{if(empty)return;const result=await local.query(makeRange('month',Date.now())),art=await local.artworks(result.songs.map(s=>s.key));state.config.accountKey='100000';state.nickname='示例听众';const songs=Array.from({length:100},(_,i)=>{const s=result.songs[i%result.songs.length];return ({id:String(100000+i),name:s.name+(i>=result.songs.length?' · 示例 '+(i+1):''),artists:s.subtitle,album:catalogue.find(track=>track.title===s.name)?.album||'演示曲目',cover:null,plays:s.plays,previewArt:art[s.key] as Artwork|undefined})});for(const scope of ['week','all'] as const)state.ranks[scope]={accountKey:'100000',scope,syncedAt:Date.now(),songs:scope==='week'?songs:songs.map(s=>({...s,plays:s.plays*3}))};for(const [metric,seconds] of [['total',1250640],['week',48600],['month',187200]] as [Metric,number][]){state.config.mappings[metric]={path:'data.exampleSeconds',unit:'seconds'};state.reports[metric]={accountKey:'100000',metric,syncedAt:Date.now(),seconds,fields:[{path:'data.exampleSeconds',value:seconds}]}}})();
 const get=async()=>{await init();return structuredClone(state)};
 let cancel:()=>void=()=>{};
 const delay=()=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{cancel=()=>{};resolve()},1400);cancel=()=>{clearTimeout(timer);cancel=()=>{};reject(new Error('示例：已取消同步，保留快照'))}});
 return {play:async(songs,_selected)=>({added:songs.length,missing:0,preview:true}),state:get,configure:async c=>{await init();state.config=c;return get()},cancel:()=>cancel(),clear:async()=>{await init();state={config:{endpoint:'预览 · 不连接 Folia',accountKey:'',mappings:{}},loggedIn:false,nickname:'',ranks:{},reports:{}};return get()},connect:async()=>{await init();await delay();if(empty)throw new Error('空状态预览：请在真实 Folia 中登录网易云');state.loggedIn=true;return get()},sync:async()=>{await init();await delay();if(empty)throw new Error('空状态预览：没有真实账号连接');return get()},reports:async()=>{await init();await delay();if(empty)throw new Error('空状态预览：没有真实报告');return get()}};
}
