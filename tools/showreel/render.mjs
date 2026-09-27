// Renders index.html frame by frame and encodes it with the soundtrack.
//   node render.mjs --stills 2,6.5,15     a few frames to PNG, for checking
//   node render.mjs                        the full video: out/tekjobs-showreel.mp4
//   add --vertical for the 9:16 cut:       out/tekjobs-showreel-vertical.mp4
//   node render.mjs --posters              the site poster and the README poster
// ffmpeg: FFMPEG env var, else the one imageio-ffmpeg installs, else ffmpeg on PATH.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('../../app/node_modules/playwright');
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const FPS = 30, DURATION = 45, WORKERS = Math.min(6, os.cpus().length);
const args = process.argv.slice(2);
const VERT = args.includes('--vertical');
const [W, H] = VERT ? [1080, 1920] : [1920, 1080];
const stills = args.includes('--stills') ? args[args.indexOf('--stills') + 1].split(',').map(Number) : null;
const framesDir = (process.env.FRAMES_DIR || join(here, 'out', 'frames')) + (VERT ? '-vertical' : '');
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execSync('python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim(); } catch { return 'ffmpeg'; }
}

const url = pathToFileURL(join(here, 'index.html')).href + '?render' + (VERT ? '&format=vertical' : '');
const browser = await chromium.launch();
async function page() {
  const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('page error:', e.message));
  await p.goto(url);
  await p.evaluate(() => window.ready);
  return p;
}

if (stills) {
  const p = await page();
  for (const t of stills) {
    await p.evaluate(t => window.render(t), t);
    await p.screenshot({ path: join(outDir, `still${VERT ? '-v' : ''}-${String(t).replace('.', '_')}.png`) });
  }
  await browser.close();
  console.log('stills written to', outDir);
  process.exit(0);
}

// The posters: the score frame for the site's <video>, and the end card with a watch pill for the README,
// where a video cannot play and the image links to the site instead.
if (args.includes('--posters')) {
  const p = await page();
  await p.evaluate(() => window.render(17.5));
  await p.screenshot({ path: join(outDir, 'tekjobs-showreel-poster.png') });
  await p.evaluate(() => {
    window.render(44.9);
    const pill = document.createElement('div');
    pill.innerHTML = '<span style="display:inline-block;width:0;height:0;border-left:22px solid #08120c;border-top:13px solid transparent;border-bottom:13px solid transparent;margin-right:18px"></span>Watch the 45-second showreel';
    pill.style.cssText = 'position:absolute;left:50%;top:958px;transform:translateX(-50%);display:flex;align-items:center;height:72px;padding:0 34px;border-radius:6px;background:#c8f542;color:#08120c;font-family:"Azeret Mono",monospace;font-weight:600;font-size:26px;letter-spacing:.06em;white-space:nowrap';
    document.getElementById('stage').appendChild(pill);
  });
  await p.screenshot({ path: join(outDir, 'tekjobs-showreel-readme.png') });
  await browser.close();
  console.log('posters written to', outDir);
  process.exit(0);
}

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
const total = FPS * DURATION;
let done = 0;
const started = Date.now();
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const p = await page();
  for (let i = w; i < total; i += WORKERS) {
    await p.evaluate(t => window.render(t), i / FPS);
    const buf = await p.screenshot({ type: 'png' });
    writeFileSync(join(framesDir, `f_${String(i).padStart(5, '0')}.png`), buf);
    if (++done % 90 === 0) console.log(`${done}/${total} frames · ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  await p.close();
}));
await browser.close();

const ff = ffmpegPath();
const audio = join(outDir, 'music.wav');
const out = join(outDir, VERT ? 'tekjobs-showreel-vertical.mp4' : 'tekjobs-showreel.mp4');
const a = ['-y', '-framerate', String(FPS), '-i', join(framesDir, 'f_%05d.png')];
if (existsSync(audio)) a.push('-i', audio);
a.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-tune', 'animation');
if (existsSync(audio)) a.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
a.push('-movflags', '+faststart', out);
const r = spawnSync(ff, a, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('wrote', out);
