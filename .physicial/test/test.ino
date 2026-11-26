// 霧化器 PWM 測試 (ESP32-S3)
//
// 接線：模組 V → 3V3 (或 5V)、G → GND、S → GPIO15
//
// 這塊模組 S 腳是 LOW 出霧、HIGH 停止 (實測)。模組上有電阻把 S 拉到 G，
// 所以 S 空接時會一直噴；ESP32 重開機的瞬間腳位放開，也會短暫噴一下。
//
// 板子上兩個 USB 口都能用：USB 口 (晶片內建 USB) 或 UART 口 (CH343)，訊息兩邊同時送。
// 從序列埠 (115200) 隨時輸入：
//   0..1023     霧量。0 = 關，1023 = 全開
//   f <Hz>      PWM 頻率，0.05 ~ 39000 (預設 10)
//   min <0..1023>  開始出霧的最低值；1..1023 會線性對應到 min..1023
//   inv         反轉 S 腳極性 (預設 LOW = 出霧)
//   on / off    等於 1023 / 0
//   sweep       每 2 秒往上加 32，用來找開始出霧的值；輸入任何東西就停
//   s 或 ?      顯示目前設定
//   pin         量 GPIO15 腳上實際的電位 (確認腳有在輸出)
//   pulse       S 腳「按一下」0.3 秒再放開 (測模組是不是按鍵切換式)
//   probe       放開 S 腳，用內部上拉/下拉看模組那端有沒有接上、有沒有電
//   v <0~3.3>   S 腳輸出固定電壓 (不受 inv 影響)。輸入霧量/頻率等指令就回到 PWM 模式
//
// 固定電壓 (v 指令)：ESP32-S3 沒有 DAC，腳位本身只能輸出 0 或 3.3V。
//   v 用 39 kHz PWM 做出「平均電壓」，要在 GPIO15 和 S 之間加 RC 低通濾波，S 才是平滑的直流：
//
//     GPIO15 ── 1kΩ ──┬── S
//                     │
//                    10µF (電解電容 + 接這端)
//                     │
//                    GND
//
//   RC 時間常數 10 ms，改電壓後約 50 ms 穩定；39 kHz 的漣波約 1 mV。
//   不加 RC：電表會量到平均電壓，但模組實際收到的是 0/3.3V 的快速方波。
//   模組上有電阻把 S 拉到 G，會和 1kΩ 分壓，S 上的實際電壓會比設定值低一點，請用電表在 S 量。
//
// 為什麼頻率要低：
//   霧化片由模組上的振盪電路 (約 100 kHz 級) 推動，S 腳只是開關。
//   每次打開，霧化片要先起振、水面要先建立駐波才會噴霧，大約要幾 ms 到幾十 ms。
//   PWM 若用 analogWrite 預設的 1 kHz，每次只開不到 1 ms，
//   就會幾乎沒霧，或者看起來跟全開一樣。
//   用 10 Hz 這種低頻做「開一段、停一段」，霧量就會跟著 duty 變。
//   如果 10 Hz 還是不線性，試 f 2 或 f 1；模組上若有 MCU 在讀 S 腳，要更慢才會動。
//
// 頻率 >= 5 Hz 用 LEDC 硬體 PWM；< 5 Hz 用 micros() 軟體計時。
// 霧化片不可乾燒：通電前請確認霧化片浮在水面上。

#include <Arduino.h>
#include <driver/gpio.h>

static const uint8_t MIST_PIN = 15;

// LEDC 用 40 MHz XTAL。最多用 13 bit：14 bit 時 100% duty (16384) 會溢位變成 0，腳位反而全關。
// 13 bit 時分頻器上限 1023 → 最低約 4.8 Hz
static const float HW_MIN_HZ = 5.0f;
static const float MIN_HZ = 0.05f;
static const float MAX_HZ = 39000.0f;     // 保留至少 10 bit 解析度
static const uint32_t XTAL_HZ = 40000000;

static float freqHz = 10.0f;
static uint16_t level = 0;      // 使用者輸入 0..1023
static uint16_t minLevel = 0;   // 死區補償
static bool activeLow = true;   // 這塊模組 S = LOW 出霧

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

