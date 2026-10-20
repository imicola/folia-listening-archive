import React from 'react';
import { createRoot } from 'react-dom/client';
import { ListenTracker } from '../core/tracker';
import type { Listen } from '../core/model';
import { App } from './ui';
import styles from './style.css';
import acrylic from './acrylic.css';
import dense from './dense.css';
import refinements from './refinements.css';
import { rpcService, type Folium, type PanelContext } from './host';
import {createCoverObserver} from './cover-observer';
import {createFoliaCloud} from './netease-host';
import {createNativeQueue} from './native-queue';

export default function activate(f: Folium) {
  if (f.env.context !== 'main') return;
  if (f.host.folium.major !== 1 || f.host.folium.minor < 6) throw new Error('听歌档案需要 Folium 1.6 或以上版本。');
  const nativeQueue=createNativeQueue(f);const service = {...rpcService(f),startQueue:nativeQueue.local}, pending = new Map<string, Listen>();
  const cloud={...createFoliaCloud(f),play:nativeQueue.cloud};
  let sending = false, failed = false, stopped = false;
  async function flush() {
    if (sending) return;
    sending = true;
    try {
      for (const [id, item] of pending) {
        await f.rpc.call('archive.record', item);
        if (pending.get(id)?.revision === item.revision) pending.delete(id);
      }
      failed = false;
    } catch (e) {
      if (!failed) { f.log.error('听歌档案保存失败，将自动重试。', String(e)); f.ui.toast('听歌档案暂未保存，正在等待重试', { type: 'error' }); }
      failed = true;
    } finally { sending = false; }
  }
  const tracker = new ListenTracker(item => { pending.set(item.id, item); if (item.closed) void flush(); });
  const sample = (seek = false) => {
    if (stopped) return;
    try {
      const state = f.playback.getState();
      // External Stage clocks are not Folia audio playback.
      const queue = f.playback.getQueue({ limit: 1 });
      tracker.sample(queue.kind === 'stage' ? { ...state, song: null } : state, Date.now(), performance.now(), seek);
    } catch { /* Host actions may not be registered during the first frame. Retry next tick. */ }
  };
  const disposers = [f.every(1000, () => sample()), f.every(5000, () => { tracker.checkpoint(); void flush(); }),
    f.events.on('playback.songChanged', () => sample()), f.events.on('playback.stateChanged', () => { sample(); tracker.checkpoint(); void flush(); }),
    f.events.on('playback.seeked', () => sample(true)), f.events.on('playback.failed', () => { tracker.dispose(); void flush(); })];
  let remembered: ReturnType<typeof createRoot> | null = null;
  const page = f.registries.homeTabs.register({ id: 'archive', label: { 'zh-CN': '听歌档案', en: 'Listening archive' },
    mount(container: HTMLElement, ctx: PanelContext) {
      const style = document.createElement('style'); style.textContent = styles+acrylic+dense+refinements;
      const element = document.createElement('div'); element.className = 'archive-mount'; container.append(style, element);
      const root = createRoot(element); remembered = root;
      const render = () => {const theme=ctx.getTheme();root.render(<App service={service} cloud={cloud} theme={{...theme,fontStack:f.theme.resolveFontStack(theme)}} />)};
      render(); const off = ctx.onChange(render);
      return () => { off(); root.unmount(); remembered = null; style.remove(); element.remove(); };
    },
  });
  const command = f.registries.commands.register({ id: 'open', label: { 'zh-CN': '打开听歌档案', en: 'Open listening archive' }, run: () => f.ui.openHomeTab('archive') });
  sample();
  // A non-drawing public stage layer observes the current cover, without querying host DOM/stores.
  const coverObserver=f.registries.stageLayers.register({id:'cover-archive',slot:'app.overlay',mount(_container,ctx){
    const observer=createCoverObserver(()=>({song:f.playback.getState().song,contextSong:ctx.song,url:ctx.getCoverUrl()}),async url=>{
      const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();const canvas=document.createElement('canvas');const ratio=Math.min(1,640/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/webp',.86);
    },service.saveArtwork);
    void observer.capture();const off=ctx.onChange(()=>void observer.capture());return()=>{observer.dispose();off()};
  }});
  return () => {
    cloud.dispose();nativeQueue.dispose();
    sample(); stopped = true; tracker.dispose(); void flush();
    disposers.forEach(fn => fn()); page.unregister(); command.unregister();coverObserver.unregister();
  };
}
