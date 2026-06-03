/* Extract battle animation sprites from video. */
import { execSync, execFileSync } from 'child_process';
import { mkdirSync, rmdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const VIDEO = 'c:/Users/12858/Downloads/A_cute_chibi_orange_Pochita_fr.mp4';
const OUT = join(import.meta.dirname, '..', 'assets', 'images');
const TMP = join(OUT, '.tmp_battle');
const FRAME_COUNT = 8;
const FRAME_W = 100;

console.log('Step 1: Extract frames...');
mkdirSync(TMP, { recursive: true });

const probeOut = execSync(`"${ffmpegPath}" -i "${VIDEO}" -f null NUL 2>&1`, { encoding: 'utf8', windowsHide: true });
const durMatch = probeOut.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
if (!durMatch) { console.error('Failed to parse duration'); process.exit(1); }
const duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3]);
console.log(`  Duration: ${duration.toFixed(2)}s`);

const skipStart = duration * 0.1, skipEnd = duration * 0.9;
const usable = skipEnd - skipStart, interval = usable / (FRAME_COUNT - 1);

for (let i = 0; i < FRAME_COUNT; i++) {
  const t = skipStart + i * interval;
  const outFile = join(TMP, `f${String(i).padStart(2,'0')}.png`);
  execFileSync(ffmpegPath, ['-ss', t.toFixed(3), '-i', VIDEO, '-frames:v', '1', '-q:v', '1', '-y', outFile], { stdio: 'ignore', windowsHide: true });
  console.log(`  Frame ${i+1}/${FRAME_COUNT} @ ${t.toFixed(2)}s`);
}

// Step 2: Green screen removal + bounding box
console.log('Step 2: Green screen removal...');
const frames = [];
let bbox = null;
const PAD = 6;

for (let i = 0; i < FRAME_COUNT; i++) {
  const fPath = join(TMP, `f${String(i).padStart(2,'0')}.png`);
  const { data, info } = await sharp(fPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixels = new Uint8Array(data);

  for (let j = 0; j < pixels.length; j += 4) {
    const r = pixels[j], g = pixels[j+1], b = pixels[j+2];
    if (g > r * 1.12 && g > b * 1.12 && g > 60) { pixels[j+3] = 0; }
    else if (g > r * 1.05 && g > b * 1.05 && g > 40) {
      pixels[j+3] = Math.round(pixels[j+3] * (1 - Math.min(1, (g - Math.max(r,b)) / 40) * 0.7));
    }
  }

  let top = height, bottom = 0, left = width, right = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (pixels[(y*width+x)*4+3] > 20) {
        if (y < top) top = y; if (y > bottom) bottom = y;
        if (x < left) left = x; if (x > right) right = x;
      }

  if (!bbox) bbox = { top, bottom, left, right };
  else {
    bbox.top = Math.min(bbox.top, top); bbox.bottom = Math.max(bbox.bottom, bottom);
    bbox.left = Math.min(bbox.left, left); bbox.right = Math.max(bbox.right, right);
  }
  frames.push({ pixels, width, height });
}

bbox.top = Math.max(0, bbox.top - PAD); bbox.bottom = Math.min(frames[0].height-1, bbox.bottom + PAD);
bbox.left = Math.max(0, bbox.left - PAD); bbox.right = Math.min(frames[0].width-1, bbox.right + PAD);
const cropW = bbox.right - bbox.left + 1, cropH = bbox.bottom - bbox.top + 1;
const displayH = Math.round(FRAME_W * cropH / cropW);
console.log(`  Crop: ${cropW}x${cropH} → Display: ${FRAME_W}x${displayH}`);

// Step 3: Build sprite sheet
console.log('Step 3: Build sprite sheet...');
const composites = [];
for (let i = 0; i < FRAME_COUNT; i++) {
  const { pixels, width } = frames[i];
  const cropRaw = new Uint8Array(cropW * cropH * 4);
  for (let y = bbox.top; y <= bbox.bottom; y++) {
    cropRaw.set(pixels.subarray((y*width+bbox.left)*4, (y*width+bbox.left)*4 + cropW*4), (y-bbox.top)*cropW*4);
  }
  const buf = await sharp(cropRaw, { raw: { width: cropW, height: cropH, channels: 4 } })
    .resize(FRAME_W, displayH, { kernel: 'lanczos3' }).png().toBuffer();
  composites.push({ input: buf, left: i * FRAME_W, top: 0 });
}

const outPath = join(OUT, 'pochita_battle_walk.png');
await sharp({ create: { width: FRAME_W * FRAME_COUNT, height: displayH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(composites).png().toFile(outPath);
console.log(`  Saved: ${outPath} (${FRAME_W*FRAME_COUNT}x${displayH})`);

// Cleanup
for (let i = 0; i < FRAME_COUNT; i++) unlinkSync(join(TMP, `f${String(i).padStart(2,'0')}.png`));
rmdirSync(TMP);
console.log('Done!');
