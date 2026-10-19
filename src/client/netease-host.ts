import {knownReportMapping,type CloudService,type CloudState,type Metric} from '../core/netease';
import type {Folium} from './host';
type Bridge={getNeteasePort():Promise<number|null>};
type HostWindow=Window&{electron?:Bridge};
// Compatibility boundary for Folia 0.7.21. Not a public Folium authentication contract.
// Session values stay in this renderer; only account DTOs and music data cross RPC.
export function createFoliaCloud(f:Pick<Folium,'rpc'>,env:{bridge():Bridge|undefined;session():string|null;fetch:typeof fetch}={bridge:()=>((window as HostWindow).electron),session:()=>localStorage.getItem('online_provider:netease:cookie')||localStorage.getItem('netease_cookie'),fetch:(...args)=>fetch(...args)}):CloudService&{dispose():void}{
 let disposed=false,busy=false;const controllers=new Set<AbortController>();
 const session=()=>{if(disposed)throw new Error('插件已停用');if(!env.bridge()?.getNeteasePort)throw new Error('当前 Folia 不支持此登录兼容接入');const cookie=env.session();if(!cookie)throw new Error('请先在 Folia 首页登录网易云，然后刷新登录状态');return cookie};
 const request=async(route:string,params:Record<string,unknown>={})=>{
  const cookie=session(),port=await env.bridge()!.getNeteasePort();
  if(!Number.isInteger(port)||!port||port<1||port>65535)throw new Error('Folia 内置网易云服务尚未就绪，请在首页检查网易云连接');
  if(disposed||env.session()!==cookie)throw new Error('Folia 登录已更改，请重新同步');
  const url=new URL(route,`http://127.0.0.1:${port}`);for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));url.searchParams.set('timestamp',String(Date.now()));
  const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),20000);
  try{const r=await env.fetch(url.toString(),{method:'POST',mode:'cors',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({...params,cookie}),signal:controller.signal});if(disposed||env.session()!==cookie)throw new Error('Folia 登录已更改，请重新同步');if(!r.ok)throw new Error('网易云请求未成功，请检查 Folia 登录状态或平台权限');const raw=await r.json();if(disposed||env.session()!==cookie)throw new Error('Folia 登录已更改，请重新同步');return raw}catch(e){if(controller.signal.aborted)throw new Error('网易云请求超时或已取消');throw e}finally{clearTimeout(timer);controllers.delete(controller)}
 };
 const connect=async()=>{
  try{const r=await request('/user/account');const uid=String(r.profile?.userId||r.account?.id||'');if(r.code!==200||!/^\d+$/.test(uid)){await f.rpc.call('netease.account',null);throw new Error('Folia 网易云登录已失效，请在首页重新登录')}return await f.rpc.call<CloudState>('netease.account',{uid,nickname:String(r.profile?.nickname||'网易云用户')})}
  catch(e){if(!disposed)await f.rpc.call('netease.account',null);throw e}
 };
 const guarded=async(fn:()=>Promise<CloudState>)=>{if(busy)throw new Error('正在同步，请稍候');busy=true;try{return await fn()}finally{busy=false}};
 return {state:()=>f.rpc.call('netease.state'),configure:config=>f.rpc.call('netease.configure',config),connect:()=>guarded(connect),
  sync:scope=>guarded(async()=>{if(!['week','all'].includes(scope))throw new Error('榜单范围无效');const s=await connect(),cookie=session();const r=await request('/user/record',{uid:s.config.uid,type:scope==='week'?1:0});if(env.session()!==cookie)throw new Error('登录已更改');return f.rpc.call('netease.rank',s.config.uid,scope,{code:r.code,[scope==='week'?'weekData':'allData']:r[scope==='week'?'weekData':'allData']})}),
  reports:()=>guarded(async()=>{let s=await connect();const cookie=session();for(const metric of ['total','week','month'] as Metric[]){let raw:any;try{raw=await request(metric==='total'?'/listen/data/total':'/listen/data/realtime/report',metric==='total'?{}:{type:metric});if(raw.code!==200||!raw.data)throw new Error('平台未提供报告，可能需要会员或重新登录');knownReportMapping(metric,raw.data)}catch(e){if(disposed||env.session()!==cookie)throw e;s=await f.rpc.call('netease.report',s.config.uid,metric,null,String(e));continue}if(disposed||env.session()!==cookie)throw new Error('登录已更改');s=await f.rpc.call('netease.report',s.config.uid,metric,{code:raw.code,data:raw.data})}return s}),
  dispose(){disposed=true;controllers.forEach(c=>c.abort());controllers.clear()}
 };
}
