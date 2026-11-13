// SeaSafe camera firmware: Seeed Studio XIAO ESP32S3 Sense -> MJPEG stream + JSON status over Wi-Fi.
// Endpoints and data formats: vision/INTEGRATION.md. Detection runs in Python (vision/viewer.py), not here.
// Status: compiles with ESP32 core 3.3.12 (13 Nov); NOT yet run on the board.
//
// Board: "XIAO_ESP32S3" (ESP32 Arduino core 3.x), Tools > PSRAM: "OPI PSRAM" (needed for the camera).
// Wi-Fi: copy secrets.example.h to secrets.h (git-ignored) and fill in a 2.4 GHz network.
//        No secrets.h, or the network is not found within 15 s -> the board starts its own
//        access point "SeaSafe-Cam" (password in AP_PASS) and serves on http://192.168.4.1
//
//   http://<ip>/          quick test page
//   http://<ip>/status    JSON status (CORS open)
//   http://<ip>/capture   one JPEG
//   http://<ip>:81/stream MJPEG (multipart/x-mixed-replace), ONE client at a time

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_timer.h"

#if __has_include("secrets.h")
#include "secrets.h"
#endif
#ifndef WIFI_SSID
#define WIFI_SSID ""
#define WIFI_PASS ""
#endif
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

static bool apMode = false;
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

static void startWifi() {
  WiFi.setHostname(HOSTNAME);
  if (strlen(WIFI_SSID) > 0) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    WiFi.setSleep(false);  // power save adds big stream latency
    Serial.printf("Joining Wi-Fi '%s'", WIFI_SSID);
    for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
      delay(500);
      Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) return;
    Serial.println("Could not join (2.4 GHz only, check name/password). Starting own access point.");
  }
  apMode = true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
}

static String ipString() { return apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString(); }

static void cors(httpd_req_t *req) { httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*"); }

static esp_err_t statusHandler(httpd_req_t *req) {
  sensor_t *s = esp_camera_sensor_get();
  framesize_t fsz = s ? (framesize_t)s->status.framesize : FRAME_SIZE;
  char json[400];
  snprintf(json, sizeof(json),
           "{\"t\":\"cam\",\"id\":\"%s\",\"ms\":%lu,\"ip\":\"%s\",\"mode\":\"%s\",\"rssi\":%d,"
           "\"sensor\":\"%s\",\"w\":%u,\"h\":%u,\"quality\":%d,\"streaming\":%s,\"fps\":%.1f,"
           "\"frames\":%lu,\"heap\":%u,\"psram\":%u}",
           HOSTNAME, (unsigned long)millis(), ipString().c_str(), apMode ? "AP" : "STA",
           apMode ? 0 : (int)WiFi.RSSI(), sensorName, resolution[fsz].width, resolution[fsz].height,
           s ? s->status.quality : JPEG_QUALITY, streaming ? "true" : "false", streaming ? fps : 0.0f,
           (unsigned long)framesSent, (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getFreePsram());
  httpd_resp_set_type(req, "application/json");
  cors(req);
  return httpd_resp_sendstr(req, json);
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

static esp_err_t streamHandler(httpd_req_t *req) {
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
    int64_t now = esp_timer_get_time();
    float inst = 1e6f / (float)(now - last > 0 ? now - last : 1);
    fps = fps == 0 ? inst : fps * 0.9f + inst * 0.1f;
    last = now;
    framesSent++;
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
  httpd_uri_t streamUri = {.uri = "/stream", .method = HTTP_GET, .handler = streamHandler, .user_ctx = NULL};
  if (httpd_start(&web, &cfg) == ESP_OK) {
    httpd_register_uri_handler(web, &index);
    httpd_register_uri_handler(web, &status);
    httpd_register_uri_handler(web, &capture);
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
}

void loop() {
  // Repeat the address so it is visible whenever the Serial Monitor is opened.
  Serial.printf("[%s] http://%s/  stream: http://%s:81/stream  (%s.local)  sensor=%s streaming=%d fps=%.1f\n",
                apMode ? "AP SeaSafe-Cam" : "STA", ipString().c_str(), ipString().c_str(), HOSTNAME, sensorName,
                (int)streaming, streaming ? fps : 0.0f);
  delay(5000);
}
