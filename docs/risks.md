# Risks and next validation

| Risk | Next check |
|---|---|
| Divergent firmware packages and hardware reports | Resolve board/build identity and preserve reviewed stop-path fixes |
| Wi-Fi congestion or disconnects | Repeat camera and command tests on the actual demo network; measure watchdog/link-loss response |
| Motor supply dips and electrical noise | Validate regulator, wiring and motor current under load with the electrical lead |
| Unknown motor/battery ratings | Confirm voltage, current, discharge capability and protection before finalizing the power budget |
| Servo linkage damage | Set measured mechanical travel limits in firmware and dashboard |
| Open LAN control interface | Trusted local network only; authenticated control is future work |
| Stale camera data or false detections | Keep freshness checks and operator-review labels; validate on relevant scenes |
| Water ingress, stability and propulsion | Controlled buoyancy/sealing/steering tests before harbour use |
| Overclaiming | Keep reported tests, independent checks, visualization and future work distinct |

A recorded genuine test is useful backup evidence. An animated film or 3D visualization is illustrative, not a substitute for physical verification. Current dashboard has no operational simulator fallback.
