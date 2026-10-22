import fs from 'node:fs';
import path from 'node:path';
import {knownReportMapping,normalizeRank,numericFields,mappedSeconds,type CloudState,type CloudScope,type Metric,type CloudConfig} from '../core/netease';
export function reportData(value:unknown,depth=0):unknown{
 if(depth>6)return undefined;
 if(value===null||typeof value==='number'||typeof value==='boolean')return value;
 if(typeof value!=='object')return undefined;
 if(Array.isArray(value))return value.slice(0,100).map(v=>reportData(v,depth+1)).filter(v=>v!==undefined);
 return Object.fromEntries(Object.entries(value).filter(([key])=>!/(cookie|token|authorization|password|secret|friend|session|credential|csrf)/i.test(key)).map(([key,v])=>[key,reportData(v,depth+1)]).filter(([,v])=>v!==undefined));
}
export class NeteaseStore{
 private file:string;
 private state:CloudState={config:{endpoint:'Folium platform.raw',accountKey:'',mappings:{}},loggedIn:false,nickname:'',ranks:{},reports:{}};
 constructor(dir:string){
  fs.mkdirSync(dir,{recursive:true});this.file=path.join(dir,'netease.json');let loaded=false;
  try{const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));if(saved.version===2){this.state={...this.state,...saved.state,loggedIn:false};loaded=true}}catch{}
  // Old private caches used real user ids. Replace that cache without touching local history.
  if(!loaded)this.invalidate();
 }
 get(){return structuredClone(this.state)}
 private removeReports(){for(const metric of ['total','week','month'])fs.rmSync(path.join(path.dirname(this.file),`report-${metric}.json`),{force:true})}
 invalidate(){
  this.removeReports();this.state={config:{endpoint:'Folium platform.raw',accountKey:'',mappings:{}},loggedIn:false,nickname:'',ranks:{},reports:{}};this.save();return this.get();
 }
 private save(){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:2,state:{...this.state,loggedIn:false}}));fs.renameSync(tmp,this.file)}
 account(profile:{accountKey:string;nickname:string}|null){
  if(!profile)return this.invalidate();
  if(typeof profile.accountKey!=='string'||!profile.accountKey||profile.accountKey.length>256||typeof profile.nickname!=='string')throw new Error('账号信息无效');
  if(profile.accountKey!==this.state.config.accountKey){this.removeReports();this.state.ranks={};this.state.reports={};this.state.config.mappings={}}
  this.state.config.accountKey=profile.accountKey;this.state.nickname=profile.nickname.slice(0,200);this.state.loggedIn=true;this.save();return this.get();
 }
 configure(config:CloudConfig){
  if(config.accountKey!==this.state.config.accountKey)throw new Error('账号已更改，请重新确认报告字段');
  const mappings:CloudConfig['mappings']={};for(const metric of ['total','week','month'] as Metric[]){const m=config.mappings?.[metric];if(m){if(typeof m.path!=='string'||m.path.length>500||!['seconds','minutes','milliseconds'].includes(m.unit))throw new Error('时长字段映射无效');mappings[metric]=m}}
  this.state.config.mappings=mappings;for(const metric of ['total','week','month'] as Metric[]){const r=this.state.reports[metric];if(r)r.seconds=mappedSeconds(r.fields,mappings[metric])}
  this.save();return this.get();
 }
 rank(accountKey:string,scope:CloudScope,raw:unknown){
  if(accountKey!==this.state.config.accountKey||!['week','all'].includes(scope))throw new Error('账号或范围已更改，请重新同步');
  this.state.ranks[scope]=normalizeRank(raw,accountKey,scope);this.save();return this.get();
 }
 report(accountKey:string,metric:Metric,raw:any,error?:string){
  if(accountKey!==this.state.config.accountKey||!['total','week','month'].includes(metric))throw new Error('账号或范围已更改，请重新同步');
  if(error){const old=this.state.reports[metric];this.state.reports[metric]=old?{...old,error:error.slice(0,500)}:{accountKey,metric,syncedAt:0,fields:[],seconds:null,error:error.slice(0,500)}}
  else{if(raw?.code!==200||!raw.data)throw new Error('平台未提供报告，可能需要登录或会员权限');if(JSON.stringify(raw.data).length>4*1024*1024)throw new Error('报告超出可处理大小');const known=knownReportMapping(metric,raw.data);if(!this.state.config.mappings[metric]&&known)this.state.config.mappings[metric]=known;const data=reportData(raw.data),fields=numericFields(data);this.state.reports[metric]={accountKey,metric,syncedAt:Date.now(),fields,seconds:mappedSeconds(fields,this.state.config.mappings[metric]),...(metric!=='total'&&Number.isFinite(raw.data.startTime)&&Number.isFinite(raw.data.endTime)?{periodStart:raw.data.startTime,periodEnd:raw.data.endTime}:{})};
   // Keep report data for checking fields/units, never cookies or top-level response headers.
   fs.writeFileSync(path.join(path.dirname(this.file),`report-${metric}.json`),JSON.stringify({accountKey,metric,syncedAt:Date.now(),data}));
  }this.save();return this.get();
 }
}
