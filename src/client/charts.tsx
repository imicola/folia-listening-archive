import React, { useEffect, useRef, useState } from 'react';
import type { Bucket, Result, Range } from '../core/model';
export const durationText = (seconds: number) => seconds >= 3600 ? `${Math.floor(seconds / 3600)}小时${Math.floor(seconds % 3600 / 60)}分` : seconds >= 60 ? `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒` : `${Math.floor(seconds)}秒`;
export const shortTime = (seconds: number) => seconds >= 3600 ? `${+(seconds / 3600).toFixed(1)}h` : `${Math.round(seconds / 60)}m`;
export function River({ result, range, low, onSelect }: { result: Result; range: Range; low: boolean; onSelect(b: Bucket): void }) {
  const canvas = useRef<HTMLCanvasElement>(null), [hover, setHover] = useState(-1);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const context = el.getContext('2d'); if (!context) return;
    let frame = 0, visible = !document.hidden, inView = true, phase = 0, previous = 0;
    const draw = (time = 0) => {
      const rect = el.getBoundingClientRect(), w = rect.width, h = rect.height, dpr = Math.min(devicePixelRatio || 1, low ? 1 : 2);
      if (el.width !== Math.round(w*dpr) || el.height !== Math.round(h*dpr)) { el.width = Math.round(w*dpr); el.height = Math.round(h*dpr); }
      context.setTransform(dpr,0,0,dpr,0,0); context.clearRect(0,0,w,h);
      const styles = getComputedStyle(el), accent = styles.getPropertyValue('--accent').trim() || '#9b8be7';
      const max = Math.max(1, ...result.buckets.map(b => b.seconds)), bs = result.buckets;
      phase = low ? 0 : time * .00012;
      // Each column is a time bucket; real gaps stay empty. Layers reveal the same data at different depths.
      for (let layer = 0; layer < (low ? 9 : 24); layer++) {
        const depth = layer / (low ? 9 : 24), center = h*.54, amplitude = h*.29;
        context.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const index = Math.min(bs.length-1, Math.floor(x / w * bs.length)), bucket = bs[index];
          const f = (x / w * bs.length) % 1, position=x/w*bs.length-.5, left=Math.max(0,Math.floor(position)), right=Math.min(bs.length-1,left+1), mix=Math.max(0,position-left);
          const strength = Math.sqrt(((bs[left]?.seconds||0)*(1-mix)+(bs[right]?.seconds||0)*mix)/max);
          const taper = (!bs[index-1]?.seconds&&f<.2?Math.sin(f/.2*Math.PI/2):!bs[index+1]?.seconds&&f>.8?Math.sin((1-f)/.2*Math.PI/2):1), wave = Math.sin(x*.008 + phase + depth*3)*8 + Math.cos(x*.017 - phase*1.5)*4;
          const y = center + (depth-.5)*amplitude*2*strength*taper + wave*strength;
          if (!bucket?.seconds) context.moveTo(x,y); else context.lineTo(x,y);
        }
        context.strokeStyle = accent; context.globalAlpha = .13 + .55*Math.sin(depth*Math.PI); context.lineWidth = layer % 4 === 0 ? 2.2 : .8;
        if (!low && layer % 5 === 0) { context.shadowColor = accent; context.shadowBlur = 12; } else context.shadowBlur = 0;
        context.stroke();
      }
      context.shadowBlur = 0; context.globalAlpha = 1;
      if (!low && visible && inView) frame = requestAnimationFrame(t => { if (t-previous > 25) { previous=t; draw(t); } else frame=requestAnimationFrame(draw); });
    };
    const resize = new ResizeObserver(() => { cancelAnimationFrame(frame); draw(); }); resize.observe(el);
    const observer = new IntersectionObserver(([entry]) => { inView=entry.isIntersecting; cancelAnimationFrame(frame); if (visible && inView) draw(); }); observer.observe(el);
    const visibility = () => { visible=!document.hidden; cancelAnimationFrame(frame); if(visible && inView) draw(); }; document.addEventListener('visibilitychange', visibility);
    draw(); return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); document.removeEventListener('visibilitychange',visibility); };
  }, [result, low]);
  return <div className="river-chart">
    <div className="chart-caption"><span>时间流过，音乐留下</span><span>{range.period === 'day' ? '按小时汇流' : range.period === 'year' ? '按月汇流' : '按日汇流'}</span></div>
    <canvas ref={canvas} aria-hidden="true" />
    <div className="river-hit-grid" style={{ gridTemplateColumns: `repeat(${result.buckets.length},1fr)` }} onMouseLeave={() => setHover(-1)}>
      {result.buckets.map((b,i) => <button key={b.key} className={hover===i?'hovered':''} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(-1)} onClick={() => onSelect(b)} aria-label={`${b.label}，${durationText(b.seconds)}，查看记录`}>
        <span className="river-time">{result.buckets.length <= 12 || i%Math.ceil(result.buckets.length/8)===0 ? b.label : ''}</span>
      </button>)}
    </div>
    {hover >= 0 && result.buckets[hover] && <div className="chart-tip">{result.buckets[hover].label}<strong>{durationText(result.buckets[hover].seconds)}</strong><span>点击回看</span></div>}
  </div>;
}
export function LineChart({ result, onSelect }: { result: Result; onSelect(b: Bucket): void }) {
  const [hover,setHover]=useState(-1), bs=result.buckets, max=Math.max(60,...bs.map(b=>b.seconds)), W=1000,H=270;
  const point=(b:Bucket,i:number)=>[52+i*(W-76)/Math.max(1,bs.length-1),H-38-(b.seconds/max)*(H-70)];
  const points=bs.map(point), path=points.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ');
  return <div className="line-chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="听歌时长折线图，数据点可通过下方按钮查看">
    <defs><linearGradient id="archive-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".3"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(f=><g key={f}><line x1="52" x2="980" y1={H-38-f*(H-70)} y2={H-38-f*(H-70)} stroke="currentColor" opacity=".09"/><text x="0" y={H-34-f*(H-70)} fill="currentColor" opacity=".65" fontSize="11">{shortTime(max*f)}</text></g>)}
    <path className="line-area" d={`${path} L${points.at(-1)?.[0]},${H-38} L52,${H-38}Z`} fill="url(#archive-fill)"/>
    <path className="line-stroke" d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round"/>
    {points.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r={hover===i?5:2.5} fill="var(--accent)"/><rect x={x-14} y="8" width="28" height={H-40} fill="transparent" onMouseEnter={()=>setHover(i)} onClick={()=>onSelect(bs[i])}/>{(bs.length<=12 || i%Math.ceil(bs.length/8)===0)&&<text x={x} y={H-9} textAnchor="middle" fill="currentColor" fontSize="11" opacity=".65">{bs[i].label}</text>}</g>)}
  </svg><div className="sr-only">{bs.map(b=><button key={b.key} onClick={()=>onSelect(b)}>{b.label}，{durationText(b.seconds)}</button>)}</div>
  {hover>=0&&<div className="chart-tip" onMouseLeave={()=>setHover(-1)}>{bs[hover].label}<strong>{durationText(bs[hover].seconds)}</strong><button onClick={()=>onSelect(bs[hover])}>查看记录 →</button></div>}</div>;
}
export function HeatChart({ result, range, onSelect }: { result: Result; range: Range; onSelect(b:Bucket):void }) {
  const bs=result.heat,max=Math.max(1,...bs.map(b=>b.seconds));
  const annual=range.period==='year', weekly=range.period==='week';
  const offset=annual||range.period==='month'?(new Date(range.start).getDay()+6)%7:0;
  return <div className={`heat-chart ${annual?'annual':weekly?'weekly':range.period}`}>
    <div className="chart-caption"><span>{annual?'每一个有音乐的日子':weekly?'一周的听歌节律':range.period==='month'?'这个月留下的声音':'一天里的音乐时刻'}</span><span>颜色越深，停留越久</span></div>
    <div className="heat-scroll"><div className="heat-cells" style={annual?{gridTemplateRows:'repeat(7, 1fr)',gridAutoFlow:'column',gridAutoColumns:'minmax(11px,1fr)'}:weekly?{gridTemplateColumns:'repeat(24,1fr)'}:range.period==='month'?{gridTemplateColumns:'repeat(7,1fr)'}:{gridTemplateColumns:'repeat(12,1fr)'}}>
      {Array.from({length:offset},(_,i)=><span key={`pad${i}`} className="heat-pad"/>)}
      {bs.map(b=><button key={b.key} className="heat-cell" style={{'--strength':b.seconds>0?.16+.84*Math.sqrt(b.seconds/max):0} as React.CSSProperties} title={`${new Date(b.start).toLocaleString('zh-CN')} · ${durationText(b.seconds)}`} aria-label={`${new Date(b.start).toLocaleString('zh-CN')}，${durationText(b.seconds)}，查看记录`} onClick={()=>onSelect(b)}>{!annual&&!weekly&&(range.period==='month'?new Date(b.start).getDate():new Date(b.start).getHours())}</button>)}
    </div></div><div className="heat-footer"><span>{annual?`${new Date(range.start).getFullYear()} · 周一至周日` : weekly?'每行周一至周日 · 每列0—23时':''}</span><span>少 <i/><i/><i/><i/> 多</span></div>
  </div>;
}
export function Habits({ values, onSelect }: { values:number[]; onSelect(day:number,hour:number):void }) {
  const max=Math.max(1,...values); const weekdays=['一','二','三','四','五','六','日'];
  return <div className="habits"><div className="habit-axis"><span/>{Array.from({length:8},(_,i)=><span key={i}>{i*3}时</span>)}</div>{weekdays.map((d,di)=><div className="habit-row" key={d}><span>{d}</span>{Array.from({length:24},(_,hour)=>{const seconds=values[di*24+hour];return <button key={hour} style={{'--strength':seconds>0?.16+.84*Math.sqrt(seconds/max):0} as React.CSSProperties} title={`周${d} ${hour}时 · ${durationText(seconds)}`} aria-label={`周${d} ${hour}时，${durationText(seconds)}，查看记录`} onClick={()=>onSelect(di,hour)}/>})}</div>)}</div>;
}
