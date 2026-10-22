import {songKey,type Song} from '../core/model';
export interface PlaybackAccess {
  getState():{song:Song|null};
  getQueue(options:{offset:number;limit:number}):{kind?:string;length:number;items:{song:Song}[]};
  enqueue(song:Song):boolean;
  playSong(song:Song):Promise<boolean>;
}
// Keep positions, not host refs: the host's ref pool is bounded and session scoped.
export async function playArchiveSongs(playback:PlaybackAccess,keys:string[],mode:'play'|'queue') {
  const wanted=[...new Set(keys)],positions=new Map<string,number>();
  const scan=()=>{
    positions.clear();
    let length=1;
    for(let offset=0;offset<length;offset+=500){
      const page=playback.getQueue({offset,limit:500});length=page.length;
      page.items.forEach(({song},i)=>{const key=songKey(song);if(!positions.has(key))positions.set(key,offset+i)});
    }
  };
  scan();let added=0;
  for(const key of wanted){
    let song=playback.getState().song;
    if(!song||songKey(song)!==key||!song.ref){
      const read=()=>{const offset=positions.get(key);return offset===undefined?null:playback.getQueue({offset,limit:1}).items[0]?.song||null};
      song=read();
      // Playing or other host activity may have changed queue order since the scan.
      if(!song||songKey(song)!==key||!song.ref){scan();song=read()}
    }
    if(!song||songKey(song)!==key||!song.ref)continue;
    const ok=mode==='play'&&added===0?await playback.playSong(song):playback.enqueue(song);
    if(ok)added++;
  }
  return {added,missing:wanted.length-added};
}
