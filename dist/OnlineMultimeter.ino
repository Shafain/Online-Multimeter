// Arduino Uno R3: potentiometer wiper on A0, outer terminals on 5V and GND.
// Upload with Arduino IDE, then close Serial Monitor before connecting the web app.
const uint8_t POT_PIN = A0;
unsigned long lastSample = 0;
void setup() { Serial.begin(115200); }
void loop() {
  if (millis() - lastSample >= 50) {
    lastSample = millis();
    Serial.println(analogRead(POT_PIN));
  }
}
