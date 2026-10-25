// scripts/photo-edits.ts
// Shared photo editing for the demo samples and the eval cases. Starts from four real photos of a Goa
// rental Honda Activa (assets/photo-src, CC0 from Wikimedia Commons, see README). The sources are already
// redacted: the shop's sticker is generic, the real plate is blanked and background plates are blurred. This:
// - paints a made-up plate number per fleet scooter (GA 07 M 2211 / 2212 / 2213),
// - draws damage in code (scratch, dent, cracked lamp) at measured spots,
// - optionally blurs or darkens a photo to simulate a bad shot.
// Nothing on an image names the scenario, so a model cannot read the answer off it.
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import type { Sharp } from 'sharp';

import type { Angle, SampleVehicleKey } from '../lib/photos.ts';

const SRC = fileURLToPath(new URL('../assets/photo-src/', import.meta.url));

/** Overlay coordinates are in pixels of each source photo scaled to 1920 px wide. */
const GEOMETRY_WIDTH = 1920;
const PLATE_YELLOW = '#f1c232';
const PLATE_FONT = 'font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900"';

const PLATE_STATE = 'GA 07';
export const PLATES: Record<SampleVehicleKey, string> = {
  fleet1: 'M 2211',
  fleet2: 'M 2212',
  fleet3: 'M 2213',
};

export type Damage =
  | { kind: 'scratch'; x: number; y: number; len: number; angle: number }
  | { kind: 'dent'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'crack'; cx: number; cy: number; r: number };

/** Where damage is drawn: each spot belongs to one source photo (angle). */
export const SPOTS = {
  leftPanelScratch: { angle: 'left', damage: { kind: 'scratch', x: 1120, y: 820, len: 330, angle: -9 } },
  leftPanelDent: { angle: 'left', damage: { kind: 'dent', cx: 1330, cy: 800, rx: 165, ry: 92 } },
  rightPanelScratch: { angle: 'right', damage: { kind: 'scratch', x: 560, y: 690, len: 330, angle: -6 } },
  rightPanelDent: { angle: 'right', damage: { kind: 'dent', cx: 690, cy: 690, rx: 150, ry: 85 } },
  mudguardScratch: { angle: 'front', damage: { kind: 'scratch', x: 820, y: 1560, len: 300, angle: -10 } },
  tailLampCrack: { angle: 'rear', damage: { kind: 'crack', cx: 900, cy: 1470, r: 130 } },
} as const satisfies Record<string, { angle: Angle; damage: Damage }>;

export type SpotName = keyof typeof SPOTS;

export type PhotoSpec = {
  /** Which source photo to start from. */
  source: Angle;
  fleet: SampleVehicleKey;
  damage: SpotName[];
  /** Return photos are taken later: a touch warmer and darker. */
  isReturn: boolean;
  /** Bad shots for the photo-quality cases. */
  blur?: number;
  brightness?: number;
};

function svg(width: number, height: number, body: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}

/** Black plate patch with yellow two-line number, optionally rotated to follow the plate. */
function plate(cx: number, cy: number, w: number, h: number, rotate: number, line2: string, size1: number, size2: number): string {
  return `
    <g transform="rotate(${rotate} ${cx} ${cy})">
      <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8" fill="#141414"/>
      <text x="${cx}" y="${cy - h * 0.06}" text-anchor="middle" ${PLATE_FONT} font-size="${size1}" fill="${PLATE_YELLOW}">${PLATE_STATE}</text>
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
function scratch(id: string, x: number, y: number, len: number, angle: number): string {
  const random = seeded(7);
  const lines: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    const start = random() * len * 0.35;
    const length = len * (0.25 + random() * 0.65);
    const offset = (random() - 0.5) * 34;
    const tilt = (random() - 0.5) * 0.12;
    const bend = (random() - 0.5) * 10;
    const x1 = x + start;
    const y1 = y + offset;
    const x2 = x1 + length;
    const y2 = y1 + length * tilt;
    const width = 1 + random() * 1.8;
    const opacity = 0.55 + random() * 0.4;
    const d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${((x1 + x2) / 2).toFixed(1)},${((y1 + y2) / 2 + bend).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    lines.push(`
      <path d="${d}" stroke="#3a3a3a" stroke-opacity="${(opacity * 0.35).toFixed(2)}" stroke-width="${(width + 1.2).toFixed(1)}" fill="none" transform="translate(0.8 1.2)" mask="url(#${id}-fade)"/>
      <path d="${d}" stroke="#ecebe6" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(1)}" fill="none" stroke-linecap="round" mask="url(#${id}-fade)"/>`);
  }
  return `
    <defs>
      <linearGradient id="${id}-grad" x1="${x}" y1="0" x2="${x + len}" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset="0.18" stop-color="#fff" stop-opacity="1"/>
        <stop offset="0.75" stop-color="#fff" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <mask id="${id}-fade" maskUnits="userSpaceOnUse" x="${x - 20}" y="${y - 120}" width="${len + 60}" height="240">
        <rect x="${x - 20}" y="${y - 120}" width="${len + 60}" height="240" fill="url(#${id}-grad)"/>
      </mask>
      <filter id="${id}-hair"><feGaussianBlur stdDeviation="0.45"/></filter>
    </defs>
    <g filter="url(#${id}-hair)" transform="rotate(${angle} ${x} ${y})">${lines.join('')}</g>`;
}

/**
 * A pushed-in panel on matte paint under daylight: the hollow's upper wall faces down and goes dark,
 * its lower wall faces up and catches light. Irregular, soft-edged shapes and a couple of faint creases.
 */
