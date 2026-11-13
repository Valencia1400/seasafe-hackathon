"""SeaSafe vision: pull the boat camera's MJPEG stream, run YOLO on it, serve the results on localhost.

  python viewer.py                                   # boat camera at http://seasafe-cam.local:81/stream
  python viewer.py --source http://192.168.4.1:81/stream
  python viewer.py --source 0                        # laptop webcam, no boat needed (src = "webcam")
  python viewer.py --source clip.mp4                 # recorded video, loops (src = "file")

Then open http://127.0.0.1:8001/ . Endpoints and JSON format for the dashboard: INTEGRATION.md
"""
import argparse
import json
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np

# Default model is YOLOE: it detects whatever these words describe, with no training (open vocabulary).
# Tested on 64 public-domain photos (13 Nov): boat 4/5, ship 9/10, person 10/10, bottle 8/9 found, but
# buoy 0/10, kayak 0/4, floating debris 0/6, life jacket 1/10, and "kayak" fired on a dog's life jacket.
# shortcut: those four need a model fine-tuned on FloW / SeaDronesSee; until then they stay out of the default.
WATER_PROMPTS = "boat,ship,person,bottle,bird"
# With a plain COCO model (--model yolo26n.pt) only these classes are kept (bottle = floating plastic stand-in).
WATER_CLASSES = {"person", "boat", "bird", "surfboard", "bottle"}
STALE_S = 2.0  # no camera frame for this long -> cam "DOWN"


class Hub:
    """Holds only the newest value; readers wait for the next one, so nobody works on a stale queue."""

    def __init__(self, value=None):
        self.cond = threading.Condition()
        self.seq, self.value, self.t = 0, value, 0.0

    def put(self, value):
        with self.cond:
            self.seq, self.value, self.t = self.seq + 1, value, time.time()
            self.cond.notify_all()

    def next(self, seq, timeout):
        """Wait (up to timeout) for a value newer than seq; return (seq, value, time it was put)."""
        with self.cond:
            self.cond.wait_for(lambda: self.seq != seq, timeout)
            return self.seq, self.value, self.t


def mjpeg_frames(stream):
    """Yield the JPEG bytes of each part of a multipart/x-mixed-replace stream (needs Content-Length)."""
    while line := stream.readline():
        if line.lower().startswith(b"content-length:"):
            n = int(line.split(b":", 1)[1])
            while stream.readline().strip():  # skip the remaining part headers up to the blank line
                pass
            jpg = stream.read(n)
            if len(jpg) < n:
                return  # stream cut mid-frame
            yield jpg


def read_camera(source, cam):
    """Feed frames from the source into cam forever; reconnect every 2 s when it drops."""
    while True:
        try:
            if source.startswith("http"):
                with urllib.request.urlopen(source, timeout=5) as resp:
                    for jpg in mjpeg_frames(resp):
                        frame = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
                        if frame is not None:
                            cam.put(frame)
            else:
                cap = cv2.VideoCapture(int(source) if source.isdigit() else source)
                delay = 0 if source.isdigit() else 1 / (cap.get(cv2.CAP_PROP_FPS) or 25)  # play files at real speed
                while (got := cap.read())[0]:
                    cam.put(got[1])
                    time.sleep(delay)
                cap.release()
        except Exception as exc:  # noqa: BLE001 - a dead camera must not kill the viewer
            print(f"camera: {exc}", flush=True)
        time.sleep(2)


PAGE = b"""<!doctype html><meta name=viewport content="width=device-width"><title>SeaSafe vision</title>
<body style="margin:0;background:#111;color:#ddd;font:13px ui-monospace,monospace">
<img src="/stream.mjpg" style="width:100%;max-width:960px;display:block" alt="annotated camera stream">
<pre id=d></pre>
<script>setInterval(async()=>{try{d.textContent=JSON.stringify(await(await fetch('/detections')).json(),null,1)}catch(e){d.textContent=e}},500)</script>"""


