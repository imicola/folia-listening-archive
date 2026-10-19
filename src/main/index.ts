import fs from 'node:fs';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import { ArchiveStore,validateListen } from './store';
import { aggregate, recordPage, trajectory } from '../core/aggregate';
import type { Query, Period } from '../core/model';
import {NeteaseStore} from './netease';
interface MainApi {
  storage: { paths: { data: string } }; paths: { documents: string };
  rpc: { handle(name: string, handler: (...args: any[]) => unknown): void };
  log: { warn(message: string): void; info(message: string): void };
  onDispose(fn:()=>void):void;
}
function validQuery(q: Query, bounded = true): Query {
  if (!q || !Number.isFinite(q.start) || !Number.isFinite(q.end) || q.start < 0 || q.end <= q.start || (bounded && q.end - q.start > 367 * 86400_000) || !['day','week','month','year'].includes(q.period)) throw new Error('查询时间范围无效');
  if (q.filter?.weekday !== undefined && (!Number.isInteger(q.filter.weekday) || q.filter.weekday < 0 || q.filter.weekday > 6)) throw new Error('星期筛选无效');
  if (q.filter?.hour !== undefined && (!Number.isInteger(q.filter.hour) || q.filter.hour < 0 || q.filter.hour > 23)) throw new Error('小时筛选无效');
  return q;
}
export default function activate(api: MainApi) {
  const store = new ArchiveStore(api.storage.paths.data);
  const cloud=new NeteaseStore(path.join(api.storage.paths.data,'netease'));
  api.rpc.handle('netease.state',()=>cloud.get());
  api.rpc.handle('netease.configure',config=>cloud.configure(config));
  api.rpc.handle('netease.account',profile=>cloud.account(profile));
  api.rpc.handle('netease.rank',(uid,scope,raw)=>cloud.rank(uid,scope,raw));
  api.rpc.handle('netease.report',(uid,metric,raw,error)=>cloud.report(uid,metric,raw,error));
  const worker=new Worker(path.join(__dirname,'analytics.cjs'));
  worker.postMessage({type:'init',records:store.all()});
  let serial=0,workerError:Error|null=null,disposed=false;
  const pending=new Map<number,{resolve(value:unknown):void;reject(error:Error):void}>();
  const fail=(e:Error)=>{workerError=e;for(const call of pending.values())call.reject(e);pending.clear();if(!disposed)api.log.warn(`统计查询不可用：${e.message}`)};
  worker.on('error',fail);worker.on('exit',code=>{if(code!==0)fail(new Error('统计线程已停止'))});
  worker.on('message',m=>{const call=pending.get(m.id);if(!call)return;pending.delete(m.id);m.error?call.reject(new Error(m.error)):call.resolve(m.result)});
  const ask=(type:string,...args:unknown[])=>new Promise((resolve,reject)=>{if(workerError){reject(workerError);return}const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,type,args})});
  api.onDispose(()=>{disposed=true;fail(new Error('模组已停用'));void worker.terminate()});
  for (const warning of store.warnings) api.log.warn(warning);
  const artDir=path.join(api.storage.paths.data,'artwork');fs.mkdirSync(artDir,{recursive:true});
  const artPath=(key:string)=>path.join(artDir,createHash('sha256').update(key).digest('hex')+'.json');
  api.rpc.handle('archive.artworks',(keys:string[])=>{if(!Array.isArray(keys)||keys.length>500)throw new Error('封面查询数量无效');const result:Record<string,{url:string}>={};for(const key of keys){if(typeof key!=='string'||key.length>10000)continue;try{const data=JSON.parse(fs.readFileSync(artPath(key),'utf8'));if(typeof data.url==='string')result[key]=data}catch{}}return result});
  api.rpc.handle('archive.artwork.save',(key:string,data:string)=>{if(typeof key!=='string'||key.length>10000||typeof data!=='string'||data.length>1024*1024||!/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data))throw new Error('封面格式无效');fs.writeFileSync(artPath(key),JSON.stringify({url:data}));return null});
  api.rpc.handle('archive.record', item => { const r = store.put(item); if (r.accepted) worker.postMessage({type:'upsert',record:validateListen(item)}); return r; });
  api.rpc.handle('archive.query', (q: Query) => {
    validQuery(q);return ask('query',q);
  });
  api.rpc.handle('archive.records', (q: Query) => ask('records',validQuery(q, false)));
  api.rpc.handle('archive.trajectory', (key: string, period: Period) => {
    if (typeof key !== 'string' || key.length > 10000 || !['day','week','month','year'].includes(period)) throw new Error('轨迹查询无效');
    return ask('trajectory',key,period);
  });
  api.rpc.handle('archive.settings', patch => store.settings(patch));
  api.rpc.handle('archive.export', () => {
    const dir = path.join(api.paths.documents, 'Folia 听歌档案备份'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `听歌档案-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
    fs.writeFileSync(file, JSON.stringify(store.backup(), null, 2), { flag: 'wx' }); return { path: file, records: store.all().length };
  });
  api.rpc.handle('archive.import', text => { const r = store.import(text); if(r.added)worker.postMessage({type:'import',records:store.all()}); return r; });
  api.log.info('听歌档案已就绪，记录仅保存在本机。');
}
