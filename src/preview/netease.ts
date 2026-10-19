import type {CloudService,CloudState,Metric} from '../core/netease';
import type {ArchiveService,Artwork} from '../core/model';
import {makeRange} from '../core/model';
export function previewCloud(local:ArchiveService,empty=false):CloudService{
 let state:CloudState={config:{endpoint:'预览 · 不连接 Folia',uid:'',mappings:{}},loggedIn:false,nickname:'',ranks:{},reports:{}};
 let ready:Promise<void>|null=null;
 const init=()=>ready??=(async()=>{if(empty)return;const result=await local.query(makeRange('month',Date.now())),art=await local.artworks(result.songs.map(s=>s.key));state.config.uid='100000';state.nickname='示例听众';const songs=result.songs.map((s,i)=>({id:String(100000+i),name:s.name,artists:s.subtitle,album:'示例曲目 · 抽象占位图',cover:null,plays:s.plays,previewArt:art[s.key] as Artwork|undefined}));for(const scope of ['week','all'] as const)state.ranks[scope]={uid:'100000',scope,syncedAt:Date.now(),songs:scope==='week'?songs:songs.map(s=>({...s,plays:s.plays*3}))};for(const [metric,seconds] of [['total',1250640],['week',48600],['month',187200]] as [Metric,number][]){state.config.mappings[metric]={path:'data.exampleSeconds',unit:'seconds'};state.reports[metric]={uid:'100000',metric,syncedAt:Date.now(),seconds,fields:[{path:'data.exampleSeconds',value:seconds}]}}})();
 const get=async()=>{await init();return structuredClone(state)};
 return {state:get,configure:async c=>{await init();state.config=c;return get()},connect:async()=>{await init();if(empty)throw new Error('空状态预览：请在真实 Folia 中登录网易云');state.loggedIn=true;return get()},sync:async()=>{await init();if(empty)throw new Error('空状态预览：没有真实账号连接');return get()},reports:async()=>{await init();if(empty)throw new Error('空状态预览：没有真实报告');return get()}};
}
