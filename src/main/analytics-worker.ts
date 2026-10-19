import {parentPort} from 'node:worker_threads';
import {aggregate,recordPage,trajectory} from '../core/aggregate';
import type {Listen} from '../core/model';
const records=new Map<string,Listen>(),cache=new Map<string,unknown>();let revision=0;
parentPort!.on('message',message=>{
  if(message.type==='init'){for(const s of message.records)records.set(s.id,s);return}
  if(message.type==='upsert'){records.set(message.record.id,message.record);revision++;cache.clear();return}
  if(message.type==='import'){for(const s of message.records)records.set(s.id,s);revision++;cache.clear();return}
  try{
    const key=JSON.stringify([message.type,message.args]);let result=cache.get(key);
    if(!result){const all=[...records.values()];result=message.type==='query'?aggregate(all,message.args[0],revision):message.type==='records'?recordPage(all,message.args[0]):trajectory(all,message.args[0],message.args[1]);if(cache.size>=12)cache.delete(cache.keys().next().value!);cache.set(key,result)}
    parentPort!.postMessage({id:message.id,result});
  }catch(e){parentPort!.postMessage({id:message.id,error:String(e)})}
});
