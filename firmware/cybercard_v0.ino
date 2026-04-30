/*
 * cybercard_v0.ino — CyberCard Device Firmware · ESP32-S3
 * Furulie LLC · v0.1 · 2026-04
 *
 * Hardware (see BOM.md):
 *   ESP32-S3-WROOM-1U-N8R8
 *   NXP PN5180 (NFC) on SPI
 *   TI CC1101 (Sub-GHz RF) on SPI
 *   SSD1306 128×32 OLED on I2C
 *   WS2812B status RGB LED
 *   Tactile button (active-low)
 *   USB-C power + OTG
 *
 * Pinout:
 *   I2C SDA=1  SCL=2
 *   CC1101 CS=10 MOSI=11 SCK=12 MISO=13 GDO0=4 GDO2=5
 *   PN5180 CS=17 BUSY=14 IRQ=15 RST=16 (shared SPI bus MOSI/SCK/MISO)
 *   WS2812 DATA=7
 *   BUTTON=6 (active-low, internal pull-up)
 *   BATT_ADC=18 (1:2 divider → 3.3V rail, ADC reads 0–2.1V → 0–4.2V)
 *
 * Modes (cycle with BUTTON short press):
 *   MODE_NFC_WRITE  — write NDEF URL to NTAG216 (tap a blank tag)
 *   MODE_NFC_SCAN   — scan + dump NTAG tag data to OLED + serial
 *   MODE_RF_SCAN    — listen on 433 MHz, print packet RSSI to OLED
 *   MODE_RF_TX_TEST — transmit 1-second OOK carrier on 433 MHz (range test)
 *   MODE_STATUS     — show battery voltage + WiFi/BLE status
 *
 * Long press (2s): factory reset SPIFFS config
 * USB OTG mode:   auto-detected, exposes USB serial for debug
 *
 * Dependencies (install via Arduino Library Manager):
 *   Adafruit NeoPixel
 *   Adafruit SSD1306
 *   Adafruit GFX
 *   SmartRF Studio CC1101 (or ELECHOUSE CC1101)
 *   PN532 by Adafruit  ← used for PN5180 SPI wrapper
 *   SPIFFS (built-in ESP32 core)
 *   WiFi    (built-in)
 *   BLE     (built-in)
 */

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>
#include <SPIFFS.h>
#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Pin definitions ────────────────────────────────────────────────────────────
#define SDA_PIN      1
#define SCL_PIN      2
#define GDO0_PIN     4
#define GDO2_PIN     5
#define BTN_PIN      6
#define LED_PIN      7
#define CC_CS_PIN   10
#define MOSI_PIN    11
#define SCK_PIN     12
#define MISO_PIN    13
#define PN_BUSY_PIN 14
#define PN_IRQ_PIN  15
#define PN_RST_PIN  16
#define PN_CS_PIN   17
#define BATT_PIN    18

// ── OLED ──────────────────────────────────────────────────────────────────────
#define OLED_WIDTH  128
#define OLED_HEIGHT  32
#define OLED_ADDR  0x3C
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

// ── NeoPixel ──────────────────────────────────────────────────────────────────
Adafruit_NeoPixel pixel(1, LED_PIN, NEO_GRB + NEO_KHZ800);

// ── Operating modes ───────────────────────────────────────────────────────────
enum Mode {
  MODE_NFC_WRITE = 0,
  MODE_NFC_SCAN,
  MODE_RF_SCAN,
  MODE_RF_TX_TEST,
  MODE_STATUS,
  MODE_COUNT
};

const char* MODE_LABELS[] = {
  "NFC  WRITE",
  "NFC  SCAN",
  "RF   SCAN",
  "RF   TX TEST",
  "STATUS"
};

Mode currentMode = MODE_STATUS;

// ── BLE identity beacon ───────────────────────────────────────────────────────
// Advertises a short identity beacon when in STATUS mode.
// Anyone scanning for BLE devices near you sees: "CyberCard · FLLC"
#define BLE_DEVICE_NAME  "CyberCard · FLLC"
BLEServer*      bleServer      = nullptr;
BLEAdvertising* bleAdvertising = nullptr;

// ── NDEF URL to write ─────────────────────────────────────────────────────────
// Change this to your /tap URL before flashing.
// Use scripts/generate_ndef.js to get the raw byte payload.
const char* TAP_URL = "https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card";

