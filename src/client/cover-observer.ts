import {normalize,songKey,type Song} from '../core/model';
type Frame={song:Song|null;contextSong:Song|null;url:string|null};
export function createCoverObserver(read:()=>Frame,encode:(url:string)=>Promise<string>,save:(key:string,data:string)=>Promise<void>){
  let disposed=false,saved='';const pending=new Set<string>();
  const snapshot=()=>{
    const frame=read(),{song,contextSong,url}=frame;
    if(!song||!contextSong||!url||songKey(song)!==songKey(contextSong)||normalize(song.album||'')!==normalize(contextSong.album||''))return null;
    return {key:songKey(song),url,identity:JSON.stringify([songKey(song),song.source,song.id,song.album,url])};
  };
  return {async capture(){
    let identity='';
    try{
      const frame=snapshot();if(disposed||!frame||frame.identity===saved||pending.has(frame.identity))return false;
      identity=frame.identity;pending.add(identity);
      const data=await encode(frame.url);
      // A slow old image must not overwrite the cover of a new song/album.
      if(disposed||snapshot()?.identity!==identity)return false;
      await save(frame.key,data);saved=identity;return true;
    }catch{return false}finally{if(identity)pending.delete(identity)}
  },dispose(){disposed=true}};
}
