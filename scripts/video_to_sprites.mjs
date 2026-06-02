/* Extract frames from walking video, remove green screen, build sprite sheet. */
import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, rmdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEO = 'c:/Users/12858/Downloads/A_cute_chibi_orange_Pochita_fr (1).mp4';
const TMP = join(__dirname, '..', 'assets', 'images', '.tmp_frames');
const OUT = join(__dirname, '..', 'assets', 'images');
const FRAME_COUNT = 8;
const FRAME_W = 100;

console.log('Step 1: Extract frames from video...');
mkdirSync(TMP, { recursive: true });

// Get video duration via ffmpeg (info is on stderr, redirect to stdout)
const probeOut = execSync(`"${ffmpegPath}" -i "${VIDEO}" -f null - 2>&1`, { encoding: 'utf8' });
const durMatch = probeOut.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
if (!durMatch) {
  console.error('Could not parse video duration');
  process.exit(1);
}
const duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3]);
console.log(`  Duration: ${duration.toFixed(2)}s`);

// Extract evenly spaced frames
const skipStart = duration * 0.15;
const skipEnd = duration * 0.85;
const usable = skipEnd - skipStart;
const interval = usable / (FRAME_COUNT - 1);

for (let i = 0; i < FRAME_COUNT; i++) {
  const t = skipStart + i * interval;
  const outFile = join(TMP, `frame_${String(i).padStart(2, '0')}.png`);
  execFileSync(ffmpegPath, [
    '-ss', t.toFixed(3),
    '-i', VIDEO,
    '-frames:v', '1',
    '-q:v', '1',
    '-y',
    outFile
  ], { stdio: 'ignore' });
  console.log(`  Frame ${i+1}/${FRAME_COUNT} @ ${t.toFixed(2)}s`);
}

// Step 2: Process frames - remove green screen, crop, resize
console.log('Step 2: Process frames (green screen removal)...');
const frames = [];
let globalBBox = null; // { top, bottom, left, right }

for (let i = 0; i < FRAME_COUNT; i++) {
  const fPath = join(TMP, `frame_${String(i).padStart(2, '0')}.png`);
  const { data, info } = await sharp(fPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixels = new Uint8Array(data);

  // Green screen detection
  for (let j = 0; j < pixels.length; j += 4) {
    const r = pixels[j], g = pixels[j+1], b = pixels[j+2];
    // Green is dominant
    if (g > r * 1.12 && g > b * 1.12 && g > 60) {
      pixels[j+3] = 0;
    }
    // Clean up near-green fringe
    else if (g > r * 1.05 && g > b * 1.05 && g > 40) {
      const greenness = Math.min(1, (g - Math.max(r, b)) / 40);
      pixels[j+3] = Math.round(pixels[j+3] * (1 - greenness * 0.7));
    }
  }

  // Find bounding box of non-transparent pixels
  let top = height, bottom = 0, left = width, right = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx+3] > 20) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (globalBBox === null) {
    globalBBox = { top, bottom, left, right };
  } else {
    globalBBox.top = Math.min(globalBBox.top, top);
    globalBBox.bottom = Math.max(globalBBox.bottom, bottom);
    globalBBox.left = Math.min(globalBBox.left, left);
    globalBBox.right = Math.max(globalBBox.right, right);
  }

  frames.push({ pixels, width, height });
}

// Add padding
const PAD = 6;
globalBBox.top = Math.max(0, globalBBox.top - PAD);
globalBBox.bottom = Math.min(frames[0].height - 1, globalBBox.bottom + PAD);
globalBBox.left = Math.max(0, globalBBox.left - PAD);
globalBBox.right = Math.min(frames[0].width - 1, globalBBox.right + PAD);

const cropW = globalBBox.right - globalBBox.left + 1;
const cropH = globalBBox.bottom - globalBBox.top + 1;
const displayH = Math.round(FRAME_W * cropH / cropW);
console.log(`  Crop: ${cropW}x${cropH} → Display: ${FRAME_W}x${displayH}`);

// Step 3: Crop, resize, and build sprite sheet
console.log('Step 3: Build sprite sheet...');
const spriteW = FRAME_W * FRAME_COUNT;
const sprite = await sharp({
  create: { width: spriteW, height: displayH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
});

const composites = [];
for (let i = 0; i < FRAME_COUNT; i++) {
  const { pixels, width } = frames[i];
  // Extract cropped region
  const cropRaw = new Uint8Array(cropW * cropH * 4);
  for (let y = globalBBox.top; y <= globalBBox.bottom; y++) {
    const srcOff = (y * width + globalBBox.left) * 4;
    const dstOff = ((y - globalBBox.top) * cropW) * 4;
    cropRaw.set(pixels.subarray(srcOff, srcOff + cropW * 4), dstOff);
  }

  const buf = await sharp(cropRaw, { raw: { width: cropW, height: cropH, channels: 4 } })
    .resize(FRAME_W, displayH, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  composites.push({ input: buf, left: i * FRAME_W, top: 0 });
}

const walkPath = join(OUT, 'pochita_walk.png');
await sharp({
  create: { width: spriteW, height: displayH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
}).composite(composites).png().toFile(walkPath);

console.log(`  Saved: pochita_walk.png (${spriteW}x${displayH})`);

// Cleanup
for (let i = 0; i < FRAME_COUNT; i++) {
  unlinkSync(join(TMP, `frame_${String(i).padStart(2, '0')}.png`));
}
rmdirSync(TMP);
console.log('Done!');
