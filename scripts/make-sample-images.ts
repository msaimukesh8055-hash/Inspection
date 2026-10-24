// scripts/make-sample-images.ts
// Draws the demo photo sets as SVG and renders them to JPEG with sharp.
// Output: assets/samples/{vehicle}/{set}/{angle}.jpg (the web app finds them via lib/sampleImages.ts).
// The images never name the scenario, so a model cannot read the answer off the picture.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { ANGLES, angleLabel } from '../lib/photos.ts';
import type { Angle, SampleSet, SampleVehicleKey } from '../lib/photos.ts';

type Body = 'scooter' | 'bike';
type Damage = 'none' | 'scratch' | 'dent';

type VehicleSpec = { key: SampleVehicleKey; model: string; regNo: string; colour: string; body: Body };

// Must match supabase/seed.sql
const VEHICLES: VehicleSpec[] = [
  { key: 'jupiter', model: 'TVS Jupiter', regNo: 'KA01DM0101', colour: '#2f5d9e', body: 'scooter' },
  { key: 'radeon', model: 'TVS Radeon', regNo: 'KA01DM0102', colour: '#7b8088', body: 'bike' },
  { key: 'ntorq', model: 'TVS Ntorq', regNo: 'KA01DM0103', colour: '#b3262d', body: 'scooter' },
];

const SETS: { set: SampleSet; damage: Damage; isReturn: boolean }[] = [
  { set: 'pickup', damage: 'none', isReturn: false },
  { set: 'no-damage', damage: 'none', isReturn: true },
  { set: 'light-scratch', damage: 'scratch', isReturn: true },
  { set: 'dented-panel', damage: 'dent', isReturn: true },
];

const WIDTH = 960;
const HEIGHT = 720;

function background(isReturn: boolean): string {
  // Return photos are taken later in the day: slightly warmer wall.
  const wallTop = isReturn ? '#d6cbb6' : '#cfcac1';
  const wallBottom = isReturn ? '#bfb29b' : '#b7b1a7';
  return `
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${wallTop}"/><stop offset="1" stop-color="${wallBottom}"/>
      </linearGradient>
      <radialGradient id="dent" cx="0.45" cy="0.4" r="0.6">
        <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
        <stop offset="0.7" stop-color="#000" stop-opacity="0.2"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wall)"/>
    <rect y="600" width="${WIDTH}" height="120" fill="#8d8a85"/>
    <line x1="0" y1="600" x2="${WIDTH}" y2="600" stroke="#6f6c67" stroke-width="3"/>
    <ellipse cx="480" cy="635" rx="360" ry="22" fill="#000" opacity="0.18"/>`;
}

function wheelSide(cx: number): string {
  return `
    <circle cx="${cx}" cy="540" r="88" fill="#1c1c1c"/>
    <circle cx="${cx}" cy="540" r="52" fill="#9a9a9a"/>
    <circle cx="${cx}" cy="540" r="14" fill="#444"/>`;
}

function scratchMarks(x: number, y: number): string {
  // Thin, light, jagged marks: a surface scratch through the paint.
  return `
    <g stroke="#f2f2f2" stroke-opacity="0.85" fill="none" stroke-linecap="round">
      <polyline points="${x},${y} ${x + 30},${y + 6} ${x + 55},${y + 3} ${x + 90},${y + 12} ${x + 120},${y + 9}" stroke-width="2.5"/>
      <polyline points="${x + 8},${y + 16} ${x + 40},${y + 22} ${x + 75},${y + 20} ${x + 105},${y + 28}" stroke-width="1.8"/>
      <polyline points="${x + 20},${y + 30} ${x + 50},${y + 35} ${x + 80},${y + 34}" stroke-width="1.4"/>
    </g>`;
}

