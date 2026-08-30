import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

function drawGDisCIcon(size, isRound = false) {
  const png = new PNG({ width: size, height: size });
  const center = size / 2;
  const radius = size * 0.44;
  const cornerRadius = isRound ? size * 0.5 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isRound) {
        if (dist > center) {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
          continue;
        }
      } else {
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
      }

      // Default dark base #0B0D12
      let r = 11, g = 13, b = 18, a = 255;

      if (dist <= radius) {
        // Gradient from #7971FE to #4F46E5
        const t = (x + y) / (size * 2);
        r = Math.round(121 * (1 - t) + 79 * t);
        g = Math.round(113 * (1 - t) + 70 * t);
        b = Math.round(254 * (1 - t) + 229 * t);

        // Core Radio Node
        const coreDist = dist / radius;
        if (coreDist <= 0.18) {
          r = 108; g = 99; b = 255;
        } else if (coreDist <= 0.32) {
          r = 255; g = 255; b = 255;
        }

        // Concentric Radio Waves
        const angle = Math.atan2(dy, dx);
        const isLeftOrRight = Math.abs(Math.cos(angle)) > 0.45;

        if (isLeftOrRight) {
          if (Math.abs(coreDist - 0.55) < 0.08) {
            const alpha = 1 - Math.abs(coreDist - 0.55) / 0.08;
            r = Math.round(r * (1 - alpha) + 255 * alpha);
            g = Math.round(g * (1 - alpha) + 255 * alpha);
            b = Math.round(b * (1 - alpha) + 255 * alpha);
          }
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

function run() {
  const baseResDir = path.resolve('apps/mobile/android/app/src/main/res');

  const densities = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const d of densities) {
    const dir = path.join(baseResDir, d.name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Standard Launcher Icon
    const standardIcon = drawGDisCIcon(d.size, false);
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), standardIcon);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), standardIcon);

    // Round Launcher Icon
    const roundIcon = drawGDisCIcon(d.size, true);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), roundIcon);
  }

  console.log('✅ Ícones adaptativos do Android gerados com sucesso em todas as densidades (mdpi até xxxhdpi)!');
}

run();
