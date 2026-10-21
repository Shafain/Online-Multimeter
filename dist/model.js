export function parseReading(line) {
  const text = line.trim();
  if (!text) return null;
  let value;
  try { value = text.startsWith('{') ? JSON.parse(text).raw : (/^\d+$/.test(text) ? Number(text) : NaN); } catch { return null; }
  return Number.isInteger(value) && value >= 0 && value <= 1023 ? value : null;
}
export function measure(raw, reference, resistance) {
  const ratio = raw / 1023;
  return {raw, voltage: ratio * reference, percent: ratio * 100, resistance: ratio * resistance};
}
export function lineBuffer(onLine) {
  let pending = '', discarding = false;
  return chunk => {
    for (const char of chunk) {
      if (char === '\n') { if (!discarding) onLine(pending); pending = ''; discarding = false; }
      else if (!discarding) { pending += char; if (pending.length > 512) { pending = ''; discarding = true; } }
    }
  };
}
