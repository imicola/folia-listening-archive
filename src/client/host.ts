import type { Song, ArchiveService, ArchiveSettings, Query, Period } from '../core/model';
import type { Playback } from '../core/tracker';
import {playArchiveSongs} from './playback';
export type Theme = { backgroundColor: string; primaryColor: string; secondaryColor: string; accentColor: string; isDaylight: boolean; animationIntensity: string; fontFamily?: string; fontStack?:string };
export interface PanelContext { getTheme(): Theme; onChange(fn: () => void): () => void; onDispose(fn: () => void): void }
type Handle = { unregister(): void };
export interface Folium {
  host: { folium: { major: number; minor: number } }; env: { context: string };
  theme:{resolveFontStack(theme:Theme):string};
  playback: { getState(): Playback; getQueue(options?: {limit?:number;offset?:number}): { kind: string;length:number;items:{song:Song}[] };enqueue(song:Song):boolean;playSong(song:Song):Promise<boolean> };
  events: { on(name: string, callback: (data: any) => void): () => void };
  every(ms: number, callback: () => void): () => void;
  rpc: { call<T = unknown>(name: string, ...args: unknown[]): Promise<T> };
  registries: { stageLayers:{register(def:{id:string;slot:string;mount(container:HTMLElement,ctx:PanelContext&{song:Song|null;getCoverUrl():string|null}):()=>void}):Handle};homeTabs: { register(def: { id: string; label: Record<string,string>; mount(container: HTMLElement, ctx: PanelContext): () => void }): Handle }; commands: { register(def: { id: string; label: Record<string,string>; run(): void }): Handle } };
  ui: { openHomeTab(id: string): void; toast(message: string, options?: { type: string }): void };
  log: { error(message: string, details?: unknown): void };
}
export const rpcService = (f: Folium): ArchiveService => ({
  play:(keys,mode)=>playArchiveSongs(f.playback,keys,mode),
  artworks:keys=>f.rpc.call('archive.artworks',keys),saveArtwork:(key,data)=>f.rpc.call('archive.artwork.save',key,data),
  query: q => f.rpc.call('archive.query', q), records: q => f.rpc.call('archive.records', q),
  trajectory: (key, period) => f.rpc.call('archive.trajectory', key, period),
  settings: patch => f.rpc.call('archive.settings', patch), exportBackup: () => f.rpc.call('archive.export'),
  importBackup: text => f.rpc.call('archive.import', text),
});
