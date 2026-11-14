// Copy this file to secrets.h (same folder) and fill it in. secrets.h is git-ignored.
// The ESP32 only supports 2.4 GHz Wi-Fi.
#define WIFI_SSID      "your-network-name"   // must match EXACTLY (spaces, case)
#define WIFI_PASSWORD  "your-password"
// LAN address of the laptop running dashboard/run_operator.py --host 0.0.0.0 (printed when it starts).
#define WS_HOST        "192.168.1.20"