def make_handler(out, flip):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _head(self, code, ctype, length=None):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            if length is not None:
                self.send_header("Content-Length", str(length))
            self.end_headers()

        def _send(self, code, ctype, body):
            self._head(code, ctype, len(body))
            self.wfile.write(body)

        def do_POST(self):
            if self.path.split("?")[0] == "/flip":   # toggle 180-degree rotation (camera mounted upside down)
                flip["on"] = not flip["on"]
                self._send(200, "application/json", json.dumps({"flip": flip["on"]}).encode())
            else:
                self._send(404, "text/plain", b"not found")

        def do_GET(self):
            path = self.path.split("?")[0]
            jpg, msg = out.value
            if path == "/":
                self._send(200, "text/html; charset=utf-8", PAGE)
            elif path == "/detections":
                self._send(200, "application/json", json.dumps(msg).encode())
            elif path == "/frame.jpg":
                if jpg is None:
                    self._send(503, "text/plain", b"no camera frame yet")
                else:
                    self._send(200, "image/jpeg", jpg)
            elif path == "/stream.mjpg":
                self._head(200, "multipart/x-mixed-replace; boundary=frame")
                seq = 0
                try:
                    while True:
                        seq, (jpg, _), _ = out.next(seq, 5)
                        if jpg is not None:
                            self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n%s\r\n"
                                             % (len(jpg), jpg))
                except (BrokenPipeError, ConnectionResetError):
                    pass  # browser tab closed
            else:
                self._send(404, "text/plain", b"not found")

    return Handler


def main():
    ap = argparse.ArgumentParser(description="SeaSafe camera viewer + object detection")
    ap.add_argument("--source", default="http://seasafe-cam.local:81/stream",
                    help="ESP32 stream URL, webcam index (0) or video file")
    ap.add_argument("--model", default="yoloe-26s-seg.pt",
                    help="yoloe-* = detect the --prompts words; any other YOLO (e.g. yolo26n.pt) = COCO classes")
    ap.add_argument("--prompts", default=WATER_PROMPTS, help="comma-separated things to look for (YOLOE models only)")
    ap.add_argument("--conf", type=float, default=0.3, help="minimum confidence")
    ap.add_argument("--flip", action="store_true", help="rotate the image 180 degrees (camera mounted upside down)")
    ap.add_argument("--imgsz", type=int, default=640, help="inference size; 320 is ~4x faster on a slow computer")
    ap.add_argument("--host", default="127.0.0.1", help="0.0.0.0 to serve other machines on the network")
    ap.add_argument("--port", type=int, default=8001)
    args = ap.parse_args()

    src = "esp32" if args.source.startswith("http") else "webcam" if args.source.isdigit() else "file"
    cam = Hub()
    out = Hub((None, {"t": "det", "seq": 0, "src": src, "cam": "DOWN", "dets": []}))
    threading.Thread(target=read_camera, args=(args.source, cam), daemon=True).start()
    flip = {"on": args.flip}   # also toggled at runtime by POST /flip
    server = ThreadingHTTPServer((args.host, args.port), make_handler(out, flip))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"Reading {args.source}  ->  open http://{args.host}:{args.port}/")

    from ultralytics import YOLO, YOLOE  # slow import; after the server is up so the page loads meanwhile
    if args.model.startswith("yoloe"):
        model = YOLOE(args.model)
        names = [w.strip() for w in args.prompts.split(",") if w.strip()]
        model.set_classes(names, model.get_text_pe(names))
        wanted = None  # every prompted word is wanted
    else:
        model = YOLO(args.model)
        wanted = [i for i, name in model.names.items() if name in WATER_CLASSES]
    print(f"Looking for: {', '.join(model.names[i] for i in (wanted or model.names))}", flush=True)

    seq, fps, last, last_print = 0, 0.0, time.time(), 0.0
    while True:
        seq, frame, t = cam.next(seq, 1.0)
        msg = {"t": "det", "seq": seq, "ts": round(t, 3), "src": src, "model": args.model, "flip": flip["on"]}
        if frame is None or time.time() - t > STALE_S:
            out.put((None, {**msg, "cam": "DOWN", "dets": []}))
            continue
        if flip["on"]:
            frame = cv2.rotate(frame, cv2.ROTATE_180)   # before YOLO: it detects best on upright images
        t0 = time.perf_counter()
        r = model.predict(frame, imgsz=args.imgsz, conf=args.conf, classes=wanted, verbose=False)[0]
        infer_ms = (time.perf_counter() - t0) * 1000
        now = time.time()
        fps = 1 / (now - last) if fps == 0 else 0.9 * fps + 0.1 / (now - last)
        last = now
        h, w = frame.shape[:2]
        dets = [{"cls": model.names[int(c)], "conf": round(p, 2), "box": [round(v) for v in box]}
                for box, c, p in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist())]
        _, jpg = cv2.imencode(".jpg", r.plot(), [cv2.IMWRITE_JPEG_QUALITY, 80])
        msg.update(cam="OK", w=w, h=h, fps=round(fps, 1), infer_ms=round(infer_ms, 1), dets=dets)
        out.put((jpg.tobytes(), msg))
        if now - last_print > 1:
            last_print = now
            print(f"{fps:4.1f} fps  {infer_ms:5.1f} ms  " + (", ".join(f"{d['cls']} {d['conf']}" for d in dets) or "-"), flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
