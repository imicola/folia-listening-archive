import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../client/ui';
import styles from '../client/style.css';
import acrylic from '../client/acrylic.css';
import dense from '../client/dense.css';
import refinements from '../client/refinements.css';
import {previewService} from './demo';
const style=document.createElement('style');style.textContent=styles+acrylic+dense+refinements;document.head.append(style);
function Preview(){const [light,setLight]=useState(false),[empty,setEmpty]=useState(false);const service=useMemo(()=>previewService(empty),[empty]);const theme=light?{backgroundColor:'#f5f3f8',primaryColor:'#302a3f',secondaryColor:'#767081',accentColor:'#8061bf',isDaylight:true,animationIntensity:'normal'}:{backgroundColor:'#15171e',primaryColor:'#eeebf5',secondaryColor:'#a39dae',accentColor:'#b5a0e7',isDaylight:false,animationIntensity:'normal'};
  return <><div className="preview-controls"><span>真实歌曲封面 · 统计为示例</span><button onClick={()=>setLight(x=>!x)}>{light?'深色主题':'浅色主题'}</button><button onClick={()=>setEmpty(x=>!x)}>{empty?'查看示例':'查看空状态'}</button></div><div id="preview-app"><App key={String(empty)} service={service} theme={theme} preview/></div></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
