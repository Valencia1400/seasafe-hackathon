// Minimal MP4 (ISO BMFF) muxer for one H.264 video track + one AAC audio track, "fast start" (moov before mdat).
// Input: encoded samples from WebCodecs (VideoEncoder avc format, AudioEncoder aac format). No B-frames (decode order = display order).

const enc = new TextEncoder();
function cat(parts) { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
const u8 = (...a) => new Uint8Array(a);
const u16 = (v) => u8(v >> 8 & 255, v & 255);
const u32 = (v) => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
const str = (s) => enc.encode(s);
const box = (type, ...payload) => { const body = cat(payload); return cat([u32(body.length + 8), str(type), body]); };
const full = (type, version, flags, ...payload) => box(type, u8(version, flags >> 16 & 255, flags >> 8 & 255, flags & 255), ...payload);
const MATRIX = cat([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]);

function descr(tag, payload) {           // MPEG-4 descriptor with 4-byte expandable length
  const n = payload.length; return cat([u8(tag, 0x80 | (n >> 21 & 127), 0x80 | (n >> 14 & 127), 0x80 | (n >> 7 & 127), n & 127), payload]);
}

function stbl(track, chunkOffsets) {
  const { samples, chunks } = track;
  // stts: run-length of durations
  const runs = []; for (const s of samples) { const l = runs[runs.length - 1]; if (l && l[1] === s.duration) l[0]++; else runs.push([1, s.duration]); }
  const stts = full('stts', 0, 0, u32(runs.length), ...runs.map(([c, d]) => cat([u32(c), u32(d)])));
  // stsc: run-length of samples per chunk
  const sc = []; chunks.forEach((n, i) => { if (!sc.length || sc[sc.length - 1][1] !== n) sc.push([i + 1, n]); });
  const stsc = full('stsc', 0, 0, u32(sc.length), ...sc.map(([first, n]) => cat([u32(first), u32(n), u32(1)])));
  const stsz = full('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map((s) => u32(s.data.length)));
  const stco = full('stco', 0, 0, u32(chunkOffsets.length), ...chunkOffsets.map(u32));
  const parts = [track.stsd, stts];
  if (track.kind === 'video') { const keys = []; samples.forEach((s, i) => { if (s.key) keys.push(i + 1); }); parts.push(full('stss', 0, 0, u32(keys.length), ...keys.map(u32))); }
  parts.push(stsc, stsz, stco);
  return box('stbl', ...parts);
}

function trak(track, id, movieTimescale, chunkOffsets) {
  const dur = track.samples.reduce((a, s) => a + s.duration, 0), movieDur = Math.round(dur / track.timescale * movieTimescale);
  const isV = track.kind === 'video';
  const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(movieDur), u32(0), u32(0), u16(0), u16(0), u16(isV ? 0 : 0x0100), u16(0), MATRIX,
    u32((isV ? track.width : 0) << 16), u32((isV ? track.height : 0) << 16));
  const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(track.timescale), u32(dur), u16(0x55c4), u16(0));
  const hdlr = full('hdlr', 0, 0, u32(0), str(isV ? 'vide' : 'soun'), u32(0), u32(0), u32(0), str(isV ? 'VideoHandler' : 'SoundHandler'), u8(0));
  const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
  const mhd = isV ? full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)) : full('smhd', 0, 0, u16(0), u16(0));
  return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', mhd, dinf, stbl(track, chunkOffsets))));
}

/**
 * video: { width, height, fps, avcC: Uint8Array, colr?: {primaries, transfer, matrix, fullRange}, samples: [{data: Uint8Array, key: bool}] }
 * audio: { sampleRate, channels, asc: Uint8Array, bitrate, samples: [{data: Uint8Array}] }   (each AAC sample = 1024 PCM frames)
 */
export function muxMp4(video, audio) {
  const VT = video.fps * 1000;                                        // video timescale, 1000 ticks per frame
  const colr = video.colr ? box('colr', str('nclx'), u16(video.colr.primaries), u16(video.colr.transfer), u16(video.colr.matrix), u8(video.colr.fullRange ? 0x80 : 0)) : new Uint8Array(0);
  const avc1 = box('avc1', u32(0), u16(0), u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(video.width), u16(video.height), u32(0x480000), u32(0x480000), u32(0), u16(1),
    new Uint8Array(32), u16(0x18), u16(0xffff), box('avcC', video.avcC), colr, box('pasp', u32(1), u32(1)));
  const vTrack = { kind: 'video', timescale: VT, width: video.width, height: video.height, stsd: full('stsd', 0, 0, u32(1), avc1),
    samples: video.samples.map((s) => ({ data: s.data, key: s.key, duration: 1000 })), chunks: [] };

  const esds = full('esds', 0, 0, descr(0x03, cat([u16(1), u8(0),
    descr(0x04, cat([u8(0x40, 0x15), u8(0, 0, 0), u32(audio.bitrate), u32(audio.bitrate), descr(0x05, audio.asc)])), descr(0x06, u8(2))])));
  const mp4a = box('mp4a', u32(0), u16(0), u16(1), u32(0), u32(0), u16(audio.channels), u16(16), u16(0), u16(0), u32(audio.sampleRate << 16 >>> 0), esds);
  const aTrack = { kind: 'audio', timescale: audio.sampleRate, stsd: full('stsd', 0, 0, u32(1), mp4a),
    samples: audio.samples.map((s) => ({ data: s.data, duration: 1024 })), chunks: [] };

  // interleave in ~1 s chunks: [video second k][audio second k] …
  const order = []; let vi = 0, ai = 0, sec = 0;
  while (vi < vTrack.samples.length || ai < aTrack.samples.length) {
    sec++;
    const vEnd = Math.min(vTrack.samples.length, sec * video.fps); if (vEnd > vi) { order.push([vTrack, vi, vEnd]); vTrack.chunks.push(vEnd - vi); vi = vEnd; }
    const aEnd = Math.min(aTrack.samples.length, Math.ceil(sec * audio.sampleRate / 1024)); if (aEnd > ai) { order.push([aTrack, ai, aEnd]); aTrack.chunks.push(aEnd - ai); ai = aEnd; }
  }
  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  const MT = 1000, vDur = vTrack.samples.length * 1000 / VT, aDur = aTrack.samples.length * 1024 / audio.sampleRate;
  const build = (base) => {
    const offs = new Map([[vTrack, []], [aTrack, []]]); let o = base;
    for (const [t, a, b] of order) { offs.get(t).push(o); for (let i = a; i < b; i++) o += t.samples[i].data.length; }
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(MT), u32(Math.round(Math.max(vDur, aDur) * MT)), u32(0x10000), u16(0x100), u16(0), u32(0), u32(0), MATRIX, new Uint8Array(24), u32(3));
    return box('moov', mvhd, trak(vTrack, 1, MT, offs.get(vTrack)), trak(aTrack, 2, MT, offs.get(aTrack)));
  };
  const moovLen = build(0).length, moov = build(ftyp.length + moovLen + 8);
  let mdatLen = 8; for (const t of [vTrack, aTrack]) for (const s of t.samples) mdatLen += s.data.length;
  if (mdatLen > 0xffffffff) throw new Error('mdat too large for 32-bit box');
  const parts = [ftyp, moov, u32(mdatLen), str('mdat')];
  for (const [t, a, b] of order) for (let i = a; i < b; i++) parts.push(t.samples[i].data);
  return new Blob(parts, { type: 'video/mp4' });
}
