import {useState,type Dispatch,type SetStateAction} from 'react';
// Only view preferences, not account responses or credentials. Survives native view unmounts.
const values=new Map<string,unknown>();
export function useSessionState<T>(key:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const [value,update]=useState<T>(()=>values.has(key)?values.get(key) as T:typeof initial==='function'?(initial as ()=>T)():initial);
 return [value,next=>update(old=>{const result=typeof next==='function'?(next as (old:T)=>T)(old):next;values.set(key,result);return result})];
}
