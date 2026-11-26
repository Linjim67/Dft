// 霧化器 PWM 測試 (ESP32-S3)
//
// 接線：模組 V → 3V3 (或 5V)、G → GND、S → GPIO15
//
// 從序列埠 (115200) 隨時輸入：
//   0..1023     霧量。0 = 關，1023 = 全開
//   f <Hz>      PWM 頻率，0.05 ~ 39000 (預設 10)
//   min <0..1023>  開始出霧的最低值；1..1023 會線性對應到 min..1023
//   inv         反轉 S 腳極性 (模組若是 LOW 才出霧)
//   on / off    等於 1023 / 0
//   sweep       每 2 秒往上加 32，用來找開始出霧的值；輸入任何東西就停
//   s 或 ?      顯示目前設定
//
// 為什麼頻率要低：
//   霧化片由模組上的振盪電路 (約 100 kHz 級) 推動，S 腳只是開關。
//   每次打開，霧化片要先起振、水面要先建立駐波才會噴霧，大約要幾 ms 到幾十 ms。
//   PWM 若用 analogWrite 預設的 1 kHz，每次只開不到 1 ms，
//   就會幾乎沒霧，或者看起來跟全開一樣。
//   用 10 Hz 這種低頻做「開一段、停一段」，霧量就會跟著 duty 變。
//   如果 10 Hz 還是不線性，試 f 2 或 f 1；模組上若有 MCU 在讀 S 腳，要更慢才會動。
//
// 頻率 >= 3 Hz 用 LEDC 硬體 PWM；< 3 Hz 用 micros() 軟體計時。
// 霧化片不可乾燒：通電前請確認霧化片浮在水面上。

#include <Arduino.h>

static const uint8_t MIST_PIN = 15;

static const float HW_MIN_HZ = 3.0f;      // LEDC 用 40 MHz XTAL、14 bit 時最低約 2.4 Hz
static const float MIN_HZ = 0.05f;
static const float MAX_HZ = 39000.0f;     // 保留至少 10 bit 解析度
static const uint32_t XTAL_HZ = 40000000;

static float freqHz = 10.0f;
static uint16_t level = 0;      // 使用者輸入 0..1023
static uint16_t minLevel = 0;   // 死區補償
static bool activeLow = false;

static bool hwMode = false;
static uint8_t hwRes = 0;

static uint32_t swPeriodUs = 0;
static uint32_t swOnUs = 0;
static uint32_t swCycleStart = 0;
static int8_t swPinState = -1;

static bool sweeping = false;
static uint32_t sweepLast = 0;
static const uint16_t SWEEP_STEP = 32;
static const uint32_t SWEEP_MS = 2000;

static char lineBuf[32];
static uint8_t lineLen = 0;
static uint32_t lastCharMs = 0;

// 1..1023 → minLevel..1023；0 永遠是關
static uint16_t effectiveLevel() {
  if (level == 0) return 0;
  return minLevel + (uint32_t)level * (1023 - minLevel) / 1023;
}

static void writePin(bool mistOn) {
  int8_t s = mistOn ? 1 : 0;
  if (s == swPinState) return;
  swPinState = s;
  digitalWrite(MIST_PIN, (mistOn != activeLow) ? HIGH : LOW);
}

// 在 resolution 內找最大且 LEDC 分頻器 (1 ~ 1023) 撐得住的 bit 數
static uint8_t pickResolution(uint32_t f) {
  for (uint8_t r = 14; r >= 10; r--) {
    uint32_t div = XTAL_HZ / (f * (1UL << r));
    if (div >= 1 && div <= 1023) return r;
  }
  return 0;
}

static void applyDuty() {
  uint16_t e = effectiveLevel();
  if (hwMode) {
    uint32_t maxDuty = (1UL << hwRes) - 1;
    // 寫 maxDuty 時核心會自動補成 100%
    ledcWrite(MIST_PIN, (uint32_t)((uint64_t)e * maxDuty / 1023));
  } else {
    swOnUs = (uint32_t)((uint64_t)swPeriodUs * e / 1023);
    swCycleStart = micros();
    swPinState = -1;
  }
}

static void stopHw() {
  if (hwMode) {
    ledcDetach(MIST_PIN);
    hwMode = false;
  }
  pinMode(MIST_PIN, OUTPUT);
  swPinState = -1;
  writePin(false);
}

static bool applyFrequency() {
  stopHw();
  if (freqHz >= HW_MIN_HZ) {
    uint32_t f = (uint32_t)(freqHz + 0.5f);
    uint8_t r = pickResolution(f);
    if (r == 0 || !ledcAttach(MIST_PIN, f, r)) {
      Serial.printf("! LEDC 設定 %lu Hz 失敗\n", (unsigned long)f);
      return false;
    }
    ledcOutputInvert(MIST_PIN, activeLow);
    hwMode = true;
    hwRes = r;
    freqHz = (float)f;
  } else {
    swPeriodUs = (uint32_t)(1000000.0f / freqHz);
  }
  applyDuty();
  return true;
}

