// SeaSafe camera firmware: Seeed Studio XIAO ESP32S3 Sense -> MJPEG stream + JSON status over Wi-Fi.
// Endpoints and data formats: vision/INTEGRATION.md. Detection runs in Python (vision/viewer.py), not here.
// Status: stream and status ran on the board (13-14 Nov). NOT yet run on the board: the UDP stream, /control and the two-network join (they compile).
//
// Board: "XIAO_ESP32S3" (ESP32 Arduino core 3.x), Tools > PSRAM: "OPI PSRAM" (needed for the camera).
// Wi-Fi: at power-on it joins the team iPhone hotspot if that is in range, otherwise the network in secrets.h
//        (copy secrets.example.h to secrets.h, git-ignored). Neither in range -> the board starts its own
//        access point "SeaSafe-Cam" (password in AP_PASS, http://192.168.4.1) and keeps retrying both.
//
//   http://<ip>/          quick test page
//   http://<ip>/status    JSON status (CORS open)
//   http://<ip>/capture   one JPEG
//   http://<ip>/control?size=vga|hvga|cif|qvga&quality=4..63   change picture size / compression while running
//   http://<ip>:81/stream MJPEG (multipart/x-mixed-replace), ONE client at a time
//   udp://<ip>:8082       the same frames as UDP datagrams: no freezes on a lossy network (see udpStreamTask)

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_timer.h"
#include <lwip/sockets.h>
#include "esp_wifi.h"

#if __has_include("secrets.h")
#include "secrets.h"
#endif
#define HOTSPOT_SSID "Armin \xE2\x80\x93 iPhone"  // iPhone names its hotspot with an EN DASH (–), not "-"
#define HOTSPOT_PASS "password"
#ifndef AP_PASS
#define AP_PASS "seasafe123"  // min. 8 characters (WPA2)
#endif

const char *HOSTNAME = "seasafe-cam";  // -> http://seasafe-cam.local (mDNS, macOS/iOS/Linux with avahi)
const char *AP_SSID = "SeaSafe-Cam";
const framesize_t FRAME_SIZE = FRAMESIZE_VGA;  // 640x480: good for YOLO at imgsz 640, ~10-20 fps over Wi-Fi
const int JPEG_QUALITY = 12;                   // 0-63, lower = better quality and bigger frames

// XIAO ESP32S3 Sense camera pins (same as CAMERA_MODEL_XIAO_ESP32S3 in the core's CameraWebServer example)
#define PWDN_GPIO_NUM  -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  10
#define SIOD_GPIO_NUM  40
#define SIOC_GPIO_NUM  39
#define Y9_GPIO_NUM    48
#define Y8_GPIO_NUM    11
#define Y7_GPIO_NUM    12
#define Y6_GPIO_NUM    14
#define Y5_GPIO_NUM    16
#define Y4_GPIO_NUM    18
#define Y3_GPIO_NUM    17
#define Y2_GPIO_NUM    15
#define VSYNC_GPIO_NUM 38
#define HREF_GPIO_NUM  47
#define PCLK_GPIO_NUM  13

#define BOUNDARY "seasafeframe"
static const char *STREAM_TYPE = "multipart/x-mixed-replace;boundary=" BOUNDARY;
static const char *PART_HDR = "\r\n--" BOUNDARY "\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\nX-Timestamp: %lu\r\n\r\n";

static bool apUp = false;  // own network "SeaSafe-Cam" is running (hotspot not found at boot)
static String wifiProblem;  // why joining failed + the networks the board could see; repeated on serial
static const char *sensorName = "unknown";
static volatile bool streaming = false;
static volatile uint32_t framesSent = 0;
static volatile float fps = 0;

static bool cameraInit() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM; c.pin_d1 = Y3_GPIO_NUM; c.pin_d2 = Y4_GPIO_NUM; c.pin_d3 = Y5_GPIO_NUM;
  c.pin_d4 = Y6_GPIO_NUM; c.pin_d5 = Y7_GPIO_NUM; c.pin_d6 = Y8_GPIO_NUM; c.pin_d7 = Y9_GPIO_NUM;
  c.pin_xclk = XCLK_GPIO_NUM; c.pin_pclk = PCLK_GPIO_NUM; c.pin_vsync = VSYNC_GPIO_NUM; c.pin_href = HREF_GPIO_NUM;
  c.pin_sccb_sda = SIOD_GPIO_NUM; c.pin_sccb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn = PWDN_GPIO_NUM; c.pin_reset = RESET_GPIO_NUM;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = FRAME_SIZE;
  c.jpeg_quality = JPEG_QUALITY;
  c.fb_count = 2;
  c.fb_location = CAMERA_FB_IN_PSRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;  // always send the newest frame, never a queued old one
  if (!psramFound()) {
    Serial.println("No PSRAM: set Tools > PSRAM to 'OPI PSRAM'. Falling back to QVGA in DRAM.");
    c.frame_size = FRAMESIZE_QVGA;
    c.fb_count = 1;
    c.fb_location = CAMERA_FB_IN_DRAM;
    c.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }
  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x (is the Sense camera board attached?)\n", err);
    return false;
  }
  sensor_t *s = esp_camera_sensor_get();
  switch (s->id.PID) {
    case OV2640_PID: sensorName = "OV2640"; break;
    case OV3660_PID: sensorName = "OV3660"; s->set_vflip(s, 1); break;  // OV3660 is mounted upside down
    case OV5640_PID: sensorName = "OV5640"; break;
  }
  return true;
}

