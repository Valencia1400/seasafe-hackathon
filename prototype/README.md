# SeaGuardian USV – interactive 3D prototype

Procedural Three.js model (no CAD files, no external services; Three.js r160 is vendored in `vendor/`).
Reconstructed from six photos of the physical boat; hidden details are approximations.

## Run
Browsers block ES modules on `file://`, so serve the folder:

    cd prototype
    python -m http.server 8765

Open http://localhost:8765/ (or http://localhost:8765/?present for presentation mode).

## Controls
Drag = rotate, scroll = zoom, right-drag = pan.
Space turntable · M propellers · U rudder · L part labels · R reset view · P presentation mode (all UI hidden, Esc/P to exit) · F fullscreen.
