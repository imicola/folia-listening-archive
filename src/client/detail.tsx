import React,{useEffect,useRef,useState} from 'react';
import {makeRange,type ArchiveService,type Filter,type Query,type Rank,type RecordView} from '../core/model';
import {durationText,Habits} from './charts';
import {ArtImage,ArtworkPicker,useArtworks} from './artwork';
export type Detail={kind:'song'|'artist'|'album'|'records';key?:string;title:string;query:Query};
export function Icon({name,size=20}: {name:string;size?:number}) { const paths:Record<string,React.ReactNode>={
  wave:<><path d="M2 12h3l2-7 4 14 3-14 3 7h5"/></>,
  arrow:<><path d="m9 5 7 7-7 7"/></>, back:<path d="m15 5-7 7 7 7"/>, close:<path d="m6 6 12 12M6 18 18 6"/>,
  export:<><path d="M12 16V3m-4 4 4-4 4 4M4 15v5h16v-5"/></>,
  settings:<><path d="m12 3 2 3 4 .5.5 4 2.5 2-2.5 2-.5 4-4 .5-2 3-2-3-4-.5-.5-4L2 12.5l2.5-2 .5-4L9 6Z"/><circle cx="12" cy="12" r="3"/></>,
  leaf:<><path d="M20 4C8 2 2 7 5 15c6 8 16 0 15-11ZM4 20 16 8"/></>,
  chart:<><path d="M4 3v17h17M7 14l4-5 4 3 5-7"/></>,
  grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, music:<><path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/></>,
  search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>, check:<path d="m5 12 4 4L20 5"/>,
};return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.music}</svg> }

