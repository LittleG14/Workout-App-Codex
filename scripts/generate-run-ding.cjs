// Original short synthesized chime; deterministic local asset, no third-party recording.
const fs = require('node:fs');
const path = require('node:path');
const rate = 22050, frames = Math.round(rate * 0.4), bytes = Buffer.alloc(44 + frames * 2);
bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
bytes.write('data', 36); bytes.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) {
  const t = i / rate, envelope = Math.min(1, t / 0.008) * Math.exp(-10 * t) * Math.min(1, (0.4 - t) / 0.025);
  bytes.writeInt16LE(Math.round(10000 * envelope * (0.7 * Math.sin(2 * Math.PI * 880 * t) + 0.3 * Math.sin(2 * Math.PI * 1320 * t))), 44 + i * 2);
}
const target = path.join(__dirname, '../modules/swole-run-audio/ios/Resources/run-ding.wav');
fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
