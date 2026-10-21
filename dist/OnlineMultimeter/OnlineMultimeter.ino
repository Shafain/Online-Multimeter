// Uno R3: six independent analog channels. External measurement circuits are required.
// Keep every analog input between GND and 5V. Never connect mains or negative voltage.
// Close Serial Monitor before using the browser. JSON is sent at 115200 baud.
const uint8_t inputs[] = {A0, A1, A2, A3, A4, A5};
unsigned long lastSample = 0;
void setup() { Serial.begin(115200); }
void loop() {
  if (millis() - lastSample < 50) return;
  lastSample = millis();
  Serial.print('{');
  for (uint8_t i = 0; i < 6; i++) {
    if (i) Serial.print(',');
    analogRead(inputs[i]); // Discard first sample after switching the ADC multiplexer.
    int raw = analogRead(inputs[i]);
    Serial.print("\"A"); Serial.print(i); Serial.print("\":"); Serial.print(raw);
  }
  Serial.println('}');
}
