import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';

/** Keeps the menu inside Folium's style boundary, including in a shadow root. */
export function AcrylicSelect<T extends string>({label,value,options,onChange}:{label:string;value:T;options:{value:T;label:string}[];onChange(value:T):void}){
  const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),[open,setOpen]=useState(false),[active,setActive]=useState(0),[above,setAbove]=useState(false);
  const selected=Math.max(0,options.findIndex(o=>o.value===value));
  const close=()=>setOpen(false);
  const choose=(index:number)=>{onChange(options[index].value);close();trigger.current?.focus()};
  useLayoutEffect(()=>{if(!open)return;const measure=()=>{const rect=trigger.current?.getBoundingClientRect();if(rect)setAbove(rect.bottom+options.length*35+12>innerHeight&&rect.top>options.length*35+12)};measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure)},[open,options.length]);
  useEffect(()=>{if(!open)return;const boundary=root.current?.getRootNode();const outside=(event:Event)=>{if(root.current&&!event.composedPath().includes(root.current))close()};boundary?.addEventListener('pointerdown',outside);return()=>boundary?.removeEventListener('pointerdown',outside)},[open]);
  return <div ref={root} className="archive-select" data-open={open||undefined} data-side={above?'top':'bottom'} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))close()}}>
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open?id:undefined} aria-activedescendant={open?`${id}-${active}`:undefined} onClick={()=>{setActive(selected);setOpen(v=>!v)}} onKeyDown={event=>{
      if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();return}
      if(event.key==='Tab'){close();return}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();setOpen(true);setActive(i=>event.key==='Home'?0:event.key==='End'?options.length-1:!open?selected:(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);return}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(active);else{setActive(selected);setOpen(true)}}
    }}><span>{options[selected].label}</span><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg></button>
    {open&&<div id={id} className="archive-select-menu" role="listbox" aria-label={label}>{options.map((option,index)=><div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value===option.value} data-active={active===index||undefined} onPointerDown={e=>e.preventDefault()} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}><span>{option.label}</span><span aria-hidden="true">{value===option.value?'✓':''}</span></div>)}</div>}
  </div>;
}
