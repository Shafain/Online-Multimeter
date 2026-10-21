# Online Multimeter

An oscilloscope-style dark digital bench instrument for Arduino Uno R3: a large instrument display, function selector, six selectable analog channels, measurement history, min/max/average, hold, demo, and CSV export. No build dependencies or telemetry.

## Start

In the folder containing package.json, run `npm.cmd start` on Windows (`npm start` elsewhere). Open http://127.0.0.1:4173 in desktop Chrome or Edge and leave the terminal open. If port 4173 is already used, open the existing app or stop its server before starting another. HTTPS static hosting also works.

Upload `dist/OnlineMultimeter/OnlineMultimeter.ino` with Arduino IDE to stream A0–A5 at 115200 baud, then close Serial Monitor. The old integer-only sketch remains compatible with A0. Select the actual wired input; floating inputs are not valid measurements.

## Capabilities and limits

- DC voltage: direct 0–5 V ADC input or a user-configured external divider.
- DC current: configurable linear analog-output current sensor. Zero voltage, sensitivity and current limit must match the actual sensor.
- Resistance: known-reference divider on an unpowered, isolated component; not the old potentiometer resistance estimate.
- Continuity: visual resistance threshold with the same divider circuit.
- Potentiometer: electrical position in percent.
- AC/advanced: explicitly unavailable. RMS AC, frequency, capacitance, diode testing, and hardware autoranging are not implemented.

Read `dist/hardware.html` before wiring. Additional modes require matching external hardware and explicit setup confirmation. Selecting a mode does not switch wiring or provide input protection. This software and an Uno alone are not a protected, calibrated, safety-rated multimeter. Do not connect mains, negative voltage, signals above 5 V, or motor spikes directly. Battery/motor circuits need suitable protection and current-limited development practices.

Resistance topology: Uno 5V → known resistor → ADC node → unknown resistor → GND. Uses the same supply for ADC reference and excitation. Current: I = (ADC voltage − sensor zero voltage) / sensitivity. Divider voltage: V = raw / 1023 × reference × multiplier. Enter actual calibrated parameters; defaults are examples, not detected hardware. Accuracy is limited by the ADC, supply, resistors/sensors, wiring and loading. No automatic sensor identification is performed.

## Data

Firmware sends newline-delimited JSON, e.g. `{"A0":512,"A1":128,"A2":0,"A3":0,"A4":0,"A5":0}`. Legacy integer lines or `{"raw":512}` map to A0. Frames can arrive fragmented; invalid values and overlong frames are discarded. ADC readings must be integer 0–1023.

Only the selected channel is recorded. Measurements and graph units follow the selected function. OL indicates an unusable/saturated measurement. Stats exclude invalid measurements; CSV retains their status and raw ADC. Configuration changes, mode changes, channel changes and source changes clear the recording to avoid mixing units/calibrations. Hold pauses recording. The latest 10,000 samples stay in memory; reload clears them. Export before changing setup. CSV includes source, mode, channel, value, unit, raw data and calibration. Demo is always labeled simulated.

## Development

`npm test` runs Node tests covering serial parsing, fragmentation, invalid frames, physical conversions, required configurations and over-range behavior. `node --check dist/app.js` checks UI syntax. Firmware has not been compiled or tested on physical hardware in this environment. The hosted copy must be separately redeployed after repository changes; a GitHub commit does not automatically update it.
