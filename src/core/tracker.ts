import { songKey, splitSegment, type Song, type Listen } from './model';
export type Playback = { song: Song | null; state: 'playing' | 'paused' | 'stopped'; position: number; duration: number };
type Anchor = { at: number; mono: number; position: number; state: string };
export class ListenTracker {
  private active: Listen | null = null;
  private anchor: Anchor | null = null;
  private counter = 0;
  constructor(private emit: (s: Listen) => void, private prefix: string = globalThis.crypto.randomUUID()) {}
  private publish(closed: boolean) {
    if (!this.active) return;
    this.active.closed = closed; this.active.revision++;
    this.emit(structuredClone(this.active));
  }
  private close() { this.publish(true); this.active = null; this.anchor = null; }
  private open(p: Playback, at: number) {
    this.active = { id: `${this.prefix}-${++this.counter}`, revision: 0, song: { ...p.song! }, duration: Math.max(0, p.duration || 0), startedAt: at, endedAt: at, segments: [], closed: false };
  }
  sample(p: Playback, at: number, mono: number, seek = false) {
    // `source:null` is a metadata-only external Stage; never turn its lyric clock into a listen.
    if (!p.song || p.song.source === null || p.state === 'stopped') { this.close(); return; }
    if (this.active && songKey(this.active.song) !== songKey(p.song)) this.close();
    // Same canonical song on another source/album is still a new raw occurrence.
    if (this.active && (this.active.song.id !== p.song.id || this.active.song.source !== p.song.source || this.active.song.album !== p.song.album)) this.close();
    const prev = this.anchor;
    if (this.active && prev && p.position <= 2 && prev.position > 5 && p.position < prev.position - 4) this.close();
    if (!this.active) this.open(p, at);
    const a = this.anchor;
    if (p.duration > 0 && Number.isFinite(p.duration)) this.active!.duration = p.duration;
    if (a && !seek && a.state === 'playing') {
      const wall = (mono - a.mono) / 1000, elapsed = (at - a.at) / 1000, delta = p.position - a.position;
      // Suspend, buffering, jumps, backwards time and changed system clocks rebase without credit.
      if (wall > 0 && wall <= 4 && Math.abs(elapsed - wall) < .8 && delta > 0 && delta <= wall * 1.35 + .25) {
        const seconds = Math.min(delta, wall);
        for (const part of splitSegment(a.at, at, seconds)) {
          const last = this.active!.segments.at(-1);
          if (last && Math.abs(last.end - part.start) < 5 && last.offset === part.offset && Math.floor((last.start - last.offset * 60000) / 3600000) === Math.floor((part.start - part.offset * 60000) / 3600000)) {
            last.end = part.end; last.seconds += part.seconds;
          } else this.active!.segments.push(part);
        }
      }
    }
    this.active!.endedAt = at;
    this.anchor = { at, mono, position: p.position, state: p.state };
  }
  checkpoint() { this.publish(false); }
  dispose() { this.close(); }
}
