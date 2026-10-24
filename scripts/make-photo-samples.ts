// scripts/make-photo-samples.ts
// Builds the demo photo sets from four real photos of a Goa rental Honda Activa
// (assets/photo-src, CC0 from Wikimedia Commons, see README). Run: npm run samples:make
//
// For each of the three fleet scooters it:
// - swaps the rental shop's sticker (it carries real phone numbers) for a generic one,
// - repaints the plate number (GA 07 M 2211 / 5141 / 5142),
// - writes a clean pickup set and return sets with no damage, a scratch, or a dent.
// The scenario is never written on the image, so a model cannot read the answer off it.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import type { Sharp } from 'sharp';

import { ANGLES } from '../lib/photos.ts';
import type { Angle, SampleSet, SampleVehicleKey } from '../lib/photos.ts';

const SRC = fileURLToPath(new URL('../assets/photo-src/', import.meta.url));
const OUT = fileURLToPath(new URL('../assets/samples/', import.meta.url));

/** Output size: the app shows photos at 4:3. */
const OUT_W = 1280;
const OUT_H = 960;

type Fleet = { key: SampleVehicleKey; plateLine2: string };

const FLEET: Fleet[] = [
  { key: 'fleet1', plateLine2: 'T 5140' },
  { key: 'fleet2', plateLine2: 'T 5141' },
  { key: 'fleet3', plateLine2: 'T 5142' },
];

type Damage = 'none' | 'scratch' | 'dent';

const SETS: { set: SampleSet; damage: Damage; isReturn: boolean }[] = [
  { set: 'pickup', damage: 'none', isReturn: false },
  { set: 'no-damage', damage: 'none', isReturn: true },
  { set: 'light-scratch', damage: 'scratch', isReturn: true },
  { set: 'dented-panel', damage: 'dent', isReturn: true },
];

/** Overlay coordinates below are in pixels of each photo scaled to 1920 px wide. */
const GEOMETRY_WIDTH = 1920;
const PLATE_YELLOW = '#f1c232';
const PLATE_FONT = "font-family=\"Arial Black, Arial, Helvetica, sans-serif\" font-weight=\"900\"";

function svg(width: number, height: number, body: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}

/** Generic rental sticker over the original one (which shows a real business's phone numbers). */
function sticker(cx: number, cy: number, rx: number, ry: number, rotate: number): string {
  return `
    <g transform="rotate(${rotate} ${cx} ${cy})">
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f4f4f2" stroke="#c9c9c6" stroke-width="3"/>
      <text x="${cx}" y="${cy - ry * 0.12}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="${ry * 0.48}" fill="#1d4fa8">I INSPECT</text>
      <text x="${cx}" y="${cy + ry * 0.45}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="${ry * 0.36}" fill="#333">RENTALS · DEMO</text>
    </g>`;
}

/** Black plate patch with yellow two-line number, optionally rotated to follow the plate. */
function plate(cx: number, cy: number, w: number, h: number, rotate: number, line2: string, size1: number, size2: number): string {
  return `
    <g transform="rotate(${rotate} ${cx} ${cy})">
      <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8" fill="#141414"/>
      <text x="${cx}" y="${cy - h * 0.06}" text-anchor="middle" ${PLATE_FONT} font-size="${size1}" fill="${PLATE_YELLOW}">GA 06</text>
      <text x="${cx}" y="${cy + h * 0.42}" text-anchor="middle" ${PLATE_FONT} font-size="${size2}" fill="${PLATE_YELLOW}">${line2}</text>
    </g>`;
}

/** Small seeded random generator, so every run draws the same damage. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A key-scrape on matte paint: a cluster of fine, slightly curved hairlines running roughly the same
 * way, each fading in and out, with a faint dark edge where the paint is gouged.
 */
function scratch(x: number, y: number, len: number, angle: number): string {
  const random = seeded(7);
  const lines: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    const start = random() * len * 0.35;
    const length = len * (0.25 + random() * 0.65);
    const offset = (random() - 0.5) * 34;
    const tilt = (random() - 0.5) * 0.12;
    const bend = (random() - 0.5) * 10;
    const x1 = x + start;
    const y1 = y + offset;
    const x2 = x1 + length;
    const y2 = y1 + length * tilt;
    const width = 0.7 + random() * 1.6;
    const opacity = 0.35 + random() * 0.5;
    const d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${((x1 + x2) / 2).toFixed(1)},${((y1 + y2) / 2 + bend).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    lines.push(`
      <path d="${d}" stroke="#3a3a3a" stroke-opacity="${(opacity * 0.35).toFixed(2)}" stroke-width="${(width + 1.2).toFixed(1)}" fill="none" transform="translate(0.8 1.2)" mask="url(#fade)"/>
      <path d="${d}" stroke="#ecebe6" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(1)}" fill="none" stroke-linecap="round" mask="url(#fade)"/>`);
  }
  return `
    <defs>
      <linearGradient id="fadeGrad" x1="${x}" y1="0" x2="${x + len}" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset="0.18" stop-color="#fff" stop-opacity="1"/>
        <stop offset="0.75" stop-color="#fff" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <mask id="fade" maskUnits="userSpaceOnUse" x="${x - 20}" y="${y - 120}" width="${len + 60}" height="240">
        <rect x="${x - 20}" y="${y - 120}" width="${len + 60}" height="240" fill="url(#fadeGrad)"/>
      </mask>
      <filter id="hair"><feGaussianBlur stdDeviation="0.45"/></filter>
    </defs>
    <g filter="url(#hair)" transform="rotate(${angle} ${x} ${y})">${lines.join('')}</g>`;
}