// 輸出同時送到 USB 口 (Serial) 和 UART 口 (Serial0)。USB 口沒插時寫入會直接丟掉，不會卡住。
class DualOut : public Print {
 public:
  size_t write(uint8_t c) override {
    Serial.write(c);
    Serial0.write(c);
    return 1;
  }
  size_t write(const uint8_t *buf, size_t n) override {
    Serial.write(buf, n);
    Serial0.write(buf, n);
    return n;
  }
};
static DualOut out;

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
  for (uint8_t r = 13; r >= 10; r--) {
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
      out.printf("! LEDC 設定 %lu Hz 失敗\n", (unsigned long)f);
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

// ---- 電壓模式 (v 指令) ----
static const float VDD = 3.30f;              // GPIO HIGH 的實際電壓；用電表量過可以改
static const uint32_t VOLT_PWM_HZ = 39000;   // 10 bit 解析度下 LEDC 能跑的最高頻率
static bool voltMode = false;
static float voltOut = 0;

static uint16_t voltDuty() {
  return (uint16_t)(voltOut / VDD * 1023.0f + 0.5f);
}

static bool applyVoltage() {
  stopHw();
  if (!ledcAttach(MIST_PIN, VOLT_PWM_HZ, 10)) {
    out.println("! LEDC 設定失敗");
    voltMode = false;
    return false;
  }
  ledcOutputInvert(MIST_PIN, false);   // 電壓就是腳位電壓，不反相
  hwMode = true;
  hwRes = 10;
  ledcWrite(MIST_PIN, voltDuty());     // 1023 時核心會補成 100%
  voltMode = true;
  return true;
}

static void exitVoltMode() {
  if (!voltMode) return;
  voltMode = false;
  applyFrequency();
}

static void applyOutput() {
  if (voltMode) applyVoltage();
  else applyFrequency();
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
  if (voltMode) {
    out.printf("電壓模式  S 腳平均 %.3f V  (duty %u/1023，%lu Hz PWM；加 RC 濾波後才是平滑直流)  不受 inv 影響\n",
               voltOut, voltDuty(), (unsigned long)VOLT_PWM_HZ);
    return;
  }
  uint16_t e = effectiveLevel();
  float periodMs = 1000.0f / freqHz;
  out.printf("level=%u  實際duty=%u/1023 (%.1f%%)  f=%.2f Hz  每週期開 %.1f ms / %.1f ms  min=%u  %s  %s\n",
                level, e, e * 100.0f / 1023, freqHz, periodMs * e / 1023, periodMs, minLevel,
                activeLow ? "LOW=出霧" : "HIGH=出霧",
                hwMode ? "[LEDC]" : "[軟體]");
}

static void printHelp() {
  out.println("指令: 0..1023 | f <Hz> | min <0..1023> | inv | on | off | sweep | v <V> | s | pin | pulse | probe");
}

// 讀回腳位實際電位：只打開輸入緩衝，不影響輸出
static void printPinLevel() {
  gpio_input_enable((gpio_num_t)MIST_PIN);
  // 取樣至少 200 ms；軟體模式取滿一個週期 (最多 2 秒)，取樣期間軟體 PWM 照跑
  uint32_t windowUs = hwMode ? 200000UL : constrain(swPeriodUs, 200000UL, 2000000UL);
  uint32_t highs = 0, N = 0, t0 = micros();
  while (micros() - t0 < windowUs) {
    serviceSoftwarePwm();
    highs += gpio_get_level((gpio_num_t)MIST_PIN);
    N++;
    delayMicroseconds(100);
  }
  float ratio = highs * 100.0f / N;
  float expectHigh;
  if (voltMode) {
    expectHigh = voltDuty() * 100.0f / 1023;
  } else {
    uint16_t e = effectiveLevel();
    expectHigh = activeLow ? 100.0f - e * 100.0f / 1023 : e * 100.0f / 1023;
  }
  out.printf("GPIO%u 量到 HIGH 的比例 %.1f%%，平均約 %.2f V  (應該約 %.1f%%)\n",
             MIST_PIN, ratio, ratio / 100.0f * VDD, expectHigh);
}

// 放開 S 腳，分別開內部上拉、下拉 (~45k) 讀電位。
// 模組端若有電阻把 S 拉到 G 或 V，就會蓋過內部的弱上下拉。
static void probeLine() {
  stopHw();
  pinMode(MIST_PIN, INPUT_PULLUP);
  delay(5);
  int up = digitalRead(MIST_PIN);
  pinMode(MIST_PIN, INPUT_PULLDOWN);
  delay(5);
  int down = digitalRead(MIST_PIN);
  pinMode(MIST_PIN, OUTPUT);
  applyOutput();   // 恢復原本的輸出

  out.printf("probe: 開上拉讀到 %s，開下拉讀到 %s\n", up ? "HIGH" : "LOW", down ? "HIGH" : "LOW");
  if (up && !down) {
    out.println("  → S 腳像是空接：S 線沒接上，或 G 沒共地 (這塊模組 S 空接會一直噴霧)");
  } else if (!up && !down) {
    out.println("  → 模組把 S 拉到 G：S 有接上、G 有共地 (正常)");
  } else if (up && down) {
    out.println("  → 模組把 S 拉到 V：S 有接上、模組 V 有電 (跟這塊模組實測不同，檢查是不是換了模組)");
  } else {
    out.println("  → 上拉讀 LOW、下拉讀 HIGH，不合理，可能接觸不良");
  }
}

// 模擬按鍵：S 腳啟動 300 ms 再放開，之後維持關
static void pulseButton() {
  level = 0;
  voltMode = false;
  stopHw();
  writePin(true);
  delay(300);
  writePin(false);
  applyFrequency();
  out.printf("pulse: S 腳%s 300 ms 後放開。若霧開始出來並持續，代表模組是按鍵切換式\n",
                activeLow ? "拉 LOW" : "拉 HIGH");
}

static void setLevel(long v) {
  level = (uint16_t)constrain(v, 0L, 1023L);
  if (voltMode) exitVoltMode();   // 會一併套用新的 level
  else applyDuty();
  printStatus();
}

static void handleLine(char *s) {
  while (*s == ' ') s++;
  if (*s == 0) return;

  if (sweeping) {
    sweeping = false;
    out.println("sweep 停止");
  }

  if (isdigit((unsigned char)*s)) {
    setLevel(atol(s));
  } else if (s[0] == 'f' && (s[1] == ' ' || s[1] == '=' || s[1] == '.' || isdigit((unsigned char)s[1]))) {
    float f = atof(s + 1 + (s[1] == ' ' || s[1] == '='));
    if (f < MIN_HZ || f > MAX_HZ) {
      out.printf("! 頻率範圍 %.2f ~ %.0f Hz\n", MIN_HZ, MAX_HZ);
      return;
    }
    freqHz = f;
    voltMode = false;
    applyFrequency();
    printStatus();
  } else if (s[0] == 'v' && (s[1] == ' ' || s[1] == '=' || s[1] == '.' || isdigit((unsigned char)s[1]))) {
    float v = atof(s + 1 + (s[1] == ' ' || s[1] == '='));
    if (v < 0 || v > VDD + 0.005f) {
      out.printf("! 電壓範圍 0 ~ %.2f V\n", VDD);
      return;
    }
    voltOut = min(v, VDD);
    applyVoltage();
    printStatus();
  } else if (!strncmp(s, "min", 3)) {
    minLevel = (uint16_t)constrain(atol(s + 3), 0L, 1023L);
    if (voltMode) exitVoltMode();
    else applyDuty();
    printStatus();
  } else if (!strcmp(s, "inv")) {
    activeLow = !activeLow;
    applyOutput();   // 電壓模式不受影響，回到 PWM 時才生效
    printStatus();
  } else if (!strcmp(s, "on")) {
    setLevel(1023);
  } else if (!strcmp(s, "off")) {
    setLevel(0);
  } else if (!strcmp(s, "sweep")) {
    sweeping = true;
    sweepLast = millis();
    out.printf("sweep: 每 %lu ms +%u，輸入任何東西停止\n", (unsigned long)SWEEP_MS, SWEEP_STEP);
    setLevel(0);
  } else if (!strcmp(s, "pin")) {
    printPinLevel();
  } else if (!strcmp(s, "pulse")) {
    pulseButton();
  } else if (!strcmp(s, "probe")) {
    probeLine();
  } else if (!strcmp(s, "s") || !strcmp(s, "?")) {
    printStatus();
    printHelp();
  } else {
    out.printf("? 看不懂: %s\n", s);
    printHelp();
  }
}

static void readSerial() {
  while (Serial.available() || Serial0.available()) {
    char c = (char)(Serial.available() ? Serial.read() : Serial0.read());
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
    out.println("sweep 完成 (停在 1023)");
    return;
  }
  setLevel(min(1023, level + SWEEP_STEP));
}

void setup() {
  pinMode(MIST_PIN, OUTPUT);
  digitalWrite(MIST_PIN, activeLow ? HIGH : LOW);  // 開機先關

  Serial.begin(115200);
  Serial0.begin(115200);
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 2000) delay(10);

  out.println();
  out.printf("霧化器 PWM 測試  GPIO%u\n", MIST_PIN);
  applyFrequency();
  printStatus();
  printHelp();
}

void loop() {
  readSerial();
  serviceSweep();
  serviceSoftwarePwm();
}
