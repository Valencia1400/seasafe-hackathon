#!/usr/bin/env python3
"""Bench-test server for the SeaGuardian Arduino firmware. It plays the role of the website's WebSocket server,
so the ESP32 can be tested before (or without) the real website.

  pip install websockets
  python test_server.py            # listens on port 8080, any path
Then set WS_HOST in Config.h to this computer's IP address on the same Wi-Fi, WS_PORT 8080, and flash.

Type a command and press Enter:
  arm | disarm | f | b | l | r | stop | estop | reset | up | down | neutral | zero | sleep
  speed 0.7 | servo 120 | drive 0.5 -0.2 | motors 0.4 0.4 | log debug | hb on | hb off | quit
  or any raw JSON, e.g. {"cmd":"servo","angle":45}
A heartbeat ('ping', 5 times a second) is sent automatically so the boat's watchdog does not trip
between typed commands; 'hb off' stops it, which is how you test the watchdog."""
import asyncio, json, sys, time
import websockets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
SHORT = {"arm": {"cmd": "arm", "value": True}, "disarm": {"cmd": "arm", "value": False}, "stop": {"cmd": "stop"},
         "f": {"cmd": "move", "dir": "forward"}, "b": {"cmd": "move", "dir": "backward"}, "l": {"cmd": "move", "dir": "left"},
         "r": {"cmd": "move", "dir": "right"}, "estop": {"cmd": "estop"}, "reset": {"cmd": "estop_reset"},
         "up": {"cmd": "speed_up"}, "down": {"cmd": "speed_down"}, "neutral": {"cmd": "servo_neutral"},
         "zero": {"cmd": "imu_zero"}, "sleep": {"cmd": "sleep"}}
state = {"ws": None, "hb": True, "last_print": 0.0, "frames": 0}

def parse(line):
    w = line.split()
    if not w: return None
    if line.lstrip().startswith("{"): return json.loads(line)
    if w[0] in SHORT: return SHORT[w[0]]
    if w[0] == "speed": return {"cmd": "speed", "value": float(w[1])}
    if w[0] == "servo": return {"cmd": "servo", "angle": float(w[1])}
    if w[0] == "drive": return {"cmd": "drive", "throttle": float(w[1]), "steer": float(w[2])}
    if w[0] == "motors": return {"cmd": "motors", "left": float(w[1]), "right": float(w[2])}
    if w[0] == "log": return {"cmd": "log_level", "value": w[1]}
    raise ValueError("unknown shortcut")

def show(m):
    i, g, s, mo = m["imu"], m["gps"], m["sys"], m["motors"]
    pos = f"{g['lat']:.5f},{g['lon']:.5f} sats {g['sats']}" if g["fix"] else ("no fix" if g["receiving"] else "GPS silent")
    att = f"roll {i['roll']:6.1f} pitch {i['pitch']:6.1f} yaw {i['yaw']:6.1f}" if i["ok"] else "IMU not responding"
    flags = ("ARMED " if mo["armed"] else "") + ("ESTOP " if s["estop"] else "") + ("FAILSAFE " if s["failsafe"] else "")
    print(f"[tel {m['seq']:6d}] {att} | {pos} | L {mo['left']:+.2f} R {mo['right']:+.2f} spd {mo['limit']:.1f} servo {m['servos'][0]:.0f} | "
          f"rssi {s['rssi']} heap {s['heap']} | {flags}", flush=True)

async def handler(ws):
    print(f"\n*** ESP32 connected from {ws.remote_address[0]}", flush=True)
    state["ws"] = ws
    try:
        async for raw in ws:
            m = json.loads(raw)
            if m.get("type") == "telemetry":
                state["frames"] += 1
                if time.time() - state["last_print"] >= 1.0:
                    state["last_print"] = time.time(); show(m)
            else:
                print("    <-", raw, flush=True)
    except websockets.ConnectionClosed:
        pass
    finally:
        state["ws"] = None
        print("*** ESP32 disconnected", flush=True)

async def heartbeat():
    while True:
        await asyncio.sleep(0.2)
        if state["hb"] and state["ws"]:
            try: await state["ws"].send('{"cmd":"ping"}')
            except Exception: pass

async def console():
    loop = asyncio.get_running_loop()
    while True:
        line = (await loop.run_in_executor(None, sys.stdin.readline))
        if not line or line.strip() == "quit": return
        line = line.strip()
        if line in ("hb on", "hb off"):
            state["hb"] = line.endswith("on"); print("heartbeat", "on" if state["hb"] else "OFF (watchdog will trip)"); continue
        try: cmd = parse(line)
        except Exception as e: print("?", e); continue
        if cmd is None: continue
        if not state["ws"]: print("no ESP32 connected"); continue
        await state["ws"].send(json.dumps(cmd)); print("    ->", json.dumps(cmd), flush=True)

async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT):
        print(f"SeaGuardian test server listening on port {PORT}. Waiting for the ESP32...", flush=True)
        hb = asyncio.create_task(heartbeat())
        await console()
        hb.cancel()

asyncio.run(main())