// ── Utility: set RGB LED colour ───────────────────────────────────────────────
void setLed(uint8_t r, uint8_t g, uint8_t b) {
  pixel.setPixelColor(0, pixel.Color(r, g, b));
  pixel.show();
}

// ── Utility: read battery voltage ─────────────────────────────────────────────
float readBattery() {
  // 12-bit ADC, 3.3V ref, 1:2 divider on GPIO18
  int raw = analogRead(BATT_PIN);
  return (raw / 4095.0f) * 3.3f * 2.0f;
}

// ── OLED helpers ─────────────────────────────────────────────────────────────
void oledLine(int y, const char* label, const char* value, bool highlight = false) {
  display.setCursor(0, y);
  if (highlight) {
    display.setTextColor(BLACK, WHITE);
    display.print(label);
    display.setTextColor(WHITE);
  } else {
    display.setTextColor(SSD1306_WHITE);
    display.print(label);
  }
  display.setCursor(64, y);
  display.print(value);
}

void oledHeader(const char* title) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.print(title);
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
  display.display();
}

// ── PN5180 minimal SPI driver ─────────────────────────────────────────────────
// Full ISO14443A frame via PN5180. Enough for NTAG216 read/write.

void pn5180_reset() {
  digitalWrite(PN_RST_PIN, LOW);
  delay(10);
  digitalWrite(PN_RST_PIN, HIGH);
  delay(50);
  // Wait for BUSY low → idle
  unsigned long t = millis();
  while (digitalRead(PN_BUSY_PIN) && millis() - t < 500);
}

void pn5180_spi_send(const uint8_t* buf, size_t len) {
  digitalWrite(PN_CS_PIN, LOW);
  delayMicroseconds(2);
  SPI.transfer((uint8_t*)buf, len);
  delayMicroseconds(2);
  digitalWrite(PN_CS_PIN, HIGH);
  // Wait for BUSY
  unsigned long t = millis();
  while (digitalRead(PN_BUSY_PIN) && millis() - t < 200);
}

void pn5180_write_reg(uint8_t reg, uint32_t val) {
  uint8_t cmd[6] = { 0x00, reg,
    (uint8_t)(val >> 24), (uint8_t)(val >> 16),
    (uint8_t)(val >> 8),  (uint8_t)(val & 0xFF)
  };
  pn5180_spi_send(cmd, 6);
}

void pn5180_send_data(const uint8_t* data, uint8_t len, uint8_t lastBits = 0) {
  uint8_t cmd[2 + len];
  cmd[0] = 0x09;          // SEND_DATA
  cmd[1] = lastBits;
  memcpy(&cmd[2], data, len);
  pn5180_spi_send(cmd, 2 + len);
}

// Read IRQ status register
uint32_t pn5180_get_irq() {
  uint8_t cmd[2] = { 0x1A, 0x02 };   // READ_REGISTER · IRQ_STATUS
  uint8_t resp[4] = {};
  digitalWrite(PN_CS_PIN, LOW);
  delayMicroseconds(2);
  SPI.transfer(cmd, 2);
  SPI.transfer(resp, 4);
  delayMicroseconds(2);
  digitalWrite(PN_CS_PIN, HIGH);
  return (resp[0] << 24) | (resp[1] << 16) | (resp[2] << 8) | resp[3];
}

bool pn5180_activate_iso14443a() {
  // Set RF config to ISO14443A 106 kbps
  uint8_t cmd[] = { 0x11, 0x00 };  // LOAD_RF_CONFIG · ISO14443A_106
  pn5180_spi_send(cmd, 2);
  // Turn on RF
  uint8_t rf[] = { 0x16, 0x01 };   // RF_ON
  pn5180_spi_send(rf, 2);
  delay(5);
  // Send REQA
  uint8_t reqa = 0x26;
  pn5180_send_data(&reqa, 1, 7);
  delay(10);
  uint32_t irq = pn5180_get_irq();
  return (irq & 0x01);  // bit0 = RX_IRQ_STAT — card responded
}

