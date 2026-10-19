import { actualSeconds, albumKey, artistNames, creditSeconds, emptySummary, isCompleted, isCounted, localParts, makeRange, normalize, songKey, type Bucket, type Filter, type Listen, type Query, type Rank, type RecordView, type Result, type Period } from './model';

export function bucketsFor(q: Query, heat = false): Bucket[] {
  const result: Bucket[] = [];
  for (let at = q.start; at < q.end;) {
    const d = new Date(at), e = new Date(at);
    const hourly = q.period === 'day' || (heat && q.period === 'week');
    if (hourly) e.setHours(e.getHours() + 1);
    else if (q.period === 'year' && !heat) e.setMonth(e.getMonth() + 1);
    else e.setDate(e.getDate() + 1);
    const end = Math.min(q.end, +e);
    const label = hourly ? `${String(d.getHours()).padStart(2, '0')}:00` : q.period === 'year' && !heat ? `${d.getMonth() + 1}月` : `${d.getMonth() + 1}/${d.getDate()}`;
    result.push({ key: String(at), label, start: at, end, seconds: 0, plays: 0, songs: 0 });
    at = end;
  }
  return result;
}
function songMatches(s: Listen, filter?: Filter) {
  const names=artistNames(s.song);
  return (!filter?.songKey || songKey(s.song) === filter.songKey) && (!filter?.albumKey || albumKey(s.song) === filter.albumKey) && (!filter?.artistKey || (names.length?names:['未知歌手']).some(n => normalize(n) === filter.artistKey));
}
export function secondsWithin(s: Listen, q: Query) {
  let seconds = 0;
  for (const part of s.segments) {
    const a = Math.max(part.start, q.start), b = Math.min(part.end, q.end);
    const local = localParts(part.start, part.offset);
    if (b > a && (q.filter?.weekday === undefined || q.filter.weekday === local.weekday) && (q.filter?.hour === undefined || q.filter.hour === local.hour)) seconds += part.seconds * (b - a) / (part.end - part.start);
  }
  const actual = actualSeconds(s);
  return actual > 0 ? seconds * creditSeconds(s) / actual : 0;
}
function countWithin(s: Listen, q: Query) {
  const p = localParts(s.startedAt, new Date(s.startedAt).getTimezoneOffset());
  return isCounted(s) && s.startedAt >= q.start && s.startedAt < q.end && (q.filter?.weekday === undefined || q.filter.weekday === p.weekday) && (q.filter?.hour === undefined || q.filter.hour === p.hour);
}
export function aggregate(all: Listen[], q: Query, revision = 0): Result {
  const summary = emptySummary(), buckets = bucketsFor(q), heat = bucketsFor(q, true), habits = Array<number>(168).fill(0);
  const songs = new Map<string, Rank>(), artists = new Map<string, Rank>(), albums = new Map<string, Rank>();
  const first = new Map<string, number>();
  for (const s of all) if (actualSeconds(s) > 0) first.set(songKey(s.song), Math.min(first.get(songKey(s.song)) ?? Infinity, s.startedAt));
  const add = (map: Map<string, Rank>, key: string, name: string, subtitle: string, seconds: number, plays: number, sk: string) => {
    const row = map.get(key) || { key, name, subtitle, plays: 0, seconds: 0, songKeys: [], share: 0 };
    row.seconds += seconds; row.plays += plays;
    if (!row.songKeys.includes(sk)) row.songKeys.push(sk);
    map.set(key, row);
  };
  const fill = (bs: Bucket[], s: Listen) => {
    for (const b of bs) {
      if (s.endedAt < b.start || s.startedAt >= b.end) continue;
      const sub = { ...q, start: b.start, end: b.end };
      b.seconds += secondsWithin(s, sub); b.plays += Number(countWithin(s, sub));
    }
  };
  for (const s of all) {
    if (!songMatches(s, q.filter) || s.endedAt < q.start || s.startedAt >= q.end) continue;
    const seconds = secondsWithin(s, q), plays = Number(countWithin(s, q));
    if (seconds <= 0 && !plays) continue;
    const sk = songKey(s.song), names = artistNames(s.song);
    summary.seconds += seconds; summary.plays += plays;
    add(songs, sk, s.song.title || '未命名歌曲', s.song.artist || '未知歌手', seconds, plays, sk);
    for (const n of names.length ? names : ['未知歌手']) add(artists, normalize(n), n, '', seconds, plays, sk);
    add(albums, albumKey(s.song), s.song.album || '未知专辑', names[0] || '未知歌手', seconds, plays, sk);
    fill(buckets, s); fill(heat, s);
    const factor = actualSeconds(s) ? creditSeconds(s) / actualSeconds(s) : 1;
    for (const p of s.segments) {
      const a = Math.max(p.start, q.start), b = Math.min(p.end, q.end), local = localParts(p.start, p.offset);
      if (b > a && (q.filter?.weekday === undefined || local.weekday === q.filter.weekday) && (q.filter?.hour === undefined || local.hour === q.filter.hour)) habits[local.weekday * 24 + local.hour] += p.seconds * (b - a) / (p.end - p.start) * factor;
    }
  }
  const sorted = (m: Map<string, Rank>) => [...m.values()].map(r => ({ ...r, share: summary.seconds ? r.seconds / summary.seconds : 0 })).sort((a,b) => b.plays - a.plays || b.seconds - a.seconds || a.name.localeCompare(b.name));
  const rows = sorted(songs); summary.songs = songs.size; summary.artists = artists.size; summary.albums = albums.size;
  summary.newSongs = rows.filter(r => (first.get(r.key) ?? 0) >= q.start && (first.get(r.key) ?? Infinity) < q.end).length;
  summary.newShare = rows.length ? summary.newSongs / rows.length : 0;
  summary.topShare = rows.reduce((max,r) => Math.max(max, r.share), 0);
  return { revision, summary, buckets, heat, habits, songs: rows, artists: sorted(artists), albums: sorted(albums), firstRecorded: first.size ? [...first.values()].reduce((a,b)=>Math.min(a,b),Infinity) : null, recordCount: all.length };
}
export function recordPage(all: Listen[], q: Query & { offset?: number; limit?: number }) {
  const items: RecordView[] = all.filter(s => songMatches(s, q.filter) && secondsWithin(s, q) > 0).sort((a,b) => b.startedAt - a.startedAt).map(s => ({ id: s.id, song: s.song, songKey: songKey(s.song), startedAt: s.startedAt, seconds: secondsWithin(s, q), actual: actualSeconds(s), counted: isCounted(s), completed: isCompleted(s), closed: s.closed }));
  const offset = Math.max(0, q.offset || 0), limit = Math.min(100, Math.max(1, q.limit || 40));
  return { items: items.slice(offset, offset + limit), total: items.length, offset };
}
export function trajectory(all: Listen[], key: string, period: Period) {
  const songs = all.filter(s => songKey(s.song) === key && actualSeconds(s) > 0);
  const first = songs.length ? songs.reduce((n,s)=>Math.min(n,s.startedAt),Infinity) : null, last = songs.length ? songs.reduce((n,s)=>Math.max(n,s.endedAt),0) : null;
  // A bounded range avoids generating buckets for the full Date domain.
  const now = last || Date.now(), range = makeRange('year', now);
  const full = aggregateWithoutHugeRange(all, key, first, last);
  const ranks = [];
  // At most 24 periods are built even for decades-old imported archives.
  const ranges = []; let cursor=makeRange(period,now);
  for(let i=0;i<24 && (first===null?i===0:cursor.end>first);i++){ranges.unshift(cursor);cursor=makeRange(period,cursor.start-1)}
  for (const r of ranges) { const list = aggregate(all.filter(s=>s.endedAt>=r.start&&s.startedAt<r.end), r).songs; const index = list.findIndex(s => s.key === key); ranks.push({ label: new Date(r.start).toLocaleDateString('zh-CN', { year:'2-digit', month: 'numeric' }), rank: index < 0 ? null : index + 1 }); }
  return { first, last, summary: full.summary, ranks, habits: full.habits };
}
function aggregateWithoutHugeRange(all: Listen[], key: string, first: number | null, last: number | null) {
  // Lifetime summary can span years without generating per-hour chart buckets.
  const matching = all.filter(s => songKey(s.song) === key), habits = Array<number>(168).fill(0), summary = emptySummary();
  const artists = new Set<string>(), albums = new Set<string>();
  for (const s of matching) { const actual = actualSeconds(s); summary.seconds += creditSeconds(s); summary.plays += Number(isCounted(s)); artistNames(s.song).forEach(n => artists.add(normalize(n))); albums.add(albumKey(s.song));
    for (const p of s.segments) { const l = localParts(p.start, p.offset); habits[l.weekday * 24 + l.hour] += p.seconds * (actual ? creditSeconds(s) / actual : 1); }
  }
  summary.songs = first === null ? 0 : 1; summary.artists = artists.size; summary.albums = albums.size;
  return { summary, habits };
}