/**
 * A pushed-in panel on matte paint under daylight: the hollow's upper wall faces down and goes dark,
 * its lower wall faces up and catches light. Irregular, soft-edged shapes and a couple of faint creases.
 */
function dent(cx: number, cy: number, rx: number, ry: number): string {
  const random = seeded(11);
  const blob = (scale: number, dx: number, dy: number): string => {
    const points = Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * Math.PI * 2;
      const r = scale * (0.8 + random() * 0.35);
      return `${(cx + dx + Math.cos(a) * rx * r).toFixed(1)},${(cy + dy + Math.sin(a) * ry * r).toFixed(1)}`;
    });
    return `M${points.join(' L')} Z`;
  };
  return `
    <defs>
      <filter id="dentSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="dentMid" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
      <filter id="dentEdge"><feGaussianBlur stdDeviation="1.6"/></filter>
    </defs>
    <path d="${blob(1, 0, -ry * 0.1)}" fill="#000" fill-opacity="0.42" filter="url(#dentSoft)"/>
    <path d="${blob(0.55, -rx * 0.05, -ry * 0.3)}" fill="#000" fill-opacity="0.5" filter="url(#dentMid)"/>
    <path d="${blob(0.5, rx * 0.1, ry * 0.45)}" fill="#fff" fill-opacity="0.38" filter="url(#dentMid)"/>
    <g stroke="#1a1a1a" stroke-opacity="0.4" stroke-width="2.4" fill="none" filter="url(#dentEdge)">
      <path d="M${cx - rx * 0.55},${cy + ry * 0.1} q${rx * 0.3},${ry * 0.22} ${rx * 0.62},${ry * 0.08}"/>
      <path d="M${cx + rx * 0.1},${cy + ry * 0.48} q${rx * 0.22},-${ry * 0.1} ${rx * 0.38},-${ry * 0.4}"/>
    </g>
    `;
}

/** Everything drawn on one angle's photo for one scooter and one set. */
function overlay(angle: Angle, fleet: Fleet, damage: Damage): string {
  const keepPlate = fleet.plateLine2 === 'T 5140';
  switch (angle) {
    case 'front':
      return [
        sticker(980, 765, 150, 82, -2),
        keepPlate ? '' : plate(975, 952, 318, 170, -1, fleet.plateLine2, 70, 92),
        '',
      ].join('');
    case 'rear':
      return [
        sticker(912, 1172, 118, 70, -12),
        keepPlate ? '' : plate(1075, 2005, 470, 245, -9, fleet.plateLine2, 108, 134),
      ].join('');
    case 'left':
      if (damage === 'scratch') return scratch(1120, 820, 330, -9);
      return damage === 'dent' ? dent(1330, 800, 165, 92) : '';
    case 'right':
      return '';
  }
}

/** Fits any photo into 4:3: landscape photos are cropped, portrait ones sit on a blurred copy of themselves. */
async function toFourByThree(input: Buffer): Promise<Sharp> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? OUT_W;
  const height = meta.height ?? OUT_H;
  if (width / height >= OUT_W / OUT_H) {
    return sharp(input).resize(OUT_W, OUT_H, { fit: 'cover', position: 'attention' });
  }
  const background = await sharp(input).resize(OUT_W, OUT_H, { fit: 'cover' }).blur(28).modulate({ brightness: 0.55 }).toBuffer();
  const foreground = await sharp(input).resize({ height: OUT_H }).toBuffer();
  const fgWidth = (await sharp(foreground).metadata()).width ?? OUT_W;
  return sharp(background).composite([{ input: foreground, left: Math.round((OUT_W - fgWidth) / 2), top: 0 }]);
}

async function render(angle: Angle, fleet: Fleet, damage: Damage, isReturn: boolean): Promise<Sharp> {
  const source = sharp(`${SRC}${angle}.jpg`);
  const { width = 1920, height = 1440 } = await source.metadata();
  const drawn = overlay(angle, fleet, damage);
  // Overlay coordinates were measured with every photo 1920 px wide; scale them to this file.
  const scale = width / GEOMETRY_WIDTH;
  let edited = drawn
    ? await source.composite([{ input: svg(width, height, `<g transform="scale(${scale})">${drawn}</g>`) }]).toBuffer()
    : await source.toBuffer();
  // Return photos are taken later: a touch warmer and darker.
  if (isReturn) edited = await sharp(edited).linear([1.0, 0.97, 0.92], [0, 0, 0]).modulate({ brightness: 0.97 }).toBuffer();
  return toFourByThree(edited);
}

async function main(): Promise<void> {
  let count = 0;
  for (const fleet of FLEET) {
    for (const { set, damage, isReturn } of SETS) {
      const dir = `${OUT}${fleet.key}/${set}/`;
      mkdirSync(dir, { recursive: true });
      for (const angle of ANGLES) {
        const image = await render(angle, fleet, damage, isReturn);
        await image.jpeg({ quality: 84, mozjpeg: true }).toFile(`${dir}${angle}.jpg`);
        count += 1;
      }
    }
  }
  console.log(`samples:make: wrote ${count} photos to assets/samples`);
}

await main();
