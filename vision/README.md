# Vision: boat camera + object detection

The boat camera (XIAO ESP32S3 Sense, firmware in [`electronics/firmware/seasafe_cam/`](../electronics/firmware/seasafe_cam/))
streams video over Wi-Fi. `viewer.py` pulls that stream on a laptop, runs YOLO on it and serves
the annotated video and detections on `http://127.0.0.1:8001`. **Dashboard team: read [INTEGRATION.md](INTEGRATION.md).**

## 1. Flash the camera (once)

1. Copy `electronics/firmware/seasafe_cam/secrets.example.h` to `secrets.h` in the same folder and fill in a
   **2.4 GHz** Wi-Fi (a phone hotspot is fine). `secrets.h` is git-ignored. Skip this and the board makes its own
   Wi-Fi "SeaSafe-Cam" (password `seasafe123`, camera at `http://192.168.4.1`).
2. Arduino IDE: board **XIAO_ESP32S3**, Tools > PSRAM: **OPI PSRAM**, open `seasafe_cam.ino`, Upload.
   Or from a terminal:
   ```bash
   arduino-cli compile --upload -p /dev/cu.usbmodemXXXX --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi electronics/firmware/seasafe_cam
   ```
3. Serial Monitor (115200) prints the camera address every 5 s. Open `http://<that address>/` on a phone to see
   the live picture.

## 2. Run the detector

Python 3.9+. Once, from this folder (downloads PyTorch, a few hundred MB):
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```
Then:
```bash
.venv/bin/python viewer.py                                        # camera at seasafe-cam.local
.venv/bin/python viewer.py --source http://192.168.4.1:81/stream  # camera in its own-network mode
.venv/bin/python viewer.py --source 0                             # laptop webcam, no boat needed
```
Open http://127.0.0.1:8001/. The first run downloads the YOLO weights (`yolo11n.pt`, 5 MB), so do it once with
internet before the demo. On a slow laptop add `--imgsz 320` for about 4x the speed.

Tests (no camera or model needed): `.venv/bin/python -m unittest test_viewer -v`

## Files

| File | What it is |
|---|---|
| `viewer.py` | Stream reader, YOLO detection, small web server for the dashboard |
| `test_viewer.py` | Unit tests for the MJPEG stream parser |
| `INTEGRATION.md` | Endpoints and JSON format for the dashboard |
| `requirements.txt` | `ultralytics` (brings OpenCV, NumPy and PyTorch) |
