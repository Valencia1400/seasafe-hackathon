# AI log: Armin

All work below was done with Claude Code (Anthropic Claude, Opus model) in one long project conversation. Entries follow the template in [`../ai-process.md`](../ai-process.md). No passwords or Wi-Fi keys are recorded here.

### AI-A01 - Printable CAD parts for the catamaran
- Time / person / task: hackathon, Armin, mechanical design (hulls, bridge, electronics box).
- AI tool + model: Claude Code (Claude Opus).
- Prompt (paste or link): photos of the parts with a ruler for scale; asked for 4 separate STL files (left hull, right hull, bridge deck, electronics box with a camera holder for a Seeed XIAO ESP32S3), hollow and fast to print on a Prusa, fixed with M5x0.8x20 mm machine screws, with room for a rudder on a servo and two DC motors.
- Result (what the AI produced): parametric scripts and STLs in `cad/` for left hull, right hull, bridge and box (plus an optional rudder), with screw holes for M5x20, low infill/hollow shells, motor and servo space.
- Human verification: opened the STLs in the slicer, checked sizes against the ruler photos and print bed, reviewed fit of screws and the camera board.
- Errors / limitations found: the FS90R servo we had is continuous rotation, so it cannot hold a rudder angle; must be swapped for a positional SG90/MG90S. Props sit on pylons above the water (air-boat style), not under the hull.
- Changes made afterwards: documented the servo swap and prop layout in `cad/`.
- Linked requirement / issue / commit: `cad/`.

### AI-A02 - Boat camera firmware and YOLO viewer
- Time / person / task: Armin, vision (Phase 2).
- AI tool + model: Claude Code (Claude Opus).
- Prompt: make the XIAO ESP32S3 stream camera video and detect objects on the laptop, sending results to the teammates' dashboard.
- Result: ESP32S3 camera firmware, a Python viewer running YOLO (people, boats, birds, paddleboards, bottles; later text-prompt YOLOE for kayaks, buoys, debris, life jackets), viewer on port 8001, image flip option, and `vision/INTEGRATION.md` for teammates.
- Human verification: ran end to end on the board: about 26 fps over an iPhone hotspot; tested with printed test targets.
- Errors / limitations found: on crowded venue Wi-Fi only 3-6 fps due to packet loss; the external antenna must be attached; video froze on lost packets.
- Changes made afterwards: join the strongest access point, show signal strength on failure, hotspot-or-venue join, UDP video with anti-freeze handling. The UDP fix is pushed but NOT yet tested on the board.
- Linked requirement / issue / commit: 9081988, 4cc3389, beba728, 03b59c5, 4300b86.

### AI-A03 - Dashboard integration with camera and control ESP32
- Time / person / task: Armin, integration of Angelo's dashboard and a teammate's control ESP32 code.
- AI tool + model: Claude Code (Claude Opus).
- Prompt: check the dashboard with the camera, then review and fix the friend's ESP32 code for motors, gyro (MPU6050) and servo and connect it to the dashboard.
- Result: dashboard verified with the live camera; dashboard became a real WebSocket server (port 8000, path `/ws`) with all simulation removed; motor control, small rudder travel (about ±6°, left/centre/right), live 3D boat tilt from the MPU6050, pinout table, brownout and power advice; layout rebuilt as plain full-window HTML.
- Human verification: ran with the real control ESP32, tilted the board by hand and compared the 3D model, moved the servo and motors from the dashboard.
- Errors / limitations found: roll and pitch were swapped and yaw inverted for the way the IMU is mounted; brownouts when motors start from the same supply.
- Changes made afterwards: swapped roll/pitch, inverted yaw, limited servo travel, power advice added.
- Linked requirement / issue / commit: 703dfe1, 06a3305, 531615d, 7afa2ad.