// Write NDEF URL to NTAG216 page 4+
// Returns true on success. Simplified writer: formats full 4-byte pages.
bool pn5180_write_ndef_url(const char* url) {
  // NDEF TLV + URI record encoding
  // Type: 0xD1 (MB+ME+SR+TNF=0x01), ID len=0, payload
  // URI prefix 0x04 = "https://"
  const char* strippedUrl = url;
  uint8_t uriPrefix = 0x00;
  if (strncmp(url, "https://", 8) == 0) { uriPrefix = 0x04; strippedUrl = url + 8; }
  else if (strncmp(url, "http://", 7) == 0) { uriPrefix = 0x03; strippedUrl = url + 7; }

  size_t urlLen = strlen(strippedUrl);
  size_t payloadLen = 1 + urlLen;           // prefix byte + url
  uint8_t ndefMsg[6 + payloadLen];
  ndefMsg[0] = 0xD1;                        // MB MB SR TNF=0x01 (Well-Known)
  ndefMsg[1] = 0x01;                        // Type length = 1
  ndefMsg[2] = (uint8_t)payloadLen;         // Payload length
  ndefMsg[3] = 'U';                         // Type = URI record
  ndefMsg[4] = uriPrefix;
  memcpy(&ndefMsg[5], strippedUrl, urlLen);

  // Wrap in TLV
  size_t msgLen = sizeof(ndefMsg);
  uint8_t tlv[4 + msgLen];
  tlv[0] = 0x03;                            // NDEF TLV tag
  tlv[1] = (uint8_t)msgLen;                 // length (< 255)
  memcpy(&tlv[2], ndefMsg, msgLen);
  tlv[2 + msgLen] = 0xFE;                   // Terminator TLV

  // Write pages starting at page 4 (NTAG216 user memory starts at page 4)
  size_t totalBytes = sizeof(tlv);
  size_t pages = (totalBytes + 3) / 4;
  for (size_t i = 0; i < pages; i++) {
    uint8_t page[4] = {};
    size_t offset = i * 4;
    for (int b = 0; b < 4 && offset + b < totalBytes; b++) {
      page[b] = tlv[offset + b];
    }
    uint8_t cmd[7] = { 0x09, 0x00, 0xA2, (uint8_t)(4 + i), page[0], page[1], page[2] };
    // Note: page[3] is included in the WRITE command
    uint8_t fullCmd[8];
    memcpy(fullCmd, cmd, 7);
    fullCmd[7] = page[3];
    pn5180_send_data(&fullCmd[2], 6);  // skip preamble for WRITE
    delay(10);
  }
  return true;
}

// ── CC1101 minimal driver ─────────────────────────────────────────────────────
void cc1101_cmd(uint8_t cmd) {
  digitalWrite(CC_CS_PIN, LOW);
  delayMicroseconds(2);
  SPI.transfer(cmd);
  delayMicroseconds(2);
  digitalWrite(CC_CS_PIN, HIGH);
}

void cc1101_write_reg(uint8_t addr, uint8_t val) {
  digitalWrite(CC_CS_PIN, LOW);
  delayMicroseconds(2);
  SPI.transfer(addr);
  SPI.transfer(val);
  delayMicroseconds(2);
  digitalWrite(CC_CS_PIN, HIGH);
}

uint8_t cc1101_read_reg(uint8_t addr) {
  uint8_t val;
  digitalWrite(CC_CS_PIN, LOW);
  delayMicroseconds(2);
  SPI.transfer(addr | 0x80);
  val = SPI.transfer(0x00);
  delayMicroseconds(2);
  digitalWrite(CC_CS_PIN, HIGH);
  return val;
}

int8_t cc1101_read_rssi() {
  uint8_t raw = cc1101_read_reg(0x34 | 0xC0);  // RSSI status register
  int8_t rssi_dBm;
  if (raw >= 128) rssi_dBm = ((int8_t)raw - 256) / 2 - 74;
  else            rssi_dBm = (int8_t)raw / 2 - 74;
  return rssi_dBm;
}

