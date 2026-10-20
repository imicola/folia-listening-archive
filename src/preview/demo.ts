import { aggregate, recordPage, trajectory } from '../core/aggregate';
import { splitSegment,songKey, type ArchiveService, type Artwork,type Listen, type Song } from '../core/model';
// Public song metadata and matching covers only; all listening records are synthetic.
const references=[
  {
    "name": "惑星間SA",
    "artists": "窓辺リカ / グミねんど民放 / 白迦",
    "album": "惑星間SA",
    "cover": "https://p3.music.126.net/pbdmakW2AEB0CMigm_V9ag==/109951171425371558.jpg",
    "file": "cover-0.jpg"
  },
  {
    "name": "水母病",
    "artists": "洛天依 / 砂妍Lumean",
    "album": "水母病 - Single",
    "cover": "https://p4.music.126.net/brY9Yy4qyt-PCdfqam2LOQ==/109951173727943142.jpg",
    "file": "cover-1.jpg"
  },
  {
    "name": "月が綺麗ねと言われたい！",
    "artists": "柿崎ユウタ",
    "album": "月が綺麗ねと言われたい！",
    "cover": "https://p3.music.126.net/Q8U0jJHtO4QQ6dDatmOUdw==/109951172617879525.jpg",
    "file": "cover-2.jpg"
  },
  {
    "name": "GHOST OF LORELEY",
    "artists": "lasah",
    "album": "\"I LOVE YOU, \"",
    "cover": "https://p4.music.126.net/-W-Syb6crmpSdgAbAeWT3Q==/109951165780318709.jpg",
    "file": "cover-3.jpg"
  },
  {
    "name": "Mystery Train",
    "artists": "Omar Akram",
    "album": "Destiny",
    "cover": "https://p4.music.126.net/fNHfR31UZVlZ_DaHrAO_pw==/109951164140507200.jpg",
    "file": "cover-4.jpg"
  },
  {
    "name": "Shiori",
    "artists": "jizue",
    "album": "Shiori",
    "cover": "https://p3.music.126.net/iVjiNz4B9lIq5tRVYU0gaw==/8930233440843495.jpg",
    "file": "cover-5.jpg"
  },
  {
    "name": "trot",
    "artists": "jizue",
    "album": "story",
    "cover": "https://p4.music.126.net/GuONlwktEbNcYBTI9GMAcA==/3413983606583133.jpg",
    "file": "cover-6.jpg"
  },
  {
    "name": "tsuki no koibumi",
    "artists": "Laura Shigihara / C418",
    "album": "one",
    "cover": "https://p3.music.126.net/LshRe2pLPDJ9Ud7AIxWCFw==/109951163733665983.jpg",
    "file": "cover-7.jpg"
  },
  {
    "name": "なんてったって春",
    "artists": "サカナクション",
    "album": "sakanaction",
    "cover": "https://p4.music.126.net/o5KCqGVE4TGua3ob66N2SA==/109951171282712666.jpg",
    "file": "cover-8.jpg"
  },
  {
    "name": "ワンダー",
    "artists": "r-906 / 初音ミク",
    "album": "ワンダー",
    "cover": "https://p3.music.126.net/cOQdwWu53og2PCGny3ub0Q==/109951173553130997.jpg",
    "file": "cover-9.jpg"
  }
].map((r,i)=>({song:{id:'preview-'+i,title:r.name,artist:r.artists,album:r.album,source:'preview'} as Song,art:{url:'/assets/'+r.file} as Artwork}));
export const catalogue=references.map(r=>r.song);
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
  return {play:async(keys,_mode)=>({added:keys.length,missing:0,preview:true}),artworks:async keys=>Object.fromEntries(keys.filter(k=>images[k]).map(k=>[k,images[k]])),saveArtwork:async(key,data)=>{images[key]={url:data}},query:async q=>aggregate(records,q),records:async q=>recordPage(records,q),trajectory:async (key,p)=>trajectory(records,key,p),settings:async patch=>{if(patch)low=patch.lowPerformance??false;return {lowPerformance:low}},exportBackup:async()=>{
    const blob=new Blob([JSON.stringify({format:'folia-listening-archive',version:1,records})],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='听歌档案-示例数据.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {path:'浏览器下载目录（示例数据）',records:records.length};
  },importBackup:async text=>{const data=JSON.parse(text);if(data?.format!=='folia-listening-archive'||data.version!==1||!Array.isArray(data.records))throw new Error('备份格式无效');const ids=new Set(records.map(s=>s.id));const additions=data.records.filter((s:Listen)=>!ids.has(s.id));records=[...records,...additions];return {added:additions.length,total:records.length}} };
}