static volatile int lastDisconnect = 0;  // ESP-IDF reason code of the last failed join (201 = not found, 15/202/204 = password/handshake)

// Known networks in priority order: the team hotspot, then the one in secrets.h (if it defines WIFI_SSID).
struct Net { const char *ssid, *pass; };
static const Net NETS[] = {
  {HOTSPOT_SSID, HOTSPOT_PASS},
#ifdef WIFI_SSID
  {WIFI_SSID, WIFI_PASS},
#endif
};

// Join the first known network that is in range. Blocks for the scan plus up to 12 s per network tried.
static bool tryJoin() {
  WiFi.disconnect();  // drop a stuck attempt first, otherwise scan and begin() are ignored
  int n = WiFi.scanNetworks();
  String inRange, failed;
  for (int i = 0; i < n; i++) inRange += " '" + WiFi.SSID(i) + "' " + String(WiFi.RSSI(i)) + "dBm";
  for (const Net &net : NETS) {
    bool seen = false;
    for (int i = 0; i < n && !seen; i++) seen = WiFi.SSID(i) == net.ssid;
    if (!seen) continue;
    Serial.printf("Joining Wi-Fi '%s'\n", net.ssid);
    lastDisconnect = 0;
    WiFi.begin(net.ssid, net.pass);
    for (int t = 0; t < 24 && WiFi.status() != WL_CONNECTED; t++) delay(500);
    if (WiFi.status() == WL_CONNECTED) {
      wifiProblem = "";
      return true;
    }
    failed += String(" could not join '") + net.ssid + "' (reason " + String(lastDisconnect) + ")";
    WiFi.disconnect();
  }
  // Below about -80 dBm a network is too weak to join: check that the antenna is clipped on.
  wifiProblem = (failed.length() ? failed : String(" no known network in range")) + ". In range:" + inRange;
  return false;
}

