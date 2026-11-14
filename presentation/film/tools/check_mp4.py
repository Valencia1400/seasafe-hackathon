"""Prints the structure of an MP4 written by the film exporter (no external tools needed).

    python presentation/film/tools/check_mp4.py presentation/film/out/seaguardian-film.mp4
"""
import struct
import sys

CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"dinf"}


def walk(f, start, end, depth, info):
    pos = start
    while pos + 8 <= end:
        f.seek(pos)
        size, typ = struct.unpack(">I4s", f.read(8))
        if size < 8:
            break
        body = pos + 8
        if depth <= 1 or typ in CONTAINERS:
            print("  " * depth + f"{typ.decode('latin1')}  {size} bytes")
        if typ == b"mvhd":
            f.seek(body + 12)
            ts, dur = struct.unpack(">II", f.read(8))
            info["movie_seconds"] = dur / ts
        elif typ == b"tkhd":
            f.seek(body + 76)
            w, h = struct.unpack(">II", f.read(8))
            info.setdefault("tracks", []).append({"width": w >> 16, "height": h >> 16})
        elif typ == b"mdhd":
            f.seek(body + 12)
            ts, dur = struct.unpack(">II", f.read(8))
            info["tracks"][-1].update(timescale=ts, seconds=dur / ts)
        elif typ == b"hdlr":
            f.seek(body + 8)
            info["tracks"][-1]["handler"] = f.read(4).decode()
        elif typ == b"stsd":
            f.seek(body + 12)
            info["tracks"][-1]["codec"] = f.read(4).decode("latin1")
            if info["tracks"][-1]["codec"] == "avc1":
                f.seek(body + 8 + 8 + 78 + 8)          # into avcC payload
                cfg = f.read(4)
                info["tracks"][-1]["h264_profile"] = cfg[1]
                info["tracks"][-1]["h264_level"] = cfg[3] / 10
            elif info["tracks"][-1]["codec"] == "mp4a":
                f.seek(body + 8 + 8 + 16)
                ch = struct.unpack(">H", f.read(2))[0]
                f.seek(body + 8 + 8 + 24)
                sr = struct.unpack(">I", f.read(4))[0] >> 16
                info["tracks"][-1].update(channels=ch, sample_rate=sr)
        elif typ == b"stsz":
            f.seek(body + 8)
            info["tracks"][-1]["samples"] = struct.unpack(">I", f.read(4))[0]
        elif typ == b"stss":
            f.seek(body + 4)
            info["tracks"][-1]["keyframes"] = struct.unpack(">I", f.read(4))[0]
        elif typ == b"stco":
            f.seek(body + 4)
            n = struct.unpack(">I", f.read(4))[0]
            first = struct.unpack(">I", f.read(4))[0]
            info["tracks"][-1].update(chunks=n, first_chunk_offset=first)
        if typ in CONTAINERS:
            walk(f, body, pos + size, depth + 1, info)
        pos += size


if __name__ == "__main__":
    path = sys.argv[1]
    with open(path, "rb") as fh:
        fh.seek(0, 2)
        total = fh.tell()
        info = {}
        walk(fh, 0, total, 0, info)
    print(f"\nfile: {total / 1e6:.1f} MB, movie {info.get('movie_seconds', 0):.2f} s")
    for t in info.get("tracks", []):
        if t.get("handler") == "vide":
            fps = t["samples"] / t["seconds"]
            print(f"video: {t['codec']} profile {t.get('h264_profile')} level {t.get('h264_level')}, {t['width']}x{t['height']}, {t['samples']} frames, {fps:.3f} fps, "
                  f"{t['seconds']:.2f} s, {t.get('keyframes')} keyframes, {t['chunks']} chunks")
        else:
            print(f"audio: {t['codec']}, {t.get('channels')} ch, {t.get('sample_rate')} Hz, {t['samples']} AAC frames, {t['seconds']:.2f} s, {t['chunks']} chunks")