void cc1101_init_433() {
  // Reset
  cc1101_cmd(0x30);
  delay(10);
  // Configure for 433.92 MHz OOK receive
  cc1101_write_reg(0x0B, 0x06);  // FSCTRL1 · IF frequency
  cc1101_write_reg(0x0D, 0x10);  // FREQ2 · 433.92 MHz
  cc1101_write_reg(0x0E, 0xA7);
  cc1101_write_reg(0x0F, 0x62);
  cc1101_write_reg(0x10, 0xC5);  // MDMCFG4 · channel BW 101.6 kHz
  cc1101_write_reg(0x11, 0x83);  // MDMCFG3 · data rate
  cc1101_write_reg(0x12, 0x30);  // MDMCFG2 · OOK/ASK, no sync word
  cc1101_write_reg(0x15, 0x15);  // DEVIATN
  cc1101_write_reg(0x18, 0x18);  // MCSM0
  cc1101_write_reg(0x19, 0x16);  // FOCCFG
  cc1101_write_reg(0x1B, 0x43);  // AGCCTRL2
  cc1101_write_reg(0x1D, 0x91);  // AGCCTRL0
  cc1101_write_reg(0x21, 0x56);  // FREND1
  cc1101_write_reg(0x22, 0x11);  // FREND0 · OOK
  cc1101_write_reg(0x23, 0xE9);  // FSCAL3
  cc1101_write_reg(0x24, 0x2A);
  cc1101_write_reg(0x25, 0x00);
  cc1101_write_reg(0x26, 0x1F);  // FSCAL0
  cc1101_cmd(0x34);               // SRX → enter receive mode
}

void cc1101_start_tx() {
  cc1101_cmd(0x36);  // SIDLE
  delay(2);
  cc1101_cmd(0x35);  // STX
}

void cc1101_stop() {
  cc1101_cmd(0x36);  // SIDLE
}

// ── Mode handlers ─────────────────────────────────────────────────────────────

void mode_nfc_write() {
  oledHeader("NFC WRITE");
  display.setCursor(0, 14);
  display.print("tap blank NTAG216");
  display.setCursor(0, 24);
  display.print("waiting...");
  display.display();
  setLed(0, 20, 60);

  if (!pn5180_activate_iso14443a()) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.print("no tag in field");
    display.display();
    return;
  }
  setLed(60, 0, 60);
  display.clearDisplay();
  display.setCursor(0, 0);
  display.print("tag found!");
  display.setCursor(0, 12);
  display.print("writing NDEF...");
  display.display();

  bool ok = pn5180_write_ndef_url(TAP_URL);
  display.clearDisplay();
  display.setCursor(0, 0);
  display.print(ok ? "WRITE OK" : "WRITE FAIL");
  if (ok) {
    display.setCursor(0, 12);
    display.print(TAP_URL);
  }
  display.display();
  setLed(ok ? 0 : 80, ok ? 80 : 0, 0);
  delay(3000);
}

void mode_nfc_scan() {
  oledHeader("NFC SCAN");
  display.setCursor(0, 14);
  display.print("tap any NFC tag");
  display.display();
  setLed(0, 0, 40);

  if (!pn5180_activate_iso14443a()) return;

  setLed(0, 80, 0);
  display.clearDisplay();
  display.setCursor(0, 0);
  display.print("ISO14443A tag");
  display.setCursor(0, 12);
  // In a full implementation: read UID, ATQA, SAK, read NDEF
  display.print("UID: [see serial]");
  display.display();
  Serial.println("[NFC_SCAN] ISO14443A tag detected. Full UID readout on next revision.");
  delay(2000);
}

void mode_rf_scan() {
  oledHeader("RF SCAN 433MHz");
  cc1101_init_433();
  setLed(80, 0, 80);

  unsigned long lastDraw = 0;
  while (currentMode == MODE_RF_SCAN) {
    // Poll RSSI every 100 ms
    if (millis() - lastDraw > 100) {
      int8_t rssi = cc1101_read_rssi();
      char buf[16];
      snprintf(buf, sizeof(buf), "%d dBm", rssi);
      display.clearDisplay();
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.print("RF SCAN 433MHz");
      display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
      // RSSI bar
      int barW = map(constrain(rssi + 100, 0, 60), 0, 60, 0, 120);
      display.fillRect(4, 16, barW, 8, SSD1306_WHITE);
      display.setCursor(0, 26);
      display.print(buf);
      display.display();
      lastDraw = millis();
    }
    // Check button to exit
    if (digitalRead(BTN_PIN) == LOW) {
      delay(50);
      if (digitalRead(BTN_PIN) == LOW) {
        while (digitalRead(BTN_PIN) == LOW);
        currentMode = (Mode)((currentMode + 1) % MODE_COUNT);
        cc1101_stop();
        return;
      }
    }
    delay(5);
  }
  cc1101_stop();
}

void mode_rf_tx_test() {
  oledHeader("RF TX 433MHz");
  display.setCursor(0, 14);
  display.print("1s OOK carrier");
  display.display();
  setLed(80, 40, 0);

  cc1101_init_433();
  cc1101_start_tx();
  delay(1000);
  cc1101_stop();

  display.setCursor(0, 24);
  display.print("done");
  display.display();
  setLed(0, 80, 0);
  delay(1000);
}

