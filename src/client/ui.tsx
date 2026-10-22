import {useSessionState} from './session';
import React,{useEffect,useRef,useState} from 'react';
import type {ArchiveService} from '../core/model';
import type {Theme} from './host';
import {ArtworkProvider} from './artwork';
import {DenseArchive} from './dense';
import type {CloudService} from '../core/netease';
import {AcrylicSelect} from './select';
import {CloudArchive} from './netease';
import cloudStyles from './netease.css';
export function App(props:{service:ArchiveService;cloud:CloudService;theme:Theme;preview?:boolean}){
 const [source,setSource]=useSessionState<'folia'|'netease'>('app.source','folia');
 const [low,setLow]=useState(false);
 useEffect(()=>{let alive=true;props.service.settings().then(s=>{if(alive)setLow(s.lowPerformance)}).catch(()=>{});return()=>{alive=false}},[source,props.service]);
 const root=useRef<HTMLDivElement>(null),first=useRef(true);
 useEffect(()=>{if(first.current){first.current=false;return}root.current?.querySelector<HTMLElement>('[data-source]:not([hidden]) .source-switch button')?.focus()},[source]);
 const control=<div className="source-switch"><AcrylicSelect<'folia'|'netease'> label="切换听歌档案来源" value={source} onChange={setSource} options={[{value:'folia',label:'Folia 档案'},{value:'netease',label:'网易云档案'}]}/></div>;
 return <div ref={root} className="archive-source-root"><style>{cloudStyles}</style><div data-source="folia" hidden={source!=='folia'}><ArtworkProvider service={props.service}><DenseArchive {...props} sourceControl={control}/></ArtworkProvider></div><div data-source="netease" hidden={source!=='netease'}><CloudArchive low={low} service={props.cloud} theme={props.theme} sourceControl={control} preview={props.preview}/></div></div>;
}
