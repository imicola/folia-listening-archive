import type {CloudSong} from '../core/netease';
import type {PlaybackAccess} from './playback';
import type {Song} from '../core/model';

// Match provider + original ID, never a title or a song reconstructed from private host fields.
// Re-read each DTO immediately before use because playback may reorder the host queue/ref pool.
export async function playCloudSongs(playback:PlaybackAccess,songs:CloudSong[],selected:string){
 if(playback.getQueue({offset:0,limit:1}).kind==='stage')throw new Error('请先退出外部 Stage 播放，再播放网易云榜单');
 if(!songs.some(song=>song.id===selected))throw new Error('所选歌曲不在当前榜单中');
 const ids=[selected,...new Set(songs.map(song=>song.id).filter(id=>id!==selected))];
 const resolve=(id:string):Song|null=>{
  const matches=(song:Song|null|undefined)=>song?.source==='netease'&&song.id===id&&!!song.ref;
  const current=playback.getState().song;if(matches(current))return current;
  let length=1;
  for(let offset=0;offset<length;offset+=500){const page=playback.getQueue({offset,limit:500});length=page.length;const index=page.items.findIndex(item=>matches(item.song));if(index>=0){const fresh=playback.getQueue({offset:offset+index,limit:1}).items[0]?.song;return matches(fresh)?fresh!:null}}
  return null;
 };
 const first=resolve(selected);
 if(!first)throw new Error('所选网易云歌曲不在当前 Folia 会话中；请先在 Folia 打开其歌单或播放该歌曲，再重试。原队列未更改');
 if(!await playback.playSong(first))throw new Error('Folia 未接受所选歌曲的播放请求，请重新加载歌单');
 let added=1;
 for(const id of ids.slice(1)){const song=resolve(id);if(song&&playback.enqueue(song))added++}
 return {added,missing:ids.length-added};
}