function Disc({name,small=false}: {name:string;small?:boolean}) {
  let hash=0; for(const c of name) hash=(hash*31+c.charCodeAt(0))>>>0;
  return <span className={`disc ${small?'small':''}`} style={{'--disc-angle':`${hash%360}deg`} as React.CSSProperties} aria-hidden="true"><i/><b>{name.slice(0,1)}</b></span>;
}
export function Modal({title,onClose,onBack,children,className=''}: {title:string;onClose():void;onBack?:()=>void;children:React.ReactNode;className?:string}) {
  const ref=useRef<HTMLElement>(null),returnFocus=useRef<Element|null>(null),[closing,setClosing]=useState(false);
  const close=()=>setClosing(true);
  useEffect(()=>{
    const root=ref.current?.getRootNode() as Document|ShadowRoot; returnFocus.current=root?.activeElement||document.activeElement;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}if(e.key==='Tab'){const els=[...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([hidden]), select, [tabindex="0"]')||[])].filter(el=>el.offsetParent!==null);const active=root.activeElement;if(e.shiftKey&&active===els[0]){e.preventDefault();els.at(-1)?.focus()}else if(!e.shiftKey&&active===els.at(-1)){e.preventDefault();els[0]?.focus()}}};
    root.addEventListener('keydown',key as EventListener);return()=>{root.removeEventListener('keydown',key as EventListener);(returnFocus.current as HTMLElement)?.focus?.()};
  },[]);
  useEffect(()=>{if(!closing)return;const timer=setTimeout(onClose,matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);return()=>clearTimeout(timer)},[closing,onClose]);
  return <div className={`sheet-backdrop ${closing?'closing':''}`} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section ref={ref} className={`detail-sheet ${className}`} role="dialog" aria-modal="true" aria-label={title}><header className="sheet-header"><span>听歌档案 / {title}</span>{onBack&&<button className="detail-back" onClick={onBack}>‹ 返回上一层</button>}<button className="icon-button" aria-label="关闭详情" onClick={close}><Icon name="close"/></button></header><div className="sheet-body">{children}</div></section></div>;
}

export function DetailPanel({detail,service,onClose,onBack,onSong}: {detail:Detail;service:ArchiveService;onClose():void;onBack?:()=>void;onSong(row:Rank):void}) {
  const [records,setRecords]=useState<RecordView[]>([]),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[offset,setOffset]=useState(0);
  const [trajectory,setTrajectory]=useState<Awaited<ReturnType<ArchiveService['trajectory']>>|null>(null),[contributions,setContributions]=useState<Rank[]>([]),[date,setDate]=useState('');
  const [habit,setHabit]=useState<{weekday:number;hour:number}|null>(null);
  const images=useArtworks([...(detail.kind==='song'&&detail.key?[detail.key]:[]),...contributions.slice(0,12).map(r=>r.key)]);
  const cover=images[detail.kind==='song'?detail.key!:contributions[0]?.key];
  const filter:Filter={...(detail.kind==='song'?{songKey:detail.key}:detail.kind==='artist'?{artistKey:detail.key}:detail.kind==='album'?{albumKey:detail.key}:detail.query.filter||{}),...(habit||{})};
  const q:Query=detail.kind==='song'&&!date?{start:0,end:Date.now()+1000,period:'year',filter}:date?{...makeRange('day',+new Date(date+'T12:00:00')),filter}:{...detail.query,filter};
  useEffect(()=>{let live=true;setLoading(true);setError('');service.records({...q,offset,limit:30}).then(p=>{if(live){setRecords(p.items);setTotal(p.total)}}).catch(e=>{if(live)setError(String(e.message||e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[service,JSON.stringify(q.filter),q.start,date,offset]);
  useEffect(()=>{let live=true;if(detail.kind==='song')service.trajectory(detail.key!,'month').then(t=>{if(live)setTrajectory(t)}).catch(e=>{if(live)setError(String(e.message||e))});else if(detail.kind!=='records')service.query({...detail.query,filter}).then(r=>{if(live)setContributions(r.songs)}).catch(e=>{if(live)setError(String(e.message||e))});return()=>{live=false}},[detail,service]);
  const maxRank=Math.max(5,...(trajectory?.ranks.map(r=>r.rank||0)||[]));
  return <Modal title={detail.title} onClose={onClose} onBack={onBack}><div className={`detail-cover-pane ${cover?'with-art':''}`}><ArtImage art={cover}/><span/><div className="detail-title"><div><p className="eyebrow">{detail.kind==='song'?'沿时间，重新遇见这首歌':detail.kind==='records'?'回看这一段听歌经历':'这些歌曲，组成了这份偏爱'}</p><h2>{detail.title}</h2></div></div></div>
    {detail.kind==='song'&&<ArtworkPicker songKey={detail.key!} onSaved={()=>{}}/>}
    {habit&&<button className="habit-filter-pill" onClick={()=>{setHabit(null);setOffset(0)}}>周{'一二三四五六日'[habit.weekday]} {habit.hour}时 · 清除筛选 ×</button>}
    {trajectory&&<><div className="trajectory-summary"><div><strong>{trajectory.summary.plays}</strong><span>次有效播放</span></div><div><strong>{durationText(trajectory.summary.seconds)}</strong><span>累计陪伴</span></div></div><p className="first-listen">首次被记录 <strong>{trajectory.first?new Date(trajectory.first).toLocaleDateString('zh-CN'):'尚无记录'}</strong></p><div className="rank-trajectory"><h3>每个月，偏爱的位置</h3><div>{trajectory.ranks.map((r,i)=><span key={i} title={`${r.label} · ${r.rank?'第'+r.rank+'名':'未上榜'}`}><i style={{height:r.rank?`${Math.max(12,100-(r.rank-1)/maxRank*85)}%`:'3%'}}/><b>{r.rank||'—'}</b><small>{r.label}</small></span>)}</div></div><h3>这首歌常在何时响起</h3><Habits values={trajectory.habits} onSelect={(weekday,hour)=>{setHabit({weekday,hour});setDate('');setOffset(0)}}/></>}
    {!!contributions.length&&<div className="contributions"><h3>歌曲贡献</h3>{contributions.slice(0,12).map(r=><button key={r.key} className="favorite" onClick={()=>onSong(r)}><span className="mini-cover"><ArtImage art={images[r.key]}/>{!images[r.key]&&<Disc name={r.name} small/>}</span><span className="song-name"><strong>{r.name}</strong><small>{r.subtitle}</small></span><span>{r.plays}次</span></button>)}</div>}
    <div className="records-heading"><h3>听歌轨迹 <span>{total}段</span></h3>{detail.kind==='song'&&<label>筛选日期<input type="date" aria-label="筛选轨迹日期" value={date} onChange={e=>{setDate(e.target.value);setOffset(0)}}/></label>}{date&&<button className="text-button" onClick={()=>{setDate('');setOffset(0)}}>全部日期</button>}</div>
    {error&&<p className="detail-error" role="status">{error}</p>}{loading?<p className="muted">正在沿时间寻找…</p>:<div className="record-timeline">{records.map((r,i)=>{const d=new Date(r.startedAt),same=i>0&&new Date(records[i-1].startedAt).toDateString()===d.toDateString();return <React.Fragment key={r.id}>{!same&&<h4>{d.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}</h4>}<div className="record"><time>{d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time><i/><div><strong>{r.song.title}</strong><p>{r.song.artist} <span>· {r.song.album||'未知专辑'}</span></p><small>{r.song.source||'未知来源'} · {r.completed?'近似完播':r.counted?'有效播放':'短暂停留'}{!r.closed?' · 记录中':''}</small></div><span>{durationText(r.seconds)}</span></div></React.Fragment>})}{!records.length&&<p className="empty-list">这个范围没有记录，换个日期再看看。</p>}</div>}
    {total>30&&<div className="pagination"><button disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-30))}>更新的记录</button><span>{offset+1}—{Math.min(offset+30,total)} / {total}</span><button disabled={offset+30>=total} onClick={()=>setOffset(n=>n+30)}>更早的记录</button></div>}
  </Modal>;
}
