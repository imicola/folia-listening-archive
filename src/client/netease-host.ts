import {knownReportMapping,type CloudService,type CloudState,type Metric} from '../core/netease';
import type {Folium} from './host';

export type AccountState={providerId:string;status:'signed-in'|'signed-out'|'unknown';accountKey:string|null;user:{nickname:string}|null};
export type PlatformService={describe(provider:string):{supported:boolean};request(provider:string,endpoint:string,params:Record<string,string|number>,options:{signal:AbortSignal}):Promise<{body:unknown;accountKey:string|null}>};
type CloudHost=Pick<Folium,'rpc'|'events'|'host'>&{account?:{getState(provider:string):AccountState|null};experimental?:Readonly<Record<string,unknown>>};
type Operation={accountKey:string;generation:number;controller:AbortController;reason?:'cancel'|'account'|'dispose'};
class ConnectionError extends Error {}
const changed=()=>new ConnectionError('Folia 登录已更改，旧请求已取消，请重新同步');
const empty=():CloudState=>({config:{endpoint:'Folium platform.raw',accountKey:'',mappings:{}},loggedIn:false,nickname:'',ranks:{},reports:{}});
const errors:Record<string,string>={
 'not-signed-in':'请先在 Folia 首页登录网易云',
 'session-expired':'网易云登录已失效，请在 Folia 首页重新登录',
 'unsupported':'当前宿主不支持网易云读取接口；旧稳定版请继续使用听歌档案 v1.2.4',
 'endpoint-denied':'宿主未开放此读取接口，请检查 Folia 版本',
 'vip-required':'网易云要求会员才能读取此报告',
 'rate-limited':'网易云请求过于频繁，请稍后重试',
 'network':'无法连接网易云，请稍后重试',
 'account-changed':'Folia 登录已更改，旧请求已丢弃，请重新同步',
 'aborted':'请求已取消',
};

