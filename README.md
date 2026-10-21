# Online Multimeter

A responsive USB potentiometer dashboard for Arduino Uno R3, with live voltage, estimated resistance, electrical position, a 30-second graph, session statistics, hold/resume, CSV export and a clearly labeled demo mode. No backend or build dependencies.

## Connect your Uno

1. Confirm your potentiometer's outer terminals connect to **5V** and **GND**, and its wiper connects to **A0**. Keep the analog input within GND–5V.
2. Open `dist/OnlineMultimeter.ino` in Arduino IDE. Save it in a folder named `OnlineMultimeter` when prompted, select **Arduino Uno** and the correct port, then upload it.
3. Close Arduino Serial Monitor (it holds the port open).
4. Run `npm start` and open http://127.0.0.1:4173 in desktop Chrome or Edge. Alternatively deploy the contents of `dist` to any HTTPS static host.
5. Click **Connect Arduino**, select your Uno's port, and use **115200 baud** for the supplied sketch.
6. Enter the potentiometer's actual resistance rating. The default 10 kΩ is an example, not a measured value. The 5.00 V reference is nominal; enter the measured supply voltage for better voltage accuracy.

## Measurements

The Uno's 10-bit ADC produces 0–1023. Display conversion: voltage = raw / 1023 × reference; electrical position = raw / 1023 × 100%; estimated wiper-to-GND resistance = raw / 1023 × potentiometer rating. Assumes negligible wiper loading. Position describes voltage ratio; a logarithmic potentiometer will not correspond linearly to mechanical angle. Component tolerance, supply variation, ADC error and contact resistance affect accuracy. This circuit does not measure unknown resistance or current.

The serial protocol accepts one integer 0–1023 per newline, or JSON such as `{"raw":512}` per newline. Partial lines are buffered and malformed/overlong frames discarded. The supplied sketch sends at 20 Hz. Serial access requires HTTPS or localhost and a user-selected port in a compatible desktop browser. An embedded preview may block serial access; open the app directly in desktop Chrome/Edge.

## Session behavior

Readings stay in browser memory. The latest 10,000 samples are retained; reload clears them. CSV includes timestamp, source (demo or USB), raw ADC, voltage, position, resistance estimate and calibration settings. Hold pauses capture. Starting a new source or changing calibration clears the session to keep sources/settings separate. Export before changing these settings. After disconnecting, recorded samples remain available for export. Graph and statistics always use volts, regardless of the selected main readout.

## Development

`npm test` runs parser, conversion and chunk-boundary tests with Node's built-in test runner. `npm start` serves the static app at localhost:4173. The UI uses local CSS and JavaScript; Google Fonts is optional and falls back to installed fonts. No analytics or measurement uploads.

## GitHub Pages

For a public deployment, configure GitHub Pages to publish the `dist` directory through a deployment workflow, or upload the contents of `dist` to your preferred static host. Repository contents alone do not enable GitHub Pages.

## References

- [Web Serial API](https://developer.chrome.com/docs/capabilities/serial)
- [Arduino analogRead](https://docs.arduino.cc/language-reference/en/functions/analog-io/analogRead/)

