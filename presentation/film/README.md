# SeaGuardian – animated product film

Everything is generated in the browser with Three.js and canvas drawing. There is no real-world footage, no screen recording and no
third-party video or music: the only supplied media is the narration (`audio/narration.mp3`, ElevenLabs).
The vessel is the photo-based reconstruction from `boat.js` (Three.js r160 is vendored in `vendor/`).

## The film: `cinematic.html` (1920×1080, 30 fps, about 100 s)

Double-click `start.bat`, or:

    python presentation/film/tools/serve.py
    # then open http://localhost:8770/film/cinematic.html

Keys: Space play/pause, ← → ±1 s, C hide the player bar. `?hq` previews at full resolution (default preview is lighter), `?t=42` jumps to a time,
`?bed=-18` changes how far the music/effects sit under the voice (dB, default -13.5).

### Export a standalone MP4 (reproducible, no screen recording)

1. Start the server (`start.bat` or the command above).
2. Open http://localhost:8770/film/cinematic.html?export (or press **Export MP4** in the player).
3. It renders all frames one by one, encodes H.264 + AAC with the browser's WebCodecs and writes
   **`presentation/film/out/seaguardian-film.mp4`** (about 1.5–3 minutes; needs Chrome or Edge).
4. Check the result: `python presentation/film/tools/check_mp4.py presentation/film/out/seaguardian-film.mp4`
   and http://localhost:8770/film/tools/verify.html (plays the file back and writes `out/verify.jpg`).

`out/` is git-ignored (the MP4 is about 140 MB).

### Timing: the narration is the master clock

`cinematic.js` holds the start and end of each narrated sentence (found by pause detection on the MP3) and every cut, label,
counter and camera move is placed relative to those. The narration is never cut, stretched or re-voiced.
**The supplied narration is 96.9 s long, so the film is 99.9 s** (0.6 s lead-in + narration + a short hold): this is over the 95 s limit in the brief.
If a new narration file is supplied, re-run `tools/analyze.html` (writes `out/chunks.json`) and update the `S` table in `cinematic.js`.

| Film time | Scene | What is shown |
|---|---|---|
| 0–11.4 | Storm Babet | Harbour in the storm, "+126 cm" (Simrishamn, SMHI). Labelled illustrative. |
| 11.4–28.6 | After the storm | Damaged pier, "which structures need inspection?", time / resources / personal risk. |
| 28.6–36.8 | Reveal | The reconstructed prototype: twin hull, two propulsion motors, rear rudder. |
| 36.8–55.3 | Camera and operator | Onboard view → Wi-Fi → laptop, simulated detections, dashboard, live-IMU note. |
| 55.3–62.6 | Modular design | Exploded view with the real part names. |
| 62.6–82.4 | How we built it | Prompt → CAD → electronics → software → testing → improvements; 79/79; parts assemble. |
| 82.4–93.9 | Value and next steps | Not a replacement for professional inspection; planned bench validation and tethered trial. |
| 93.9–99.9 | Hero shot | Calm harbour at dawn, title and tagline. |

### Claims on screen and where they come from

- **+126 cm at Simrishamn, Storm Babet, October 2023** – SMHI. Shown as a past observation, not a prediction or a product result.
- **79/79 PC firmware unit tests passed** – `electronics/firmware/seaguardian_revC/ACTIVITY_LOG.md` ("79 passed, 0 failed"). These are host tests, not hardware tests.
- **Emergency-stop software flaw identified and corrected; hardware validation pending** – firmware README, "Problem found / Fix" no. 3 (race between
  the comm and safety tasks); motors and servo are not yet bench-tested.
- **Live orientation data from a real ESP32 (14 Nov)** – `electronics/README.md` status line.
- **Part names** (ESP32, MPU6050, NEO-6M, L298N, SG90, XIAO ESP32S3 Sense) – electronics README and camera firmware header.
- Storm, harbour, mission and operator scenes are **illustrative**; detections and telemetry are **simulated**; trials are **planned**. Each is labelled on screen.
- No prices, savings, autonomy, crack detection or measured performance are claimed. The camera is not drawn at a specific place on the hull (placement not verified).

### Sound

`cine-audio.js` synthesizes a quiet pad, a soft pulse and maritime effects (wind, rain, thunder, lapping water, transitions) with Web Audio and
mixes them under the untouched narration. Peak is normalised to about −1 dBFS.

## Files

| File | Purpose |
|---|---|
| `cinematic.html`, `cinematic.js` | The film: timeline, scenes, player, MP4 export |
| `cine-draw.js` | Canvas typography, labels, laptop, dashboard |
| `cine-audio.js` | Music bed, effects and final mix |
| `mp4mux.js` | Small MP4 writer (H.264 + AAC) |
| `rig.js` | Exploded view and blueprint lines for the vessel model |
| `world.js`, `boat.js`, `shared.js` | Harbour, studio, vessel geometry, shared motion helpers |
| `tools/serve.py` | Local server (also receives the exported MP4) |
| `tools/analyze.html`, `tools/verify.html`, `tools/check_mp4.py` | Narration timing, playback check, file structure check |

## Earlier versions (kept, not the deliverable)

- `index.html` – first 60 s cinematic cut (older narration `audio/voiceover.wav`).
- `film-style.html` – 16:9 "floating card" style, synced to the older narration.
- `vertical.html` – 9:16 version of the card style.