// Only these three read endpoints are reachable. The host supplies the session and user id.
export function createFoliaCloud(f:CloudHost,options:{timeoutMs?:number}={}):CloudService&{dispose():void}{
 let disposed=false,generation=0,knownKey:string|null|undefined,active:Operation|null=null;
 let queue:Promise<unknown>=Promise.resolve();
 const listeners=new Set<(state:CloudState)=>void>();
 const emit=(state:CloudState)=>{if(!disposed)for(const listener of listeners)listener(state);return state};
 // Serialize writes with invalidation: an old in-flight RPC can never land after the clear.
 const serial=<T>(fn:()=>Promise<T>):Promise<T>=>{const result=queue.then(fn);queue=result.catch(()=>{});return result};
 const available=()=>f.host.folium.major===1&&f.host.folium.minor>=7&&typeof f.account?.getState==='function';
 const account=()=>{try{return available()?f.account!.getState('netease'):null}catch{return null}};
 const key=(state:AccountState|null)=>state?.status==='signed-in'&&typeof state.accountKey==='string'&&state.accountKey.length>0&&state.accountKey.length<=256?state.accountKey:null;
 const observe=()=>{
  const state=account(),current=key(state);
  if(knownKey!==undefined&&current!==knownKey){
   generation++;if(active){active.reason='account';active.controller.abort()}
   emit(empty());void serial(()=>f.rpc.call<CloudState>('netease.invalidate')).catch(()=>{});
  }
  knownKey=current;return state;
 };
 const check=(op:Operation)=>{
  observe();
  if(disposed||op.reason==='dispose')throw new ConnectionError('模组已停用');
  if(op.generation!==generation||op.reason==='account'||knownKey!==op.accountKey)throw changed();
  if(op.controller.signal.aborted)throw new ConnectionError('已取消同步，保留已保存的数据');
 };
 knownKey=key(account());
 const off=available()?f.events.on('account.changed',event=>{if(event?.providerId==='netease')observe()}):()=>{};
 const rpc=async(op:Operation,name:string,...args:unknown[])=>{
  const state=await serial(async()=>{check(op);return f.rpc.call<CloudState>(name,...args)});check(op);return emit(state);
 };
 const state=async()=>{
  if(disposed)throw new ConnectionError('模组已停用');
  observe();
  return serial(async()=>{
   const current=key(observe()),saved=await f.rpc.call<CloudState>('netease.state');
   // Do not display another account's snapshot on first access after restart.
   if(!current||saved.config.accountKey!==current){await f.rpc.call('netease.invalidate');return empty()}
   if(key(observe())!==current){await f.rpc.call('netease.invalidate');return empty()}
   return saved;
  });
 };
 const guarded=async(fn:(op:Operation)=>Promise<CloudState>)=>{
  if(disposed)throw new ConnectionError('模组已停用');
  if(active)throw new ConnectionError('正在同步，请稍候或先取消');
  const profile=observe(),accountKey=key(profile);
  if(!available())throw new ConnectionError('网易云档案需要 Folium 1.7（Limo 或更新版本）；旧稳定版请继续使用听歌档案 v1.2.4');
  if(!accountKey)throw new ConnectionError(profile?.status==='unknown'?'宿主尚未确认网易云登录状态，请稍后重试':errors['not-signed-in']);
  const op:Operation={accountKey,generation,controller:new AbortController()};active=op;
  try{await queue;check(op);return await fn(op)}finally{if(active===op)active=null}
 };
 const connect=async(op:Operation)=>{check(op);return rpc(op,'netease.account',{accountKey:op.accountKey,nickname:account()?.user?.nickname||'网易云用户'})};
 const request=async(op:Operation,endpoint:'user_record'|'listen_data_total'|'listen_data_realtime_report',params:Record<string,string|number>={})=>{
  check(op);
  const platform=f.experimental?.['platform.raw'] as PlatformService|undefined;
  try{if(typeof platform?.request!=='function'||typeof platform.describe!=='function'||!platform.describe('netease').supported)throw new ConnectionError(errors.unsupported)}catch{throw new ConnectionError(errors.unsupported)}
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let abort=()=>{};
  const deadline=new Promise<never>((_,reject)=>{
   abort=()=>{controller.abort();reject(new ConnectionError('已取消同步，保留已保存的数据'))};
   op.controller.signal.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>{controller.abort();reject(new ConnectionError('网易云请求超时，请稍后重试'))},options.timeoutMs??20000);
  });
  try{
   const response=await Promise.race([deadline,platform!.request('netease',endpoint,params,{signal:controller.signal})]);check(op);
   if(response.accountKey!==op.accountKey)throw changed();
   const raw=response.body as any;
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ConnectionError('网易云响应格式变化，保留上次结果');
   if(new TextEncoder().encode(JSON.stringify(raw)).byteLength>4*1024*1024)throw new ConnectionError('网易云响应过大，已停止处理');
   if(raw.code!==200)throw new ConnectionError(raw.code===429?errors['rate-limited']:raw.code===301||raw.code===401?errors['session-expired']:raw.code===403?errors['vip-required']:'网易云未提供此数据，保留上次结果');
   return raw;
  }catch(error){
   check(op);if(error instanceof ConnectionError)throw error;
   const code=(error as {code?:unknown})?.code;
   throw new ConnectionError(typeof code==='string'?(code.startsWith('permission-denied:')?'请在模组面板授权网易云只读权限':errors[code]||'网易云读取失败，请检查宿主兼容性'):'网易云读取失败，请检查宿主兼容性');
  }finally{clearTimeout(timer);op.controller.signal.removeEventListener('abort',abort)}
 };
 return {
  state,
  subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},
  configure:config=>guarded(async op=>{if(config.accountKey!==op.accountKey)throw changed();await connect(op);return rpc(op,'netease.configure',config)}),
  connect:()=>guarded(connect),
  sync:scope=>guarded(async op=>{
   if(!['week','all'].includes(scope))throw new ConnectionError('榜单范围无效');
   await connect(op);const raw=await request(op,'user_record',{type:scope==='week'?1:0});
   return rpc(op,'netease.rank',op.accountKey,scope,{code:raw.code,[scope==='week'?'weekData':'allData']:raw[scope==='week'?'weekData':'allData']});
  }),
  reports:()=>guarded(async op=>{
   let result=await connect(op);
   for(const metric of ['total','week','month'] as Metric[]){
    let raw:any;
    try{raw=await request(op,metric==='total'?'listen_data_total':'listen_data_realtime_report',metric==='total'?{}:{type:metric});if(!raw.data)throw new ConnectionError('平台报告结构变化，保留上次结果');knownReportMapping(metric,raw.data)}
    catch(error){check(op);result=await rpc(op,'netease.report',op.accountKey,metric,null,error instanceof ConnectionError?error.message:'平台报告结构变化，保留上次结果');continue}
    result=await rpc(op,'netease.report',op.accountKey,metric,{code:raw.code,data:raw.data});
   }
   return result;
  }),
  cancel(){if(active){active.reason='cancel';active.controller.abort()}},
  clear:async()=>{if(disposed)throw new ConnectionError('模组已停用');generation++;if(active){active.reason='cancel';active.controller.abort()}emit(empty());return serial(async()=>emit(await f.rpc.call<CloudState>('netease.invalidate')))},
  dispose(){disposed=true;off();if(active){active.reason='dispose';active.controller.abort()}listeners.clear()},
 };
}