static void startWifi() {
  WiFi.setHostname(HOSTNAME);
  WiFi.onEvent([](arduino_event_id_t, arduino_event_info_t info) { lastDisconnect = info.wifi_sta_disconnected.reason; },
               ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
  WiFi.mode(WIFI_STA);
  // A building network has many access points with the same name: scan them all and join the strongest,
  // not the first one found (which can be too weak to connect to).
  WiFi.setScanMethod(WIFI_ALL_CHANNEL_SCAN);
  WiFi.setSortMethod(WIFI_CONNECT_AP_BY_SIGNAL);
  WiFi.setSleep(false);  // power save adds big stream latency
  if (tryJoin()) return;
  Serial.println("Wi-Fi:" + wifiProblem + "\nStarting own network SeaSafe-Cam and retrying.");
  // Own network so the camera is always reachable; loop() keeps retrying the known networks.
  apUp = true;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
}

static bool joined() { return WiFi.status() == WL_CONNECTED; }

static String ipString() { return joined() ? WiFi.localIP().toString() : WiFi.softAPIP().toString(); }

static void cors(httpd_req_t *req) { httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*"); }

static esp_err_t statusHandler(httpd_req_t *req) {
  sensor_t *s = esp_camera_sensor_get();
  framesize_t fsz = s ? (framesize_t)s->status.framesize : FRAME_SIZE;
  char json[480];
  snprintf(json, sizeof(json),
           "{\"t\":\"cam\",\"id\":\"%s\",\"ms\":%lu,\"ip\":\"%s\",\"mode\":\"%s\",\"ssid\":\"%s\",\"rssi\":%d,"
           "\"sensor\":\"%s\",\"w\":%u,\"h\":%u,\"quality\":%d,\"streaming\":%s,\"fps\":%.1f,"
           "\"frames\":%lu,\"heap\":%u,\"psram\":%u}",
           HOSTNAME, (unsigned long)millis(), ipString().c_str(), joined() ? "STA" : "AP", joined() ? WiFi.SSID().c_str() : AP_SSID,
           joined() ? (int)WiFi.RSSI() : 0, sensorName, resolution[fsz].width, resolution[fsz].height,
           s ? s->status.quality : JPEG_QUALITY, streaming ? "true" : "false", streaming ? fps : 0.0f,
           (unsigned long)framesSent, (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getFreePsram());
  httpd_resp_set_type(req, "application/json");
  cors(req);
  return httpd_resp_sendstr(req, json);
}

// Tune the picture for the Wi-Fi at hand without reflashing. Sizes never exceed the VGA buffer allocated at boot.
static esp_err_t controlHandler(httpd_req_t *req) {
  char q[64], v[16];
  sensor_t *s = esp_camera_sensor_get();
  if (s && httpd_req_get_url_query_str(req, q, sizeof(q)) == ESP_OK) {
    if (httpd_query_key_value(q, "quality", v, sizeof(v)) == ESP_OK) s->set_quality(s, constrain(atoi(v), 4, 63));
    // EXPERIMENT (radio tuning in a crowded hall)
    if (httpd_query_key_value(q, "tx", v, sizeof(v)) == ESP_OK) esp_wifi_set_max_tx_power(constrain(atoi(v), 8, 80));
    if (httpd_query_key_value(q, "nob", v, sizeof(v)) == ESP_OK)
      esp_wifi_set_protocol(WIFI_IF_STA, atoi(v) ? (WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N) : (WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N));
    if (httpd_query_key_value(q, "size", v, sizeof(v)) == ESP_OK)
      s->set_framesize(s, !strcmp(v, "qvga") ? FRAMESIZE_QVGA : !strcmp(v, "cif") ? FRAMESIZE_CIF
                          : !strcmp(v, "hvga") ? FRAMESIZE_HVGA : FRAMESIZE_VGA);
  }
  return statusHandler(req);
}

static esp_err_t captureHandler(httpd_req_t *req) {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) return httpd_resp_send_500(req);
  httpd_resp_set_type(req, "image/jpeg");
  cors(req);
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

static esp_err_t indexHandler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_sendstr(req,
    "<!doctype html><meta name=viewport content='width=device-width'><title>SeaSafe Cam</title>"
    "<body style='margin:0;background:#000;color:#ccc;font:14px sans-serif'>"
    "<img id=v style='width:100%'><pre id=s></pre><script>"
    "v.src=location.protocol+'//'+location.hostname+':81/stream';"
    "setInterval(()=>fetch('/status').then(r=>r.text()).then(t=>s.textContent=t),1000)</script>");
}

static void countFrame(int64_t &last) {  // running frame rate for /status
  int64_t now = esp_timer_get_time();
  float inst = 1e6f / (float)(now - last > 0 ? now - last : 1);
  fps = fps == 0 ? inst : fps * 0.9f + inst * 0.1f;
  last = now;
  framesSent++;
}

// Loss-tolerant video for crowded Wi-Fi (vision/viewer.py --source udp://<ip>). Over TCP every lost packet
// freezes the stream for 2-3 s (lwIP retransmit timer); here a lost datagram costs one frame.
// The viewer sends any datagram to port 8082 once a second; frames go back to it for the next 3 s.
// Datagram: "SC", frame id (u16 LE), chunk index (u8), chunk count (u8), then up to 1400 JPEG bytes.
static const int UDP_PORT = 8082;
static const size_t UDP_CHUNK = 1400;
static void udpStreamTask(void *) {
  static uint8_t pkt[6 + UDP_CHUNK];
  int sock = socket(AF_INET, SOCK_DGRAM, 0);
  sockaddr_in me = {};
  me.sin_family = AF_INET;
  me.sin_port = htons(UDP_PORT);
  me.sin_addr.s_addr = INADDR_ANY;
  bind(sock, (sockaddr *)&me, sizeof(me));
  sockaddr_in peer = {};
  uint32_t helloMs = 0;
  bool active = false;
  uint16_t frameId = 0;
  int64_t last = 0;
  for (;;) {
    char hello[16];
    sockaddr_in from;
    socklen_t fromLen = sizeof(from);
    if (recvfrom(sock, hello, sizeof(hello), MSG_DONTWAIT, (sockaddr *)&from, &fromLen) > 0) {
      peer = from;
      helloMs = millis();
      if (!active) last = esp_timer_get_time();
      active = true;
    }
    if (!active || millis() - helloMs > 3000) {
      if (active) { active = false; streaming = false; fps = 0; }  // viewer went away
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }
    size_t count = (fb->len + UDP_CHUNK - 1) / UDP_CHUNK;
    if (count <= 255) {  // always true for VGA JPEGs (60 kB = 43 chunks)
      frameId++;
      for (size_t i = 0; i < count; i++) {
        size_t n = min(UDP_CHUNK, fb->len - i * UDP_CHUNK);
        pkt[0] = 'S'; pkt[1] = 'C'; pkt[2] = frameId & 0xFF; pkt[3] = frameId >> 8; pkt[4] = i; pkt[5] = count;
        memcpy(pkt + 6, fb->buf + i * UDP_CHUNK, n);
        // sendto fails while the Wi-Fi transmit queue is full: wait a tick, give up on the chunk after 20
        for (int tries = 0; sendto(sock, pkt, n + 6, 0, (sockaddr *)&peer, sizeof(peer)) < 0 && tries < 20; tries++) vTaskDelay(1);
      }
      streaming = true;
      countFrame(last);
    }
    esp_camera_fb_return(fb);
  }
}

static esp_err_t streamHandler(httpd_req_t *req) {
  int one = 1;  // send each frame at once: Nagle + delayed ACK cost a round trip per frame on a slow link
  setsockopt(httpd_req_to_sockfd(req), IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
  httpd_resp_set_type(req, STREAM_TYPE);
  cors(req);
  streaming = true;
  int64_t last = esp_timer_get_time();
  char hdr[128];
  esp_err_t res = ESP_OK;
  while (res == ESP_OK) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
      break;
    }
    size_t n = snprintf(hdr, sizeof(hdr), PART_HDR, (unsigned)fb->len, (unsigned long)millis());
    res = httpd_resp_send_chunk(req, hdr, n);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    countFrame(last);
  }
  streaming = false;  // client went away (send failed)
  fps = 0;
  return res;
}

static void startServers() {
  httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
  httpd_handle_t web = NULL, stream = NULL;
  httpd_uri_t index = {.uri = "/", .method = HTTP_GET, .handler = indexHandler, .user_ctx = NULL};
  httpd_uri_t status = {.uri = "/status", .method = HTTP_GET, .handler = statusHandler, .user_ctx = NULL};
  httpd_uri_t capture = {.uri = "/capture", .method = HTTP_GET, .handler = captureHandler, .user_ctx = NULL};
  httpd_uri_t control = {.uri = "/control", .method = HTTP_GET, .handler = controlHandler, .user_ctx = NULL};
  httpd_uri_t streamUri = {.uri = "/stream", .method = HTTP_GET, .handler = streamHandler, .user_ctx = NULL};
  if (httpd_start(&web, &cfg) == ESP_OK) {
    httpd_register_uri_handler(web, &index);
    httpd_register_uri_handler(web, &status);
    httpd_register_uri_handler(web, &capture);
    httpd_register_uri_handler(web, &control);
  }
  // The stream never returns while a client watches, so it gets its own server (and task) on port 81.
  cfg.server_port = 81;
  cfg.ctrl_port += 1;
  if (httpd_start(&stream, &cfg) == ESP_OK) httpd_register_uri_handler(stream, &streamUri);
}

void setup() {
  Serial.begin(115200);
  delay(1500);  // give USB serial a moment so the first lines are not lost
  Serial.println("\nSeaSafe cam booting");
  if (!cameraInit()) {
    for (;;) { Serial.println("Camera init failed - check the camera ribbon and PSRAM setting"); delay(3000); }
  }
  startWifi();
  if (MDNS.begin(HOSTNAME)) MDNS.addService("http", "tcp", 80);
  startServers();
  xTaskCreate(udpStreamTask, "udpStream", 4096, NULL, 5, NULL);
}

void loop() {
  // No network at boot, or lost later (phone out of range): keep trying, no reboot needed.
  static uint32_t lastTry = 0;
  if (!joined() && millis() - lastTry > 15000) {
    tryJoin();
    lastTry = millis();
  }
  if (joined()) wifiProblem = "";
  // Repeat the address so it is visible whenever the Serial Monitor is opened.
  Serial.printf("[%s] http://%s/  stream: http://%s:81/stream  (%s.local)  sensor=%s streaming=%d fps=%.1f\n",
                joined() ? WiFi.SSID().c_str() : apUp ? "AP SeaSafe-Cam" : "NO WIFI, retrying", ipString().c_str(), ipString().c_str(), HOSTNAME, sensorName,
                (int)streaming, streaming ? fps : 0.0f);
  if (wifiProblem.length()) Serial.println("  Wi-Fi:" + wifiProblem);
  delay(5000);
}
