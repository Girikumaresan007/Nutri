const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <rect width="128" height="128" rx="28" fill="#244C3A"/>
  <path d="M92 27C63 29 39 40 31 61c-7 18 3 37 21 39 27 4 46-23 40-73Z" fill="#A8C5A0"/>
  <path d="M32 96c12-18 29-33 53-48" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="5"/>
  <path d="M50 73c2 8 8 14 17 17M61 60c8 1 15 5 20 11" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="4"/>
  <circle cx="91" cy="28" r="5" fill="#F08A70"/>
</svg>
`;

const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <rect width="128" height="128" fill="#244C3A"/>
  <g transform="translate(64, 64) scale(0.76) translate(-62, -62)">
    <path d="M92 27C63 29 39 40 31 61c-7 18 3 37 21 39 27 4 46-23 40-73Z" fill="#A8C5A0"/>
    <path d="M32 96c12-18 29-33 53-48" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="5"/>
    <path d="M50 73c2 8 8 14 17 17M61 60c8 1 15 5 20 11" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="4"/>
    <circle cx="91" cy="28" r="5" fill="#F08A70"/>
  </g>
</svg>
`;

const appleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <rect width="128" height="128" fill="#244C3A"/>
  <g transform="translate(64, 64) scale(0.82) translate(-62, -62)">
    <path d="M92 27C63 29 39 40 31 61c-7 18 3 37 21 39 27 4 46-23 40-73Z" fill="#A8C5A0"/>
    <path d="M32 96c12-18 29-33 53-48" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="5"/>
    <path d="M50 73c2 8 8 14 17 17M61 60c8 1 15 5 20 11" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="4"/>
    <circle cx="91" cy="28" r="5" fill="#F08A70"/>
  </g>
</svg>
`;

const targets = [
  { name: 'icon-192.png', size: 192, svg: standardSvg, transparent: true },
  { name: 'icon-512.png', size: 512, svg: standardSvg, transparent: true },
  { name: 'icon-192-maskable.png', size: 192, svg: maskableSvg, transparent: false },
  { name: 'icon-512-maskable.png', size: 512, svg: maskableSvg, transparent: false },
  { name: 'apple-touch-icon.png', size: 180, svg: appleSvg, transparent: false },
];

function generate() {
  const tempHtmlPath = path.join(PUBLIC_DIR, '_temp_icon_render.html');
  
  for (const target of targets) {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${target.size}px;
    height: ${target.size}px;
    overflow: hidden;
    background: ${target.transparent ? 'transparent' : '#244C3A'};
  }
  svg {
    width: ${target.size}px;
    height: ${target.size}px;
    display: block;
  }
</style>
</head>
<body>
${target.svg}
</body>
</html>`;

    fs.writeFileSync(tempHtmlPath, html, 'utf8');
    const outputPath = path.join(PUBLIC_DIR, target.name);

    const args = [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${target.size},${target.size}`,
      target.transparent ? '--default-background-color=00000000' : '--default-background-color=ff244c3a',
      `--screenshot=${outputPath}`,
      `file:///${tempHtmlPath.replace(/\\/g, '/')}`,
    ];

    const res = spawnSync(CHROME_PATH, args);
    if (res.error) {
      console.error(`Error generating ${target.name}:`, res.error);
    } else {
      const stats = fs.statSync(outputPath);
      console.log(`Generated ${target.name} (${stats.size} bytes, ${target.size}x${target.size})`);
    }
  }

  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }
  console.log('All icons generated successfully.');
}

generate();
