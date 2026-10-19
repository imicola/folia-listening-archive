import fs from 'node:fs';
import path from 'node:path';
import { actualSeconds, type Listen, type ArchiveSettings } from '../core/model';

export function validateListen(value: unknown): Listen {
  const s = value as Listen;
  const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  const text = (n: unknown, max = 2000) => typeof n === 'string' && n.length <= max;
  if (!s || typeof s !== 'object' || !text(s.id, 160) || !/^[\w-]+$/.test(s.id) || !Number.isInteger(s.revision) || s.revision < 1 || typeof s.closed !== 'boolean') throw new Error('记录标识或版本无效');
  if (!s.song || !text(s.song.title) || !text(s.song.artist) || !(s.song.album === null || text(s.song.album)) || !(s.song.source === null || text(s.song.source, 200)) || !(s.song.id === null || text(s.song.id))) throw new Error('歌曲信息无效');
  if (!number(s.duration) || s.duration < 0 || s.duration > 7 * 86400 || !number(s.startedAt) || !number(s.endedAt) || s.startedAt < 0 || s.endedAt < s.startedAt || s.endedAt > Date.now() + 86400_000) throw new Error('记录时间无效');
  if (!Array.isArray(s.segments) || s.segments.length > 20_000) throw new Error('播放片段无效');
  let previous = s.startedAt;
  for (const p of s.segments) {
    if (!p || !number(p.start) || !number(p.end) || !number(p.seconds) || p.start < previous - 1 || p.end <= p.start || p.end > s.endedAt + 1 || p.seconds <= 0 || p.seconds > (p.end - p.start) / 1000 * 1.01 || !Number.isInteger(p.offset) || Math.abs(p.offset) > 900) throw new Error('播放片段时间无效');
    previous = p.end;
  }
  // Do not persist temporary host refs or arbitrary additional backup properties.
  return { id: s.id, revision: s.revision, closed: s.closed, startedAt: s.startedAt, endedAt: s.endedAt, duration: s.duration,
    song: { id: s.song.id, title: s.song.title, artist: s.song.artist, album: s.song.album, source: s.song.source },
    segments: s.segments.map(p => ({ start: p.start, end: p.end, seconds: p.seconds, offset: p.offset })) };
}

export class ArchiveStore {
  private records = new Map<string, Listen>();
  private active = new Set<string>();
  revision = 0;
  warnings: string[] = [];
  constructor(readonly directory: string) {
    fs.mkdirSync(directory, { recursive: true });
    for (const name of fs.readdirSync(directory).filter(f => /^\d{4}-\d\d\.jsonl$/.test(f))) {
      const file = path.join(directory, name), raw = fs.readFileSync(file, 'utf8');
      const lines = raw.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        try { const s = validateListen(JSON.parse(lines[i])); const previous = this.records.get(s.id); if (!previous || s.revision > previous.revision) this.records.set(s.id, s); }
        catch { this.warnings.push(`${name} 第${i+1}行无法读取，原文件已保留`); }
      }
      // A power-loss partial tail must not swallow the next valid append.
      if (raw && !raw.endsWith('\n')) fs.appendFileSync(file, '\n');
    }
    const checkpoint = path.join(directory, 'checkpoints.json');
    if (fs.existsSync(checkpoint)) {
      try {
        for (const item of JSON.parse(fs.readFileSync(checkpoint, 'utf8'))) {
          const s = validateListen(item), previous = this.records.get(s.id);
          if (previous && previous.revision >= s.revision && previous.closed) continue;
          const recovered = { ...s, revision: s.revision + 1, closed: true };
          if (actualSeconds(recovered) > 0) this.append(recovered);
          this.records.set(s.id, recovered);
        }
        this.atomic('checkpoints.json', []);
      } catch { this.warnings.push('检查点文件损坏，已保留；最近未结算记录可能缺失'); }
    }
  }
  private atomic(name: string, data: unknown) {
    const file = path.join(this.directory, name), tmp = file + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  }
  private append(s: Listen) {
    const month = new Date(s.startedAt).toISOString().slice(0,7);
    const fd = fs.openSync(path.join(this.directory, `${month}.jsonl`), 'a');
    try { fs.writeSync(fd, JSON.stringify(s) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  private checkpoint() { this.atomic('checkpoints.json', [...this.active].map(id => this.records.get(id))); }
  put(value: unknown) {
    const s = validateListen(value), previous = this.records.get(s.id);
    if (previous && (s.revision <= previous.revision || previous.closed)) return { accepted: false, revision: this.revision };
    if (s.closed) {
      if (actualSeconds(s) > 0) this.append(s);
      this.records.set(s.id, s); this.active.delete(s.id);
    } else { this.records.set(s.id, s); this.active.add(s.id); }
    try { this.checkpoint(); }
    catch(error) {
      // A failed checkpoint must remain retryable at the same revision.
      if(previous)this.records.set(s.id,previous);else this.records.delete(s.id);
      if(previous&&!previous.closed)this.active.add(s.id);else this.active.delete(s.id);
      throw error;
    }
    this.revision++;
    return { accepted: true, revision: this.revision };
  }
  all() { return [...this.records.values()].filter(s => actualSeconds(s) > 0); }
  settings(patch?: Partial<ArchiveSettings>): ArchiveSettings {
    let settings = { lowPerformance: false };
    try { const s = JSON.parse(fs.readFileSync(path.join(this.directory, 'settings.json'), 'utf8')); settings.lowPerformance = s.lowPerformance === true; } catch {}
    if (patch && typeof patch.lowPerformance === 'boolean') { settings.lowPerformance = patch.lowPerformance; this.atomic('settings.json', settings); }
    return settings;
  }
  backup() { return { format: 'folia-listening-archive', version: 1, exportedAt: new Date().toISOString(), records: this.all() }; }
  import(text: string) {
    if (Buffer.byteLength(text) > 50 * 1024 * 1024) throw new Error('备份超过50 MiB，请分批导入');
    const data = JSON.parse(text);
    if (data?.format !== 'folia-listening-archive' || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 100_000) throw new Error('不是支持的听歌档案备份');
    const items: Listen[] = data.records.map(validateListen);
    // Validate the entire backup before writing anything. Import is additive and idempotent.
    const additions = new Map<string, Listen>();
    for (const s of items) if (!this.records.has(s.id)) { const old = additions.get(s.id); if (!old || old.revision < s.revision) additions.set(s.id, { ...s, closed: true }); }
    let added = 0;
    for (const s of additions.values()) { if (actualSeconds(s) <= 0) continue; this.append(s); this.records.set(s.id, s); added++; }
    if (added) this.revision++;
    return { added, total: this.all().length };
  }
}
