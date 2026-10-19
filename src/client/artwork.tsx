import React,{createContext,useContext,useEffect,useState} from 'react';
import type {ArchiveService,Artwork} from '../core/model';
type ArtworkContextValue={images:Record<string,Artwork>;service:ArchiveService;load(keys:string[]):void;version:number;reload():void};
export const ArtworkContext=createContext<ArtworkContextValue|null>(null);
export function ArtworkProvider({service,children}:{service:ArchiveService;children:React.ReactNode}){
  const [images,setImages]=useState<Record<string,Artwork>>({}),[requested,setRequested]=useState<string[]>([]),[version,setVersion]=useState(0);
  useEffect(()=>{if(!requested.length)return;let live=true;service.artworks(requested).then(r=>{if(live)setImages(old=>({...old,...r}))}).catch(()=>{});return()=>{live=false}},[service,requested.join('\n'),version]);
  const load=(keys:string[])=>setRequested(old=>{const next=[...new Set([...old,...keys])].slice(-400);return old.join('\n')===next.join('\n')?old:next});
  return <ArtworkContext.Provider value={{images,service,load,version,reload:()=>setVersion(n=>n+1)}}>{children}<span hidden data-art-reload={version}/></ArtworkContext.Provider>;
}
export function useArtworks(keys:string[]){const ctx=useContext(ArtworkContext);useEffect(()=>{ctx?.load(keys)},[keys.join('\n')]);return ctx?.images||{}}
export function ArtImage({art,className=''}:{art?:Artwork;className?:string}){
  if(!art)return null;
  if(art.crop){const c=art.crop;return <span className={`art-crop ${className}`} aria-hidden="true"><span className="art-crop-area" style={{'--crop-ratio':c.w/c.h} as React.CSSProperties}><img src={art.url} alt="" loading="lazy" draggable="false" style={{width:`${c.imageW/c.w*100}%`,height:`${c.imageH/c.h*100}%`,left:`${-c.x/c.w*100}%`,top:`${-c.y/c.h*100}%`}}/></span></span>}
  return <img className={`art-image ${className}`} src={art.url} alt="" loading="lazy" draggable="false"/>;
}
export function ArtworkPicker({songKey,onSaved}:{songKey:string;onSaved():void}){
  const ctx=useContext(ArtworkContext),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="art-picker"><label>{busy?'正在保存封面…':'补充 / 更换本地封面'}<input type="file" accept="image/*" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file||!ctx)return;setBusy(true);setError('');try{if(file.size>15*1024*1024)throw new Error('图片不能超过15 MiB');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const ratio=Math.min(1,640/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();await ctx.service.saveArtwork(songKey,canvas.toDataURL('image/webp',.86));ctx.reload();onSaved()}catch(e){setError(String(e))}finally{setBusy(false)}}}/></label>{error&&<span role="status">{error}</span>}</div>
}
