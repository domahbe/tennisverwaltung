/**
 * Erzeugt PNG-App-Icons ohne externe Abhängigkeiten (reines Node + zlib).
 * Motiv: Apple-Blue-Kachel mit Tennisball und weißen Nähten.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c,
    table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size, rounded) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const ballR = size * 0.27;
  const cornerR = size * 0.225;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Hintergrund: Verlauf von #0A84FF nach #007AFF
      const t = (x + y) / (2 * size);
      let r = Math.round(10 - 10 * t);
      let g = Math.round(132 - 10 * t);
      let b = 255;
      let a = 255;

      if (rounded) {
        // abgerundete Ecken (Superellipse-Annäherung)
        const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerR));
        const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerR));
        if (dx * dx + dy * dy > cornerR * cornerR) a = 0;
      }

      // Tennisball
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < ballR) {
        r = 223;
        g = 255;
        b = 79;
        // Nähte: zwei vertikale Bögen
        for (const sx of [cx - ballR * 0.72, cx + ballR * 0.72]) {
          const arc = Math.sqrt((x - sx) ** 2 * 0.55 + (y - cy) ** 2 * 0.12);
          if (Math.abs(arc - ballR * 0.55) < size * 0.012) {
            r = 255;
            g = 255;
            b = 255;
          }
        }
        // leichte Schattierung rechts unten
        if ((x - cx) + (y - cy) > ballR * 0.7) {
          r = Math.round(r * 0.93);
          g = Math.round(g * 0.93);
        }
      }

      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }

  // Scanlines mit Filterbyte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), makePng(192, true));
fs.writeFileSync(path.join(out, 'icon-512.png'), makePng(512, false)); // maskable: volle Fläche
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), makePng(180, false)); // iOS rundet selbst
console.log('Icons erzeugt:', fs.readdirSync(out).join(', '));
