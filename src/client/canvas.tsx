import React,{forwardRef,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from 'react';
import canvasStyles from './canvas.css';
import {rankCell} from '../core/canvas';
export type CanvasHandle={collapse():Promise<void>;restore():void};
type Camera={x:number;y:number};
// Independent implementation of the host's motion vocabulary: near-critical 300/34 reflow,
// 7px drag threshold and exponential 280ms release. Wheel deltas pan directly.
const spring=Array.from({length:61},(_,i)=>{const t=i/60*.8,w=Math.sqrt(300-17*17);return i===60?1:1-Math.exp(-17*t)*(Math.cos(w*t)+17/w*Math.sin(w*t))});
const curve=`linear(${spring.map(x=>x.toFixed(5)).join(',')})`;
export const ArchiveCanvas=forwardRef<CanvasHandle,{count:number;identity:string;reduced?:boolean;label:string;children:React.ReactNode;render(index:number,expanded:boolean,focus:()=>void):React.ReactNode}>(function ArchiveCanvas({count,identity,reduced=false,label,children,render},ref){
 const root=useRef<HTMLDivElement>(null),world=useRef<HTMLDivElement>(null),ribbon=useRef<HTMLDivElement>(null),camera=useRef<Camera>({x:0,y:0}),frame=useRef(0),dragged=useRef(false),published=useRef<Camera>({x:0,y:0});
 const [view,setView]=useState({width:1200,height:800}),[bounds,setBounds]=useState<Camera>({x:0,y:0}),[ribbonHeight,setRibbonHeight]=useState(210),[closed,setClosed]=useState(false),[focused,setFocused]=useState<{row:number;column:number;index:number;span:number}|null>(null);
 const unit=Math.max(170,Math.min(290,view.width/5)),gap=closed?0:ribbonHeight+3;
 const apply=(next:Camera)=>{camera.current=next;if(world.current)world.current.style.transform=`translate3d(${next.x}px,${next.y}px,0)`;if(Math.abs(next.x-published.current.x)>unit/2||Math.abs(next.y-published.current.y)>unit/2){published.current={...next};setBounds({...next})}};
 const stop=()=>cancelAnimationFrame(frame.current);
 const pan=(target:Camera)=>{stop();if(reduced){apply(target);setBounds(target);return}const start={...camera.current},at=performance.now();const step=(now:number)=>{const p=Math.min(1,(now-at)/650),t=p*60,index=Math.min(59,Math.floor(t)),s=spring[index]+(spring[index+1]-spring[index])*(t-index);apply({x:start.x+(target.x-start.x)*s,y:start.y+(target.y-start.y)*s});if(p<1)frame.current=requestAnimationFrame(step);else{apply(target);setBounds(target)}};frame.current=requestAnimationFrame(step)};
 const reset=()=>{setFocused(null);pan({x:0,y:0})};
 useImperativeHandle(ref,()=>({async collapse(){setFocused(null);setClosed(true);await new Promise(r=>setTimeout(r,reduced?180:420))},restore(){setClosed(false);reset()}}),[reduced]);
 useLayoutEffect(()=>{if(!root.current||!ribbon.current)return;const observer=new ResizeObserver(()=>{if(root.current)setView({width:root.current.clientWidth,height:root.current.clientHeight});if(ribbon.current)setRibbonHeight(ribbon.current.offsetHeight)});observer.observe(root.current);observer.observe(ribbon.current);return()=>observer.disconnect()},[]);
 useEffect(()=>{setFocused(null);setClosed(false);stop();apply({x:0,y:0});setBounds({x:0,y:0})},[identity]);
 useEffect(()=>()=>stop(),[]);
 useEffect(()=>{const node=root.current;if(!node)return;const wheel=(event:WheelEvent)=>{
  if((event.target as HTMLElement).closest('.canvas-info,.canvas-tools,.sheet-backdrop'))return;
  event.preventDefault();setFocused(null);stop();const factor=event.deltaMode===1?16:1;apply({x:camera.current.x-event.deltaX*factor,y:camera.current.y-event.deltaY*factor});
 };node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel)},[bounds,unit]);
 const pointer=useRef<{id:number;x:number;y:number;camera:Camera;lastX:number;lastY:number;time:number;vx:number;vy:number}|null>(null);
 const top=Math.floor((-bounds.y-gap)/unit)-2,bottom=Math.ceil((-bounds.y+view.height)/unit)+2,left=Math.floor(-bounds.x/unit)-2,right=Math.ceil((-bounds.x+view.width)/unit)+2;
 const cells=new Map<string,{row:number;column:number;index:number;span:number}>();
 if(count)for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){const c=rankCell(row,col,count);cells.set(`${row}:${c.column}`,{row,...c})}
 const validFocus=focused&&focused.index<count?focused:null;
 if(validFocus)cells.set(`${validFocus.row}:${validFocus.column}`,validFocus);
 const baseRect=(cell:{row:number;column:number;span:number})=>({x:cell.column*unit,y:cell.row*unit+(cell.row>=1?gap:0),width:cell.span*unit-3,height:unit-3});
 const focusRect=validFocus?(()=>{const b=baseRect(validFocus),size=Math.min(unit*2.8,view.width*.75,Math.max(220,view.height-125));return {x:b.x+(b.width-size)/2,y:b.y+(b.height-size)/2,width:size,height:size}})():null;
 const select=(cell:{row:number;column:number;index:number;span:number})=>{if(focused?.row===cell.row&&focused.column===cell.column){setFocused(null);return}setFocused(cell);const b=baseRect(cell);pan({x:view.width/2-b.x-b.width/2,y:(view.height-70)/2-b.y-b.height/2})};
 return <div ref={root} className={`archive-canvas ${reduced?'canvas-reduced':''} ${closed?'ribbon-closed':''}`} aria-label={label} data-testid="rank-canvas" style={{'--reflow-curve':curve} as React.CSSProperties}
  onPointerDown={event=>{if(event.button!==0||(event.target as HTMLElement).closest('.canvas-info,.canvas-tools,.window-actions,input,select'))return;stop();dragged.current=false;pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY,camera:{...camera.current},lastX:event.clientX,lastY:event.clientY,time:performance.now(),vx:0,vy:0}}}
  onPointerMove={event=>{const p=pointer.current;if(!p||p.id!==event.pointerId)return;if(!dragged.current&&Math.hypot(event.clientX-p.x,event.clientY-p.y)<7)return;if(!dragged.current){dragged.current=true;setFocused(null);event.currentTarget.setPointerCapture(event.pointerId)}const now=performance.now(),dt=Math.max(1,now-p.time);p.vx=(event.clientX-p.lastX)/dt;p.vy=(event.clientY-p.lastY)/dt;p.lastX=event.clientX;p.lastY=event.clientY;p.time=now;apply({x:p.camera.x+event.clientX-p.x,y:p.camera.y+event.clientY-p.y})}}
  onPointerUp={event=>{const p=pointer.current;pointer.current=null;if(!p||!dragged.current||reduced||performance.now()-p.time>80)return;const vx=Math.max(-4,Math.min(4,p.vx)),vy=Math.max(-4,Math.min(4,p.vy)),start={...camera.current},at=performance.now();const coast=(now:number)=>{const dt=now-at,k=280*(1-Math.exp(-dt/280));apply({x:start.x+vx*k*.3,y:start.y+vy*k*.3});if(dt<1200)frame.current=requestAnimationFrame(coast)};frame.current=requestAnimationFrame(coast)}}
  onPointerCancel={()=>{pointer.current=null;dragged.current=false}}
  onClickCapture={event=>{if(dragged.current&&event.detail!==0){event.preventDefault();event.stopPropagation();dragged.current=false}}}
  onKeyDown={event=>{if((event.target as HTMLElement).closest('input,select,.canvas-info'))return;if(event.key==='Escape'){setFocused(null);return}const delta={ArrowLeft:[130,0],ArrowRight:[-130,0],ArrowUp:[0,130],ArrowDown:[0,-130]}[event.key];if(delta){event.preventDefault();pan({x:camera.current.x+delta[0],y:camera.current.y+delta[1]})}}}>
  <style>{canvasStyles}</style><div ref={world} className="canvas-world" data-camera-x={bounds.x} data-camera-y={bounds.y}>
   {[...cells].map(([key,cell])=>{const active=focused?.row===cell.row&&focused.column===cell.column;let r=baseRect(cell);
    if(active&&focusRect)r=focusRect;
    else if(focusRect&&r.x<focusRect.x+focusRect.width&&r.x+r.width>focusRect.x&&r.y<focusRect.y+focusRect.height&&r.y+r.height>focusRect.y){const dx=r.x+r.width/2-focusRect.x-focusRect.width/2,dy=r.y+r.height/2-focusRect.y-focusRect.height/2;if(Math.abs(dx)>Math.abs(dy))r={...r,x:dx<0?focusRect.x-r.width-3:focusRect.x+focusRect.width+3};else r={...r,y:dy<0?focusRect.y-r.height-3:focusRect.y+focusRect.height+3}}
    return <div key={key} className={`canvas-cell ${active?'is-focused':''}`} style={{left:r.x,top:r.y,width:r.width,height:r.height,zIndex:active?6:1}} data-rank={cell.index+1}>{render(cell.index,active,()=>select(cell))}</div>;
   })}
   <div ref={ribbon} className="canvas-info" style={{left:0,top:unit,width:view.width,maxHeight:Math.max(180,view.height-unit-90),overflowY:'auto',overflowX:'clip'}} inert={closed?true:undefined}>{children}</div>
  </div>
  <div className="canvas-tools"><span>{count} 项 · 拖动浏览</span>{focused&&<button onClick={()=>setFocused(null)} aria-label="收起聚焦">收起聚焦</button>}<button onClick={()=>{setClosed(false);reset()}} aria-label="回到统计横幅">{closed?'展开统计':'定位统计'}</button></div>
 </div>;
});
