import { aggregate, recordPage, trajectory } from '../core/aggregate';
import { splitSegment,songKey, type ArchiveService, type Artwork,type Listen, type Song } from '../core/model';
// Original abstract placeholders, not album covers or personal screenshots.
function reference(title:string,artist:string,x:number,y:number,w:number,h:number):{song:Song;art:Artwork}{
  const hue=(x+y+w+h)%360;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${hue} 42% 26%)"/><stop offset="1" stop-color="hsl(${(hue+75)%360} 55% 66%)"/></linearGradient></defs><path fill="url(#g)" d="M0 0h640v640H0z"/><circle cx="420" cy="200" r="170" fill="#fff" opacity=".15"/><path d="M-40 470Q200 120 680 460M-40 540Q230 230 680 530" fill="none" stroke="#fff" stroke-width="35" opacity=".18"/></svg>`;
  return {song:{id:'preview-'+title,title,artist,album:null,source:'preview'},art:{url:'data:image/svg+xml,'+encodeURIComponent(svg)}};
}
const references=[
  reference('月 feat. ヰ世界情緒','Guiano / ヰ世界情緒',220,286,642,642),
  reference('Light of Nibel (feat. Aeralie Brighton)','Gareth Coker / Aeralie Brighton',218,0,646,210),
  reference('時を刻む唄','Lia',0,65,210,150),
  reference('ヒバナ','DECO*27 / 初音ミク',875,720,203,150),
  reference('探し物','omoken',875,505,203,150),
  reference('一番絵のステップ','sasakure.UK / そらこ',875,285,203,145),
  reference('ザムザ','てにをは / 初音ミク',0,939,210,142),
  reference('five seconds before sunrise','lasah / sasakure.UK',436,939,209,140),
  reference('ぼくらの16bit戦争 (feat. GUMI) [Remastered]','sasakure.UK / GUMI',219,939,210,130),
  reference('アカリがやってきたぞっ','GYARI / 紲星あかり',652,939,210,140),
];
const catalogue=references.map(r=>r.song);
export function generateDemo():Listen[]{
  let seed=87902;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);const records:Listen[]=[];
  const now=new Date();const first=new Date(now.getFullYear(),0,1);
  let id=0;
  for(let day=+first;day<Date.now();){
    const date=new Date(day);
    if(random()>.22)for(let session=0;session<1+Math.floor(random()*3);session++){
      let at=+new Date(date.getFullYear(),date.getMonth(),date.getDate(),[8,14,21][session],Math.floor(random()*40));
      for(let j=0;j<4+Math.floor(random()*13);j++){
        const index=random()<.35?0:Math.floor(random()*catalogue.length),duration=180+Math.floor(random()*150),seconds=random()<.14?5+random()*100:duration;
        const end=at+seconds*1000;
        if(end>Date.now())break;
        records.push({id:`demo-${++id}`,revision:1,song:{...catalogue[index]},duration,startedAt:at,endedAt:end,segments:splitSegment(at,end,seconds),closed:true});at=end+8000;
      }
    }
    const next=new Date(day);next.setDate(next.getDate()+1);day=+next;
  }
  return records;
}
export function previewService(empty=false):ArchiveService {
  let records=empty?[]:generateDemo(),low=false;
  const images:Record<string,Artwork>=Object.fromEntries(references.map(r=>[songKey(r.song),r.art]));
  return {startQueue:async(keys,_selected,before)=>{await before?.();return {added:keys.length,missing:0,preview:true}},play:async(keys,_mode)=>({added:keys.length,missing:0,preview:true}),artworks:async keys=>Object.fromEntries(keys.filter(k=>images[k]).map(k=>[k,images[k]])),saveArtwork:async(key,data)=>{images[key]={url:data}},query:async q=>aggregate(records,q),records:async q=>recordPage(records,q),trajectory:async (key,p)=>trajectory(records,key,p),settings:async patch=>{if(patch)low=patch.lowPerformance??false;return {lowPerformance:low}},exportBackup:async()=>{
    const blob=new Blob([JSON.stringify({format:'folia-listening-archive',version:1,records})],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='听歌档案-示例数据.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {path:'浏览器下载目录（示例数据）',records:records.length};
  },importBackup:async text=>{const data=JSON.parse(text);if(data?.format!=='folia-listening-archive'||data.version!==1||!Array.isArray(data.records))throw new Error('备份格式无效');const ids=new Set(records.map(s=>s.id));const additions=data.records.filter((s:Listen)=>!ids.has(s.id));records=[...records,...additions];return {added:additions.length,total:records.length}} };
}