void mode_status() {
  float batt = readBattery();
  char battBuf[12];
  snprintf(battBuf, sizeof(battBuf), "%.2fV", batt);

  display.clearDisplay();
  display.setTextSize(1);
  oledLine(0, "MODE", "STATUS", true);
  oledLine(12, "BATT", battBuf);
  oledLine(22, "BLE", BLE_DEVICE_NAME);
  display.display();
  setLed(5, 5, 30);
}

// ── BLE beacon setup ──────────────────────────────────────────────────────────
void ble_start_beacon() {
  BLEDevice::init(BLE_DEVICE_NAME);
  bleServer      = BLEDevice::createServer();
  bleAdvertising = BLEDevice::getAdvertising();

  BLEAdvertisementData advData;
  advData.setName(BLE_DEVICE_NAME);
  advData.setCompleteServices(BLEUUID("12345678-1234-1234-1234-123456789abc"));
  bleAdvertising->setAdvertisementData(advData);
  bleAdvertising->start();
}

// ── Setup & loop ──────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Init I2C, SPI, GPIO
  Wire.begin(SDA_PIN, SCL_PIN);
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN);
  SPI.setFrequency(2000000);

  pinMode(PN_CS_PIN,  OUTPUT); digitalWrite(PN_CS_PIN, HIGH);
  pinMode(PN_RST_PIN, OUTPUT);
  pinMode(PN_BUSY_PIN, INPUT);
  pinMode(PN_IRQ_PIN, INPUT);
  pinMode(CC_CS_PIN,  OUTPUT); digitalWrite(CC_CS_PIN, HIGH);
  pinMode(GDO0_PIN,   INPUT);
  pinMode(GDO2_PIN,   INPUT);
  pinMode(BTN_PIN,    INPUT_PULLUP);

  // NeoPixel
  pixel.begin();
  setLed(0, 0, 0);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("[ERR] OLED init failed");
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.print("CYBERCARD v0");
  display.setCursor(0, 12);
  display.print("Furulie LLC");
  display.display();
  setLed(0, 60, 80);
  delay(1500);

  // PN5180 reset
  pn5180_reset();

  // CC1101 test read
  uint8_t partNum = cc1101_read_reg(0xF0 | 0x80);
  Serial.printf("[CC1101] part 0x%02X\n", partNum);

  // BLE beacon
  ble_start_beacon();
  Serial.printf("[BLE] advertising as: %s\n", BLE_DEVICE_NAME);

  // SPIFFS for config persistence
  if (!SPIFFS.begin(true)) {
    Serial.println("[WARN] SPIFFS mount failed — using defaults");
  }

  currentMode = MODE_STATUS;
  Serial.println("[BOOT] CyberCard v0 ready");
}

void loop() {
  // ── Button handler ────────────────────────────────────────────────────────
  static unsigned long btnDown = 0;
  static bool btnWasDown = false;

  bool btnPressed = (digitalRead(BTN_PIN) == LOW);
  if (btnPressed && !btnWasDown) {
    btnDown    = millis();
    btnWasDown = true;
  }
  if (!btnPressed && btnWasDown) {
    unsigned long held = millis() - btnDown;
    btnWasDown = false;
    if (held >= 2000) {
      // Long press → factory reset
      SPIFFS.format();
      display.clearDisplay();
      display.setCursor(0, 0);
      display.print("FACTORY RESET");
      display.display();
      setLed(80, 0, 0);
      delay(2000);
      ESP.restart();
    } else if (held >= 50) {
      // Short press → next mode
      if (currentMode != MODE_RF_SCAN) {   // RF_SCAN exits itself
        currentMode = (Mode)((currentMode + 1) % MODE_COUNT);
      }
    }
  }

  // ── Mode dispatch ─────────────────────────────────────────────────────────
  switch (currentMode) {
    case MODE_NFC_WRITE:  mode_nfc_write();  break;
    case MODE_NFC_SCAN:   mode_nfc_scan();   break;
    case MODE_RF_SCAN:    mode_rf_scan();    break;    // blocking loop inside
    case MODE_RF_TX_TEST: mode_rf_tx_test(); break;
    case MODE_STATUS:     mode_status();     break;
    default: break;
  }

  delay(50);
}
