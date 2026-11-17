// Genera los PNG de icono/splash a partir de assets/src/mark.svg con Chromium (Playwright).
// Uso: node assets/src/render-icons.mjs
import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..');
const mark = fs.readFileSync(path.join(here, 'mark.svg'), 'utf8').replace(/<!--.*?-->/s, '').trim();
const markOnly = (scale, mono = false) => {
  let svg = mark.replace('<g id="mark">', `<g id="mark" transform="translate(512 512) scale(${scale}) translate(-512 -512)">`);
  if (mono) svg = svg.replace(/fill="url\(#\w+\)"/g, 'fill="#FFFFFF"').replace(/stroke="url\(#ring\)"/g, 'stroke="#FFFFFF"').replace(/<circle cx="512" cy="512" r="290"[^>]*\/>/, '');
  return svg;
};
const background = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="neb" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#2A1B4A"/><stop offset="0.55" stop-color="#140F24"/><stop offset="1" stop-color="#0B0815"/></radialGradient>
    <radialGradient id="neb2" cx="78%" cy="82%" r="45%"><stop offset="0" stop-color="#7CD4E8" stop-opacity="0.12"/><stop offset="1" stop-color="#7CD4E8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#neb)"/><rect width="1024" height="1024" fill="url(#neb2)"/>
  ${[[150,180,3],[860,140,2.5],[120,820,2],[900,760,3],[700,90,2],[260,930,2.5],[60,480,2],[960,420,2]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#F7F4FF" opacity="0.7"/>`).join('')}
</svg>`;
const inner = (svg) => svg.trim().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const combine = (bg, fg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${inner(bg)}${inner(fg)}</svg>`;

const jobs = [
  ['icon.png', 1024, combine(background, markOnly(0.92)), false],
  ['android-icon-background.png', 512, background, false],
  // Zona segura del icono adaptativo: el 66 % central.
  ['android-icon-foreground.png', 512, markOnly(0.62), true],
  ['android-icon-monochrome.png', 432, markOnly(0.62, true), true],
  ['splash-icon.png', 1024, markOnly(0.9), true],
  ['favicon.png', 48, combine(background, markOnly(1.05)), false],
];
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, svg, transparent] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}"></body></html>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, name), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('generado', name);
}
await browser.close();
