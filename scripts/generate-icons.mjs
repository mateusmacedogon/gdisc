import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pngToIco from 'png-to-ico';

function drawGDisCIcon(size) {
  const png = new PNG({ width: size, height: size });
  const center = size / 2;
  const radius = size * 0.44;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check rounded rect boundaries for outer app icon
      const rx = Math.max(0, Math.abs(dx) - (center - cornerRadius));
      const ry = Math.max(0, Math.abs(dy) - (center - cornerRadius));
      const cornerDist = Math.sqrt(rx * rx + ry * ry);

      if (cornerDist > cornerRadius) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      // Default dark base #0B0D12
      let r = 11, g = 13, b = 18, a = 255;

      if (dist <= radius) {
        // Linear / radial gradient from #7971FE (121, 113, 254) to #4F46E5 (79, 70, 229)
        const t = (x + y) / (size * 2);
        r = Math.round(121 * (1 - t) + 79 * t);
        g = Math.round(113 * (1 - t) + 70 * t);
        b = Math.round(254 * (1 - t) + 229 * t);

        // Center Radio Node (radius * 0.22)
        const coreDist = dist / radius;
        if (coreDist <= 0.18) {
          // Inner purple dot
          r = 108; g = 99; b = 255;
        } else if (coreDist <= 0.32) {
          // Inner white ring
          r = 255; g = 255; b = 255;
        }

        // Concentric Radio Waves
        // Left & Right arcs at coreDist ~ 0.55 and ~ 0.78
        const angle = Math.atan2(dy, dx);
        const isLeftOrRight = Math.abs(Math.cos(angle)) > 0.45;

        if (isLeftOrRight) {
          // Wave 1
          if (Math.abs(coreDist - 0.55) < 0.08) {
            const alpha = 1 - Math.abs(coreDist - 0.55) / 0.08;
            r = Math.round(r * (1 - alpha) + 255 * alpha);
            g = Math.round(g * (1 - alpha) + 255 * alpha);
            b = Math.round(b * (1 - alpha) + 255 * alpha);
          }
          // Wave 2
          if (Math.abs(coreDist - 0.8) < 0.06) {
            const alpha = (1 - Math.abs(coreDist - 0.8) / 0.06) * 0.8;
            r = Math.round(r * (1 - alpha) + 255 * alpha);
            g = Math.round(g * (1 - alpha) + 255 * alpha);
            b = Math.round(b * (1 - alpha) + 255 * alpha);
          }
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return PNG.sync.write(png);
}

async function run() {
  const desktopAssets = path.resolve('apps/desktop/assets');
  const clientPublic = path.resolve('apps/client/public');
  const tauriIcons = path.resolve('apps/client/src-tauri/icons');

  if (!fs.existsSync(desktopAssets)) fs.mkdirSync(desktopAssets, { recursive: true });
  if (!fs.existsSync(clientPublic)) fs.mkdirSync(clientPublic, { recursive: true });
  if (!fs.existsSync(tauriIcons)) fs.mkdirSync(tauriIcons, { recursive: true });

  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = [];

  for (const s of sizes) {
    const buf = drawGDisCIcon(s);
    fs.writeFileSync(path.join(desktopAssets, `icon_${s}.png`), buf);
    if ([32, 128, 256].includes(s)) {
      fs.writeFileSync(
        path.join(tauriIcons, s === 256 ? '128x128@2x.png' : `${s}x${s}.png`),
        buf,
      );
    }
    pngBuffers.push(path.join(desktopAssets, `icon_${s}.png`));
  }

  // 256 as icon.png
  const icon256 = drawGDisCIcon(256);
  fs.writeFileSync(path.join(desktopAssets, 'icon.png'), icon256);
  fs.writeFileSync(path.join(clientPublic, 'icon.png'), icon256);

  // Windows .ico
  const icoBuf = await pngToIco(pngBuffers);
  fs.writeFileSync(path.join(desktopAssets, 'icon.ico'), icoBuf);
  fs.writeFileSync(path.join(clientPublic, 'favicon.ico'), icoBuf);
  fs.writeFileSync(path.join(tauriIcons, 'icon.ico'), icoBuf);

  console.log('✅ Ícones PNG e ICO de alta fidelidade gerados com sucesso!');
}

run().catch(console.error);
