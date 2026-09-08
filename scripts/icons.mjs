// Generates PWA icons: filled ring on black, via sharp from an inline SVG.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const svg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="#000000"/>
  <circle cx="50" cy="50" r="34" fill="none" stroke="#ffffff" stroke-width="12"/>
</svg>
`;

const targets = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
];

await mkdir('public/icons', { recursive: true });

for (const { file, size } of targets) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(file);
  console.log(`wrote ${file}`);
}
