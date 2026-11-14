# SeaGuardian

**A compact, remotely supervised surface-vessel prototype for preliminary harbour observations.**

Campor Hackathon · Saab × Marine Technology Center · Prompt-to-Product · 13–15 November 2026

After storms or incidents, harbour operators need information to decide where further inspection is necessary. SeaGuardian explores how water-level camera observations, object detection and sensor telemetry can support that initial assessment. It does not assess structural damage or replace specialist inspections.

## Start here

- [Current architecture and controls](docs/architecture.md)
- [Evidence and verification status](tests/test-results.md)
- [AI-assisted engineering: mistakes, corrections and tests](docs/ai-process.md)
- [Problem evidence and remaining validation](docs/research.md)
- [Demo and jury Q&A](presentation/demo-script.md)
- [Unresolved electronics reconciliation](docs/integration-status.md)

## Download the product film

- [MP4 video, 1080p (about 100 seconds, about 60 MB)](https://github.com/Valencia1400/seasafe-hackathon/raw/refs/heads/main/presentation/film/seaguardian-film.mp4?download=1) — the film with its narration and sound mix.
- [MP3 voiceover](https://github.com/Valencia1400/seasafe-hackathon/raw/refs/heads/main/presentation/film/audio/narration.mp3?download=1) — narration only.

Both files can be opened or downloaded directly from GitHub. The MP4 plays without running the local film server.

## What we built

The team reports a 3D-printed twin-hull prototype with two rear propellers and a rear rudder. The intended propellers are submerged and provide horizontal thrust. The repository includes control and camera firmware, a laptop vision viewer, an operator dashboard, software tests and an approximate photo-based Three.js visualization.

| Component | Role | Evidence/status |
|---|---|---|
| Control ESP32 DevKit | MPU6050, NEO-6M, L298N twin-motor outputs, SG90 rudder, watchdog and emergency-stop logic | Source and host tests; hardware reports require reconciliation |
| XIAO ESP32S3 Sense | Camera video over Wi-Fi | Earlier real-camera tests documented; newest UDP firmware change not yet board-tested |
| Laptop vision viewer | YOLO/YOLOE detection and annotated video | Controlled-image and camera tests reported; no harbour-damage accuracy validation |
| Operator dashboard | WebSocket commands, telemetry, camera integration, event log | 40 current software tests passed in the review environment; stand-ins are not hardware proof |
| Physical vessel | Twin hulls, central enclosure, two propellers and rear rudder | Team-reported printed assembly; CAD source/exports not yet supplied in `cad/` |
| Interactive 3D model | Approximate reconstruction from prototype photos | Visualization, not dimensionally verified CAD or proof of operation |

No water trial, autonomous navigation, proven inspection savings or certified safety performance is established by the evidence in this repository. Missing hardware is shown as disconnected; the current dashboard does not simulate a mission.

## Run the software

Python 3.9+ for the vision viewer. Install its dependencies as described in [vision/README.md](vision/README.md).

```bash
# Terminal 1: camera viewer (use the actual camera address)
cd vision
python viewer.py --source http://<camera-ip>:81/stream

# Terminal 2: operator dashboard, from the repository root
cd dashboard
python run_operator.py --camera-viewer http://127.0.0.1:8001
```

Open `http://127.0.0.1:8000`. The control ESP32 connects to `ws://<laptop-LAN-IP>:8000/ws`. See [dashboard setup](dashboard/README.md) and [firmware setup](electronics/firmware/seaguardian_revC/README.md).

The prototype LAN interface has no operator login. Use a trusted network; do not expose vessel controls to the public internet.

For the 3D visualization: `python -m http.server 8765 --directory prototype`, then open `http://127.0.0.1:8765`.

## Team responsibilities

Three active roles cover the work: mechanical/CAD; electrical/embedded (Heritage); software/product/integration (Angelo). Git history records individual code contributions, including Armin's camera and integration work; role summaries do not replace authorship records.

## Repository

| Folder | Contents |
|---|---|
| `dashboard/` | Operator interface, WebSocket server, tests |
| `vision/` | Camera viewer, object detection, parser tests and test targets |
| `electronics/firmware/` | Current control and camera firmware |
| `electronics/legacy/` | Clearly labelled earlier control firmware |
| `prototype/` | Photo-based interactive visualization |
| `cad/` | Mechanical status and outstanding design evidence |
| `tests/` | Current test plan and evidence overview |
| `docs/` | Architecture, requirements, decisions, research and AI evidence |
| `presentation/` | Pitch, jury materials and the downloadable product film |

[Development workflow](docs/workflow.md) · [Risks](docs/risks.md) · [Decision history](docs/decisions.md)
