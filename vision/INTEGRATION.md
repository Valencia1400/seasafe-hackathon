# Camera + detection: how to plug it into the dashboard

Firmware: [`electronics/firmware/seasafe_cam/`](../electronics/firmware/seasafe_cam/seasafe_cam.ino) (Seeed XIAO ESP32S3 Sense).
Detector: [`vision/viewer.py`](viewer.py) (Python, Ultralytics YOLO). How to run it: [README.md](README.md).

```
 Boat: XIAO ESP32S3 Sense             Laptop
   :81/stream  MJPEG video  ───────>  vision/viewer.py (YOLO)
                                        :8001/detections   JSON   ───>  dashboard
                                        :8001/stream.mjpg  video  ───>  dashboard
   :80/status  JSON  ─────────────────────────────────────────────────>  dashboard (optional)
```

**Rule: only `viewer.py` reads the ESP32 video.** The ESP32 serves its stream to **one client at a time**; a
second viewer waits until the first disconnects. The dashboard shows the viewer's annotated stream instead.
The ESP32 `/status` endpoint is a separate server and can be polled by anyone.

## 1. Finding the camera

| Wi-Fi mode | When | Camera address |
|---|---|---|
| Station (`STA`) | `secrets.h` has a reachable 2.4 GHz network | `http://seasafe-cam.local` (mDNS: macOS, iOS, Linux with avahi), or the IP the board prints on the Serial Monitor every 5 s, or the hotspot's client list |
| Access point (`AP`) | no `secrets.h`, or the network was not found within 15 s | join Wi-Fi **SeaSafe-Cam** (password `seasafe123`), camera at `http://192.168.4.1`. Your laptop has no internet while joined |

## 2. ESP32 endpoints

| URL | Returns |
|---|---|
| `http://<cam>/` | Test page: live video + status. Open it on a phone to check the camera |
| `http://<cam>/status` | JSON status, see below. CORS open, fine to poll at 1 Hz |
| `http://<cam>/capture` | One JPEG |
| `http://<cam>:81/stream` | MJPEG, `multipart/x-mixed-replace; boundary=seasafeframe`. Each part has `Content-Type: image/jpeg`, `Content-Length` and `X-Timestamp` (ESP32 uptime in ms) |

`/status` example:
```json
{"t":"cam","id":"seasafe-cam","ms":605123,"ip":"192.168.1.50","mode":"STA","rssi":-58,
 "sensor":"OV2640","w":640,"h":480,"quality":12,"streaming":true,"fps":14.2,
 "frames":8123,"heap":201344,"psram":7812345}
```

| Field | Meaning |
|---|---|
| `ms` | ESP32 uptime in ms |
| `mode` | `STA` (joined a network) or `AP` (own network "SeaSafe-Cam") |
| `rssi` | Wi-Fi signal in dBm (0 in AP mode). Below about -75 the stream stutters |
| `sensor` | `OV2640` or `OV3660` (both ship on the Sense board) |
| `w`, `h`, `quality` | Frame size and JPEG quality (0-63, lower = better) |
| `streaming`, `fps` | Whether a client is on `/stream`, and the rate it is getting |
| `frames` | Frames sent since boot |
| `heap`, `psram` | Free memory in bytes (for debugging) |

## 3. Viewer endpoints (what the dashboard uses)

Default `http://127.0.0.1:8001`. Start the viewer with `--host 0.0.0.0` so other machines on the network can
reach it, e.g. the viewer and the dashboard on two different laptops. All responses have
`Access-Control-Allow-Origin: *`, so a dashboard page on another port can fetch them directly.

| URL | Returns | How to use it |
|---|---|---|
| `/detections` | Latest detection message (JSON, below) | Poll at 2-5 Hz |
| `/stream.mjpg` | Annotated video (boxes and labels drawn in), MJPEG | `<img src="http://127.0.0.1:8001/stream.mjpg">` |
| `/frame.jpg` | Latest annotated frame (503 until the first frame) | For a snapshot or an evidence photo |
| `/` | Test page: video + live JSON | For checking without the dashboard |

## 4. Detection message (`/detections`)

```json
{"t":"det","seq":812,"ts":1763037000.123,"src":"esp32","model":"yolo11n.pt","cam":"OK",
 "w":640,"h":480,"fps":9.8,"infer_ms":38.2,
 "dets":[{"cls":"boat","conf":0.82,"box":[120,200,260,300]},
         {"cls":"person","conf":0.57,"box":[400,180,430,260]}]}
```

| Field | Meaning |
|---|---|
| `t` | Always `"det"` (same style as the ESP32 telemetry in [architecture.md](../docs/architecture.md)) |
| `seq` | Frame counter. Unchanged = no new frame was processed |
| `ts` | Unix time (s) when the frame arrived on the viewer machine |
| `src` | `esp32` = the boat camera. `webcam` or `file` = **test input: label it TEST/SIMULATED on screen** (project rule: never show test data as real) |
| `cam` | `OK`, or `DOWN` = no frame for 2 s (show a banner; `dets` is then empty and `w`, `h`, `fps`, `infer_ms` are missing) |
| `w`, `h` | Frame size in pixels |
| `fps` | Detections per second actually achieved |
| `infer_ms` | Time YOLO took for this frame |
| `dets[].cls` | One of `person`, `boat`, `bird`, `surfboard`, `bottle` (see below) |
| `dets[].conf` | Confidence 0-1 (only >= 0.35 is sent; change with `--conf`) |
| `dets[].box` | `[x1, y1, x2, y2]` in pixels of the `w` x `h` frame, origin top-left. To draw over a displayed image, multiply by `img.clientWidth / w` |

### Classes and what they mean on the water

| `cls` | Shown as | Notes |
|---|---|---|
| `person` | Person in water / swimmer | Highest priority alert |
| `boat` | Vessel | Also catches most kayaks and canoes |
| `bird` | Bird | Mostly useful to explain false alarms |
| `surfboard` | Board / paddleboard | |
| `bottle` | Floating debris (bottle) | Stand-in for plastic waste; COCO has no debris class |

Buoys, general debris and docks are **not** detected yet; that needs a fine-tuned model (FloW, SeaDronesSee,
LaRS datasets). A fine-tuned model is a drop-in `--model my_model.pt`; add its new class names to
`WATER_CLASSES` in `viewer.py` so they are not filtered out.

## 5. Minimal dashboard code

Browser (any page, any port):
```html
<div style="position:relative;display:inline-block">
  <img id="cam" src="http://127.0.0.1:8001/stream.mjpg" width="640">
</div>
<div id="alerts"></div>
<script>
setInterval(async () => {
  const d = await (await fetch("http://127.0.0.1:8001/detections")).json();
  const test = d.src !== "esp32" ? " [TEST INPUT]" : "";
  alerts.textContent = d.cam === "DOWN" ? "CAMERA DOWN" + test
    : (d.dets.map(x => `${x.cls} ${Math.round(x.conf * 100)}%`).join(", ") || "clear") + test;
}, 300);
</script>
```

Python (e.g. inside `dashboard/seaguardian/`, standard library only):
```python
import json, urllib.request
d = json.load(urllib.request.urlopen("http://127.0.0.1:8001/detections", timeout=1))
people = [x for x in d["dets"] if x["cls"] == "person"]
```

## 6. Measured numbers

Fill in after each real test (board, distance, network). Until then these are unknown, not targets.

| Date | Setup | ESP32 fps | Viewer fps | infer_ms | Notes |
|---|---|---|---|---|---|
| | | | | | |