function dentMark(cx: number, cy: number, rx: number, ry: number): string {
  // A pushed-in panel: dark hollow, a bright crease edge and a few crumple lines.
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#dent)"/>
    <path d="M${cx - rx * 0.8},${cy - ry * 0.3} Q${cx},${cy - ry * 1.1} ${cx + rx * 0.8},${cy - ry * 0.2}"
      stroke="#ffffff" stroke-opacity="0.55" stroke-width="3" fill="none"/>
    <g stroke="#000" stroke-opacity="0.45" stroke-width="2" fill="none">
      <path d="M${cx - rx * 0.4},${cy} l${rx * 0.3},${ry * 0.25} l${rx * 0.25},-${ry * 0.2}"/>
      <path d="M${cx + rx * 0.1},${cy + ry * 0.35} l${rx * 0.3},-${ry * 0.15}"/>
    </g>`;
}

/** Side view with the front of the vehicle on the right. The left view mirrors it. */
function sideView(v: VehicleSpec, damage: Damage, mirrored: boolean, showScratch: boolean): string {
  const body =
    v.body === 'scooter'
      ? `
        <path d="M150,480 C150,400 200,350 300,340 L470,340 C500,340 510,380 500,430 L490,470 L160,490 Z" fill="${v.colour}"/>
        <rect x="480" y="455" width="135" height="24" rx="4" fill="#2b2b2b"/>
        <path d="M600,482 L620,300 C625,250 660,230 690,240 L722,252 C702,320 692,400 682,482 Z" fill="${v.colour}"/>
        <path d="M245,336 C265,300 455,300 478,330 L468,346 L252,350 Z" fill="#1f1f1f"/>`
      : `
        <path d="M170,470 C170,420 210,385 290,380 L420,375 L430,450 L180,480 Z" fill="${v.colour}"/>
        <rect x="400" y="420" width="170" height="85" rx="10" fill="#555"/>
        <path d="M440,375 C450,320 520,300 600,310 C625,315 630,350 610,380 L450,390 Z" fill="${v.colour}"/>
        <path d="M240,375 C260,345 420,340 450,365 L440,382 L250,388 Z" fill="#1f1f1f"/>
        <line x1="690" y1="240" x2="720" y2="540" stroke="#3a3a3a" stroke-width="14"/>`;
  const sideScratch = showScratch && damage === 'scratch' ? scratchMarks(250, 395) : '';
  const tankDent = v.body === 'bike' && damage === 'dent' && showScratch ? dentMark(530, 345, 55, 28) : '';
  const parts = `
    ${wheelSide(260)}
    ${wheelSide(720)}
    <path d="M640,500 C660,440 780,440 800,500 L780,500 C765,462 675,462 660,500 Z" fill="${v.colour}"/>
    ${body}
    <rect x="140" y="395" width="22" height="30" rx="4" fill="#c0262d"/>
    <line x1="690" y1="240" x2="672" y2="172" stroke="#2a2a2a" stroke-width="10"/>
    <line x1="630" y1="172" x2="722" y2="166" stroke="#2a2a2a" stroke-width="10" stroke-linecap="round"/>
    <line x1="650" y1="170" x2="640" y2="120" stroke="#2a2a2a" stroke-width="4"/>
    <ellipse cx="640" cy="112" rx="18" ry="12" fill="#333"/>
    <ellipse cx="714" cy="222" rx="16" ry="22" fill="#f4f1d0" stroke="#555" stroke-width="3"/>
    ${sideScratch}
    ${tankDent}`;
  return mirrored ? `<g transform="translate(${WIDTH},0) scale(-1,1)">${parts}</g>` : parts;
}

function frontView(v: VehicleSpec, damage: Damage): string {
  const panel =
    v.body === 'scooter'
      ? `<path d="M380,482 C370,350 400,262 480,250 C560,262 590,350 580,482 Z" fill="${v.colour}"/>`
      : `<path d="M420,330 C430,280 530,280 540,330 L530,370 L430,370 Z" fill="${v.colour}"/>
         <line x1="440" y1="330" x2="455" y2="560" stroke="#3a3a3a" stroke-width="12"/>
         <line x1="520" y1="330" x2="505" y2="560" stroke="#3a3a3a" stroke-width="12"/>`;
  const dent = v.body === 'scooter' && damage === 'dent' ? dentMark(455, 405, 62, 40) : '';
  return `
    <rect x="448" y="470" width="64" height="172" rx="22" fill="#1c1c1c"/>
    <path d="M425,500 C430,455 530,455 535,500 L520,500 C515,475 445,475 440,500 Z" fill="${v.colour}"/>
    ${panel}
    <ellipse cx="480" cy="${v.body === 'scooter' ? 305 : 255}" rx="48" ry="28" fill="#f4f1d0" stroke="#555" stroke-width="3"/>
    <rect x="392" y="332" width="20" height="12" rx="3" fill="#e08a1e"/>
    <rect x="548" y="332" width="20" height="12" rx="3" fill="#e08a1e"/>
    <line x1="330" y1="215" x2="630" y2="215" stroke="#2a2a2a" stroke-width="11" stroke-linecap="round"/>
    <line x1="350" y1="212" x2="340" y2="155" stroke="#2a2a2a" stroke-width="4"/>
    <line x1="610" y1="212" x2="620" y2="155" stroke="#2a2a2a" stroke-width="4"/>
    <ellipse cx="338" cy="146" rx="22" ry="14" fill="#333"/>
    <ellipse cx="622" cy="146" rx="22" ry="14" fill="#333"/>
    ${dent}`;
}

function rearView(v: VehicleSpec): string {
  return `
    <rect x="448" y="480" width="64" height="162" rx="22" fill="#1c1c1c"/>
    <path d="M370,472 C370,332 420,282 480,282 C540,282 590,332 590,472 Z" fill="${v.colour}"/>
    <ellipse cx="480" cy="284" rx="92" ry="20" fill="#1f1f1f"/>
    <rect x="438" y="358" width="84" height="26" rx="6" fill="#c0262d"/>
    <rect x="432" y="400" width="96" height="44" rx="4" fill="#f5f5f5" stroke="#333" stroke-width="2"/>
    <text x="480" y="429" font-family="Arial" font-size="17" text-anchor="middle" fill="#111">${v.regNo}</text>
    <path d="M395,300 C420,260 540,260 565,300" stroke="#2a2a2a" stroke-width="8" fill="none"/>`;
}

function stamp(v: VehicleSpec, angle: Angle): string {
  const text = `${v.model} · ${v.regNo} · ${angleLabel(angle).toUpperCase()}`;
  return `
    <rect x="16" y="672" width="${text.length * 11 + 24}" height="34" rx="6" fill="#fff" opacity="0.8"/>
    <text x="28" y="696" font-family="Arial" font-size="19" fill="#222">${text}</text>`;
}

function drawSvg(v: VehicleSpec, angle: Angle, damage: Damage, isReturn: boolean): string {
  let vehicle: string;
  if (angle === 'front') vehicle = frontView(v, damage);
  else if (angle === 'rear') vehicle = rearView(v);
  // Damage on the side views is only drawn on the left side.
  else vehicle = sideView(v, damage, angle === 'left', angle === 'left');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    ${background(isReturn)}${vehicle}${stamp(v, angle)}</svg>`;
}

const samplesDir = fileURLToPath(new URL('../assets/samples/', import.meta.url));

async function main(): Promise<void> {
  for (const v of VEHICLES) {
    for (const { set, damage, isReturn } of SETS) {
      const dir = `${samplesDir}${v.key}/${set}/`;
      mkdirSync(dir, { recursive: true });
      for (const angle of ANGLES) {
        const svg = drawSvg(v, angle, damage, isReturn);
        await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(`${dir}${angle}.jpg`);
      }
    }
  }

  console.log(`samples:make: wrote ${VEHICLES.length * SETS.length * ANGLES.length} images to assets/samples`);
}

await main();