static void serviceSoftwarePwm() {
  if (hwMode) return;
  if (swOnUs == 0) { writePin(false); return; }
  if (swOnUs >= swPeriodUs) { writePin(true); return; }
  uint32_t t = micros() - swCycleStart;
  if (t >= swPeriodUs) {
    swCycleStart += swPeriodUs * (t / swPeriodUs);
    t = micros() - swCycleStart;
  }
  writePin(t < swOnUs);
}

static void printStatus() {
  uint16_t e = effectiveLevel();
  float periodMs = 1000.0f / freqHz;
  Serial.printf("level=%u  實際duty=%u/1023 (%.1f%%)  f=%.2f Hz  每週期開 %.1f ms / %.1f ms  min=%u  %s  %s\n",
                level, e, e * 100.0f / 1023, freqHz, periodMs * e / 1023, periodMs, minLevel,
                activeLow ? "LOW=出霧" : "HIGH=出霧",
                hwMode ? "[LEDC]" : "[軟體]");
}

static void printHelp() {
  Serial.println("指令: 0..1023 | f <Hz> | min <0..1023> | inv | on | off | sweep | s");
}

static void setLevel(long v) {
  level = (uint16_t)constrain(v, 0L, 1023L);
  applyDuty();
  printStatus();
}

static void handleLine(char *s) {
  while (*s == ' ') s++;
  if (*s == 0) return;

  if (sweeping) {
    sweeping = false;
    Serial.println("sweep 停止");
  }

  if (isdigit((unsigned char)*s)) {
    setLevel(atol(s));
  } else if (s[0] == 'f' && (s[1] == ' ' || s[1] == '=' || s[1] == '.' || isdigit((unsigned char)s[1]))) {
    float f = atof(s + 1 + (s[1] == ' ' || s[1] == '='));
    if (f < MIN_HZ || f > MAX_HZ) {
      Serial.printf("! 頻率範圍 %.2f ~ %.0f Hz\n", MIN_HZ, MAX_HZ);
      return;
    }
    freqHz = f;
    applyFrequency();
    printStatus();
  } else if (!strncmp(s, "min", 3)) {
    minLevel = (uint16_t)constrain(atol(s + 3), 0L, 1023L);
    applyDuty();
    printStatus();
  } else if (!strcmp(s, "inv")) {
    activeLow = !activeLow;
    applyFrequency();
    printStatus();
  } else if (!strcmp(s, "on")) {
    setLevel(1023);
  } else if (!strcmp(s, "off")) {
    setLevel(0);
  } else if (!strcmp(s, "sweep")) {
    sweeping = true;
    sweepLast = millis();
    Serial.printf("sweep: 每 %lu ms +%u，輸入任何東西停止\n", (unsigned long)SWEEP_MS, SWEEP_STEP);
    setLevel(0);
  } else if (!strcmp(s, "s") || !strcmp(s, "?")) {
    printStatus();
    printHelp();
  } else {
    Serial.printf("? 看不懂: %s\n", s);
    printHelp();
  }
}

static void readSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    lastCharMs = millis();
    if (c == '\n' || c == '\r') {
      lineBuf[lineLen] = 0;
      handleLine(lineBuf);
      lineLen = 0;
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = (char)tolower((unsigned char)c);
    }
  }
  // 序列埠監控視窗選「沒有行結尾」時，停 80 ms 就當一行結束
  if (lineLen && millis() - lastCharMs > 80) {
    lineBuf[lineLen] = 0;
    handleLine(lineBuf);
    lineLen = 0;
  }
}

static void serviceSweep() {
  if (!sweeping || millis() - sweepLast < SWEEP_MS) return;
  sweepLast = millis();
  if (level >= 1023) {
    sweeping = false;
    Serial.println("sweep 完成 (停在 1023)");
    return;
  }
  setLevel(min(1023, level + SWEEP_STEP));
}

void setup() {
  pinMode(MIST_PIN, OUTPUT);
  digitalWrite(MIST_PIN, activeLow ? HIGH : LOW);  // 開機先關

  Serial.begin(115200);
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 2000) delay(10);

  Serial.println();
  Serial.printf("霧化器 PWM 測試  GPIO%u\n", MIST_PIN);
  applyFrequency();
  printStatus();
  printHelp();
}

void loop() {
  readSerial();
  serviceSweep();
  serviceSoftwarePwm();
}
