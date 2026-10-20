export type Song = { id: string | null; title: string; artist: string; album: string | null; source: string | null; ref?: string | null };
export type Segment = { start: number; end: number; seconds: number; offset: number };
export type Listen = { id: string; revision: number; song: Song; duration: number; startedAt: number; endedAt: number; segments: Segment[]; closed: boolean };
export type Period = 'day' | 'week' | 'month' | 'year';
export type Range = { start: number; end: number; period: Period };
export type Filter = { songKey?: string; artistKey?: string; albumKey?: string; weekday?: number; hour?: number };
export type Query = Range & { filter?: Filter };
export type Bucket = { key: string; label: string; start: number; end: number; seconds: number; plays: number; songs: number };
export type Rank = { key: string; name: string; subtitle: string; plays: number; seconds: number; songKeys: string[]; share: number };
export type Summary = { seconds: number; plays: number; songs: number; artists: number; albums: number; newSongs: number; newShare: number; topShare: number };
export type Result = { revision: number; summary: Summary; buckets: Bucket[]; heat: Bucket[]; habits: number[]; songs: Rank[]; artists: Rank[]; albums: Rank[]; firstRecorded: number | null; recordCount: number };
export type RecordView = { id: string; song: Song; songKey: string; startedAt: number; seconds: number; actual: number; counted: boolean; completed: boolean; closed: boolean };
export type Page<T> = { items: T[]; total: number; offset: number };
export type ArchiveSettings = { lowPerformance: boolean };
export type Artwork = { url:string; crop?:{x:number;y:number;w:number;h:number;imageW:number;imageH:number} };
export interface ArchiveService {
  startQueue?(keys:string[],selected:string,before?:()=>Promise<void>):Promise<{added:number;missing:number;preview?:boolean}>;
  play(keys:string[],mode:'queue'|'play'):Promise<{added:number;missing:number;preview?:boolean}>;
  artworks(keys:string[]):Promise<Record<string,Artwork>>;
  saveArtwork(key:string,data:string):Promise<void>;
  query(q: Query): Promise<Result>;
  records(q: Query & { offset?: number; limit?: number }): Promise<Page<RecordView>>;
  trajectory(key: string, period: Period): Promise<{ first: number | null; last: number | null; summary: Summary; ranks: { label: string; rank: number | null }[]; habits: number[] }>;
  settings(patch?: Partial<ArchiveSettings>): Promise<ArchiveSettings>;
  exportBackup(): Promise<{ path: string; records: number }>;
  importBackup(text: string): Promise<{ added: number; total: number }>;
}

export const normalize = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
export const artistNames = (s: Song) => [...new Map(s.artist.split(' / ').map(n => n.trim()).filter(Boolean).map(n => [normalize(n), n])).values()];
export const songKey = (s: Song) => JSON.stringify([normalize(s.title), artistNames(s).map(normalize).sort()]);
export const albumKey = (s: Song) => JSON.stringify([normalize(s.album || '未知专辑'), normalize(artistNames(s)[0] || '未知歌手')]);
export const actualSeconds = (s: Listen) => s.segments.reduce((sum, p) => sum + p.seconds, 0);
export const isCompleted = (s: Listen) => s.duration > 0 && actualSeconds(s) >= s.duration * .9;
export const isCounted = (s: Listen) => actualSeconds(s) >= (s.duration > 0 ? Math.min(30, s.duration / 2) : 30);
export const creditSeconds = (s: Listen) => isCompleted(s) ? Math.max(s.duration, actualSeconds(s)) : actualSeconds(s);
export const localParts = (at: number, offset: number) => {
  const d = new Date(at - offset * 60_000);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours(), weekday: (d.getUTCDay() + 6) % 7 };
};
export function makeRange(period: Period, anchor: number): Range {
  const d = new Date(anchor); d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  if (period === 'month') d.setDate(1);
  if (period === 'year') { d.setMonth(0, 1); }
  const e = new Date(d);
  if (period === 'day') e.setDate(e.getDate() + 1);
  if (period === 'week') e.setDate(e.getDate() + 7);
  if (period === 'month') e.setMonth(e.getMonth() + 1);
  if (period === 'year') e.setFullYear(e.getFullYear() + 1);
  return { period, start: +d, end: +e };
}
export function shiftRange(range: Range, direction: number) {
  const d = new Date(range.start);
  if (range.period === 'day') d.setDate(d.getDate() + direction);
  if (range.period === 'week') d.setDate(d.getDate() + 7 * direction);
  if (range.period === 'month') d.setMonth(d.getMonth() + direction);
  if (range.period === 'year') d.setFullYear(d.getFullYear() + direction);
  return makeRange(range.period, +d);
}
export const emptySummary = (): Summary => ({ seconds: 0, plays: 0, songs: 0, artists: 0, albums: 0, newSongs: 0, newShare: 0, topShare: 0 });

// Segment boundaries preserve local calendar/hour attribution, including DST changes.
export function splitSegment(start: number, end: number, seconds: number): Segment[] {
  const out: Segment[] = [];
  for (let at = start; at < end;) {
    const d = new Date(at); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
    const next = Math.min(end, Math.max(at + 1, +d));
    out.push({ start: at, end: next, seconds: seconds * (next - at) / (end - start), offset: new Date(at).getTimezoneOffset() }); at = next;
  }
  return out;
}
