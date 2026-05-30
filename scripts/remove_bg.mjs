import sharp from 'sharp';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = join(__dirname, '..', 'assets', 'images');

const BG = [26, 26, 26];       // target dark background RGB
const THRESHOLD = 55;           // max color distance for full transparency
const FEATHER = 15;             // transition zone

function dist(r, g, b) {
  return Math.abs(r - BG[0]) + Math.abs(g - BG[1]) + Math.abs(b - BG[2]);
}

async function processImage(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels = 4 (RGBA)
  const pixels = new Uint8Array(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const d = dist(r, g, b);

    if (d <= THRESHOLD) {
      pixels[i + 3] = 0; // fully transparent
    } else if (d <= THRESHOLD + FEATHER) {
      pixels[i + 3] = Math.round(255 * (d - THRESHOLD) / FEATHER);
    }
    // else: keep existing alpha (255)
  }

  await sharp(pixels, { raw: { width, height, channels } })
    .png()
    .toFile(filePath + '.tmp');

  // Replace original
  const { rename } = await import('fs/promises');
  await rename(filePath + '.tmp', filePath);
}

async function main() {
  const files = (await readdir(IMG_DIR))
    .filter(f => f.startsWith('makima_') && f.endsWith('.png'))
    .sort();

  console.log(`Processing ${files.length} images...`);
  for (const f of files) {
    const p = join(IMG_DIR, f);
    await processImage(p);
    console.log(`  ${f}  done`);
  }
  console.log('All done.');
}

main().catch(e => { console.error(e); process.exit(1); });
