import fs from 'node:fs';
import path from 'node:path';
import {knownReportMapping,normalizeRank,numericFields,mappedSeconds,type CloudState,type CloudScope,type Metric,type CloudConfig} from '../core/netease';
export function reportData(value:unknown):unknown{
 if(value===null||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(reportData);
 return Object.fromEntries(Object.entries(value).filter(([key])=>!/(cookie|token|authorization|password|secret|friend)/i.test(key)).map(([key,v])=>[key,reportData(v)]));
}
export class NeteaseStore{
 private file:string;
 private state:CloudState={config:{endpoint:'Folia 内置服务',uid:'',mappings:{}},loggedIn:false,nickname:'',ranks:{},reports:{}};
 constructor(dir:string){fs.mkdirSync(dir,{recursive:true});this.file=path.join(dir,'netease.json');try{const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));if(saved.version===1)this.state={...this.state,...saved.state,loggedIn:false}}catch{}}
 get(){return structuredClone(this.state)}
 private save(){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:1,state:{...this.state,loggedIn:false}}));fs.renameSync(tmp,this.file)}
 account(profile:{uid:string;nickname:string}|null){
  if(!profile){this.state.loggedIn=false;return this.get()}
  if(!/^\d{1,20}$/.test(profile.uid)||typeof profile.nickname!=='string')throw new Error('账号信息无效');
  if(profile.uid!==this.state.config.uid){this.state.ranks={};this.state.reports={}}
  this.state.config.uid=profile.uid;this.state.nickname=profile.nickname.slice(0,200);this.state.loggedIn=true;this.save();return this.get();
 }
 configure(config:CloudConfig){
  const mappings:CloudConfig['mappings']={};for(const metric of ['total','week','month'] as Metric[]){const m=config.mappings?.[metric];if(m){if(typeof m.path!=='string'||m.path.length>500||!['seconds','minutes','milliseconds'].includes(m.unit))throw new Error('时长字段映射无效');mappings[metric]=m}}
  this.state.config.mappings=mappings;for(const metric of ['total','week','month'] as Metric[]){const r=this.state.reports[metric];if(r)r.seconds=mappedSeconds(r.fields,mappings[metric])}
  this.save();return this.get();
 }
 rank(uid:string,scope:CloudScope,raw:unknown){
  if(uid!==this.state.config.uid||!['week','all'].includes(scope))throw new Error('账号或范围已更改，请重新同步');
  this.state.ranks[scope]=normalizeRank(raw,uid,scope);this.save();return this.get();
 }
 report(uid:string,metric:Metric,raw:any,error?:string){
  if(uid!==this.state.config.uid||!['total','week','month'].includes(metric))throw new Error('账号或范围已更改，请重新同步');
  if(error){const old=this.state.reports[metric];this.state.reports[metric]=old?{...old,error:error.slice(0,500)}:{uid,metric,syncedAt:0,fields:[],seconds:null,error:error.slice(0,500)}}
  else{if(raw?.code!==200||!raw.data)throw new Error('平台未提供报告，可能需要登录或会员权限');if(JSON.stringify(raw.data).length>4*1024*1024)throw new Error('报告超出可处理大小');const known=knownReportMapping(metric,raw.data);if(!this.state.config.mappings[metric]&&known)this.state.config.mappings[metric]=known;const data=reportData(raw.data),fields=numericFields(data);this.state.reports[metric]={uid,metric,syncedAt:Date.now(),fields,seconds:mappedSeconds(fields,this.state.config.mappings[metric]),...(metric!=='total'&&Number.isFinite(raw.data.startTime)&&Number.isFinite(raw.data.endTime)?{periodStart:raw.data.startTime,periodEnd:raw.data.endTime}:{})};
   // Keep report data for checking fields/units, never cookies or top-level response headers.
   fs.writeFileSync(path.join(path.dirname(this.file),`report-${metric}.json`),JSON.stringify({uid,metric,syncedAt:Date.now(),data}));
  }this.save();return this.get();
 }
}
