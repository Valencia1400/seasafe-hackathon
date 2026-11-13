# Vision: boat camera + object detection

The boat camera (XIAO ESP32S3 Sense, firmware in [`electronics/firmware/seasafe_cam/`](../electronics/firmware/seasafe_cam/))
streams video over Wi-Fi. `viewer.py` pulls that stream on a laptop, runs YOLO on it and serves
the annotated video and detections on `http://127.0.0.1:8001`. **Dashboard team: read [INTEGRATION.md](INTEGRATION.md).**

## 1. Flash the camera (once)

1. Wi-Fi: the firmware joins the team hotspot **`Armin – iPhone`** (password `password`) by default. Turn on
   *Maximize Compatibility* on the iPhone (2.4 GHz only) and keep the Personal Hotspot screen open while the
   board joins: iOS hides the hotspot from new devices once that screen is closed. The board retries every 15 s. Note the iPhone names it with a long dash (–), not `-`.
   Another network: copy `secrets.example.h` to `secrets.h` (git-ignored) and fill it in. If the network is not
   found within 15 s, the board prints the networks it can see and makes its own Wi-Fi "SeaSafe-Cam"
   (password `seasafe123`, camera at `http://192.168.4.1`).
2. Arduino IDE: board **XIAO_ESP32S3**, Tools > PSRAM: **OPI PSRAM**, open `seasafe_cam.ino`, Upload.
   Or from a terminal:
   ```bash
   arduino-cli compile --upload -p /dev/cu.usbmodemXXXX --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi electronics/firmware/seasafe_cam
   ```
3. Serial Monitor (115200) prints the camera address every 5 s (on the iPhone hotspot it was `172.20.10.2`).
   Close the Serial Monitor before uploading again: it blocks the port. Open `http://<that address>/` on a phone to see
   the live picture.

## 2. Run the detector

Python 3.9+. Once, from this folder (downloads PyTorch, a few hundred MB):
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```
Then:
```bash
.venv/bin/python viewer.py --source http://172.20.10.2:81/stream  # iPhone hotspot: use the IP from the Serial Monitor
.venv/bin/python viewer.py                                        # normal router: camera found as seasafe-cam.local
.venv/bin/python viewer.py --source http://192.168.4.1:81/stream  # camera in its own-network mode
.venv/bin/python viewer.py --source 0                             # laptop webcam, no boat needed
```
Open http://127.0.0.1:8001/. The first run downloads the YOLOE weights (`yoloe-26s-seg.pt`) and installs its text encoder (CLIP), so do it once with
internet before the demo. On a slow laptop add `--imgsz 320` for about 4x the speed.

**Printable test targets:** `demo-targets.pdf` (11 A4 pages: boat, ship, person, bottle). Every photo was checked with
the default model first; all are public domain or CC0 from Wikimedia Commons (credit on each page). Print in colour,
hold the page 30-60 cm from the camera, and avoid glare.

Tests (no camera or model needed): `.venv/bin/python -m unittest test_viewer -v`

## Files

| File | What it is |
|---|---|
| `viewer.py` | Stream reader, YOLO detection, small web server for the dashboard |
| `test_viewer.py` | Unit tests for the MJPEG stream parser |
| `INTEGRATION.md` | Endpoints and JSON format for the dashboard |
| `requirements.txt` | `ultralytics` (brings OpenCV, NumPy and PyTorch) |