function dent(id: string, cx: number, cy: number, rx: number, ry: number): string {
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
      <filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="${id}-mid" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
      <filter id="${id}-edge"><feGaussianBlur stdDeviation="1.6"/></filter>
    </defs>
    <path d="${blob(1, 0, -ry * 0.1)}" fill="#000" fill-opacity="0.6" filter="url(#${id}-soft)"/>
    <path d="${blob(0.55, -rx * 0.05, -ry * 0.3)}" fill="#000" fill-opacity="0.72" filter="url(#${id}-mid)"/>
    <path d="${blob(0.5, rx * 0.1, ry * 0.45)}" fill="#fff" fill-opacity="0.5" filter="url(#${id}-mid)"/>
    <g stroke="#1a1a1a" stroke-opacity="0.6" stroke-width="3" fill="none" filter="url(#${id}-edge)">
      <path d="M${cx - rx * 0.55},${cy + ry * 0.1} q${rx * 0.3},${ry * 0.22} ${rx * 0.62},${ry * 0.08}"/>
      <path d="M${cx + rx * 0.1},${cy + ry * 0.48} q${rx * 0.22},-${ry * 0.1} ${rx * 0.38},-${ry * 0.4}"/>
    </g>`;
}

/** A cracked lamp lens: jagged lines radiating from an impact point, a chipped-out shard, light catching the edges. */
function crack(id: string, cx: number, cy: number, r: number): string {
  const random = seeded(23);
  const rays = Array.from({ length: 9 }, (_, i) => {
    let angle = (i / 9) * Math.PI * 2 + random() * 0.4;
    let px = cx;
    let py = cy;
    const points = [`${px.toFixed(1)},${py.toFixed(1)}`];
    const steps = 3 + Math.floor(random() * 3);
    for (let s = 0; s < steps; s += 1) {
      const step = (r / steps) * (0.7 + random() * 0.6);
      angle += (random() - 0.5) * 0.7;
      px += Math.cos(angle) * step;
      py += Math.sin(angle) * step;
      points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return points.join(' ');
  });
  const shard = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * Math.PI * 2;
    const rr = r * 0.18 * (0.7 + random() * 0.6);
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  return `
    <defs><filter id="${id}-soft"><feGaussianBlur stdDeviation="0.8"/></filter></defs>
    <g filter="url(#${id}-soft)">
      <polygon points="${shard}" fill="#2a0606" fill-opacity="0.85"/>
      ${rays.map((p) => `<polyline points="${p}" fill="none" stroke="#1a0000" stroke-opacity="0.75" stroke-width="3.2"/>`).join('')}
      ${rays.map((p) => `<polyline points="${p}" fill="none" stroke="#fff3ee" stroke-opacity="0.7" stroke-width="1.4" transform="translate(-1.5 -1.5)"/>`).join('')}
    </g>`;
}

function drawDamage(id: string, damage: Damage): string {
  switch (damage.kind) {
    case 'scratch':
      return scratch(id, damage.x, damage.y, damage.len, damage.angle);
    case 'dent':
      return dent(id, damage.cx, damage.cy, damage.rx, damage.ry);
    case 'crack':
      return crack(id, damage.cx, damage.cy, damage.r);
  }
}

/** Plate for one fleet scooter on one source photo (only the front and rear show it). */
function fleetMarks(source: Angle, fleet: SampleVehicleKey): string {
  if (source === 'front') return plate(975, 952, 318, 170, -1, PLATES[fleet], 70, 92);
  if (source === 'rear') return plate(1075, 2005, 470, 245, -9, PLATES[fleet], 108, 134);
  return '';
}

/** Fits any photo into width × height (4:3): landscape is cropped, portrait sits on a blurred copy of itself. */
async function fit(input: Buffer, width: number, height: number): Promise<Sharp> {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? width;
  const h = meta.height ?? height;
  if (w / h >= width / height) return sharp(input).resize(width, height, { fit: 'cover', position: 'attention' });
  const background = await sharp(input).resize(width, height, { fit: 'cover' }).blur(28).modulate({ brightness: 0.55 }).toBuffer();
  const foreground = await sharp(input).resize({ height }).toBuffer();
  const fgWidth = (await sharp(foreground).metadata()).width ?? width;
  return sharp(background).composite([{ input: foreground, left: Math.round((width - fgWidth) / 2), top: 0 }]);
}

/** Renders one photo: fleet marks, damage at the named spots, return warmth, optional blur or darkening. */
export async function renderPhoto(spec: PhotoSpec, width = 1280, height = 960): Promise<Sharp> {
  const source = sharp(`${SRC}${spec.source}.jpg`);
  const meta = await source.metadata();
  const sourceWidth = meta.width ?? GEOMETRY_WIDTH;
  const sourceHeight = meta.height ?? 1440;

  const damage = spec.damage
    .map((name, i) => {
      const spot = SPOTS[name];
      if (spot.angle !== spec.source) throw new Error(`${name} is drawn on the ${spot.angle} photo, not ${spec.source}`);
      return drawDamage(`d${i}`, spot.damage);
    })
    .join('');
  const drawn = fleetMarks(spec.source, spec.fleet) + damage;
  const scale = sourceWidth / GEOMETRY_WIDTH;
  let edited = drawn
    ? await source.composite([{ input: svg(sourceWidth, sourceHeight, `<g transform="scale(${scale})">${drawn}</g>`) }]).toBuffer()
    : await source.toBuffer();

  if (spec.isReturn) edited = await sharp(edited).linear([1.0, 0.97, 0.92], [0, 0, 0]).modulate({ brightness: 0.97 }).toBuffer();
  if (spec.blur) edited = await sharp(edited).blur(spec.blur).toBuffer();
  if (spec.brightness) edited = await sharp(edited).modulate({ brightness: spec.brightness }).toBuffer();
  return fit(edited, width, height);
}
