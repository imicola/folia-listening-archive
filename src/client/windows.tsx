import React from 'react';
import {type Rank} from '../core/model';
import {ArtImage,useArtworks} from './artwork';
import {durationText} from './charts';
export function CoverWall({songs}:{songs:Rank[]}){
  const images=useArtworks(songs.slice(0,12).map(r=>r.key)),art=songs.filter(r=>images[r.key]).slice(0,10);
  return <div className={`cover-wall ${art.length?'has-art':''}`} aria-hidden="true"><div>{art.map((r,i)=><span key={r.key} className={`wall-pane wall-pane-${i}`}><ArtImage art={images[r.key]}/></span>)}</div><i/></div>;
}
export function CoverWindow({row,index,onClick,onEnqueue,onPlay,onInspect,expanded=false,kind='songs'}:{row:Rank;index:number;onClick():void;onEnqueue?:()=>void;onPlay?:()=>void;onInspect?:()=>void;expanded?:boolean;kind?:string}){
  const images=useArtworks(row.songKeys.slice(0,4)),arts=row.songKeys.map(k=>images[k]).filter(Boolean);
  return <article data-row-key={row.key} className={`cover-window cover-window-${index} ${arts.length?'with-art':'missing-art'}`} aria-label={`第${index+1}名 ${row.name}`}><button className="window-primary" onClick={onClick} aria-label={`${row.name} ${row.plays}次 ${durationText(row.seconds)}，${expanded?'收起聚焦':'聚焦查看'}`}>
    <span className={`window-art ${kind!=='songs'&&arts.length>1?'collage':''}`}>{arts.length?(kind!=='songs'?arts.slice(0,4):arts.slice(0,1)).map((art,i)=><ArtImage art={art} key={i}/>):<span className="no-cover"><i/><b>{row.name.slice(0,1)}</b><small>封面尚未收录</small></span>}</span>
    <span className="window-shade"/><span className="window-rank">{String(index+1).padStart(2,'0')} <i/> {row.plays}次播放</span>
    <span className="window-copy"><strong>{row.name}</strong><span>{row.subtitle||`${row.songKeys.length}首歌曲`}</span><span className="window-facts"><b>{durationText(row.seconds)}</b><i/>本期 {Math.round(row.share*100)}%<em>沿时间回看 ↗</em></span></span>
    <span className="window-inner-border"/>
  </button><span className="window-actions">{onPlay&&<button onClick={onPlay} aria-label={`立即播放 ${row.name}`} title="立即播放">▷</button>}{onEnqueue&&<button onClick={onEnqueue} aria-label={`加入队列 ${row.name}`} title="加入队列">＋</button>}<button onClick={onInspect||onClick} aria-label={`查看轨迹 ${row.name}`} title="回看轨迹">↗</button></span></article>;
}
export function HeroArtwork({song}:{song?:Rank}){const images=useArtworks(song?[song.key]:[]);return song?<div className="hero-artwork"><ArtImage art={images[song.key]}/><i/><div><small>本期最常响起</small><strong>{song.name}</strong><span>{song.subtitle}</span></div></div>:null}
