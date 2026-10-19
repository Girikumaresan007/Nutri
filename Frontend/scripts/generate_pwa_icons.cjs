const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <filter id="std-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#244C3A" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#std-shadow)">
    <!-- Squircle Card with transparent safe margin around it -->
    <rect x="40" y="40" width="432" height="432" rx="116" fill="#244C3A" stroke="#A8C5A0" stroke-width="6" stroke-opacity="0.45"/>
    <g transform="translate(40, 40) scale(3.375)">
      <path d="M92 27C63 29 39 40 31 61c-7 18 3 37 21 39 27 4 46-23 40-73Z" fill="#A8C5A0"/>
      <path d="M32 96c12-18 29-33 53-48" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="5"/>
      <path d="M50 73c2 8 8 14 17 17M61 60c8 1 15 5 20 11" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="4"/>
      <circle cx="91" cy="28" r="5" fill="#F08A70"/>
    </g>
  </g>
</svg>
`;

const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Exact Warm Ivory Background that matches manifest background_color: #F8F6EF -->
  <rect width="512" height="512" fill="#F8F6EF"/>
  
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="28"/>
    </filter>
    <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#244C3A" flood-opacity="0.22"/>
    </filter>
  </defs>

  <!-- Ambient soft glow behind card -->
  <circle cx="256" cy="256" r="180" fill="#A8C5A0" opacity="0.45" filter="url(#glow)"/>

  <!-- Centered Elevated Logo Card inside safe zone (80% circle) -->
  <g filter="url(#card-shadow)">
    <!-- Squircle Card -->
    <rect x="96" y="96" width="320" height="320" rx="84" fill="#244C3A" stroke="#A8C5A0" stroke-width="5" stroke-opacity="0.45"/>
    
    <!-- NutriTrack Leaf Artwork scaled to 320x320 at (96, 96) [scale = 320 / 128 = 2.5] -->
    <g transform="translate(96, 96) scale(2.5)">
      <path d="M92 27C63 29 39 40 31 61c-7 18 3 37 21 39 27 4 46-23 40-73Z" fill="#A8C5A0"/>
      <path d="M32 96c12-18 29-33 53-48" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="5"/>
      <path d="M50 73c2 8 8 14 17 17M61 60c8 1 15 5 20 11" fill="none" stroke="#FFFDF8" stroke-linecap="round" stroke-width="4"/>
      <circle cx="91" cy="28" r="5" fill="#F08A70"/>
    </g>
  </g>
</svg>
`;

const appleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" fill="#244C3A"/>
  <g transform="translate(46, 46) scale(3.28)">
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
  { name: 'icon-192-maskable.png', size: 192, svg: maskableSvg, transparent: false, bgColor: 'fff8f6ef' },
  { name: 'icon-512-maskable.png', size: 512, svg: maskableSvg, transparent: false, bgColor: 'fff8f6ef' },
  { name: 'apple-touch-icon.png', size: 180, svg: appleSvg, transparent: false, bgColor: 'ff244c3a' },
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
    background: ${target.transparent ? 'transparent' : (target.bgColor ? '#' + target.bgColor.slice(2) : '#244C3A')};
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
      target.transparent ? '--default-background-color=00000000' : `--default-background-color=${target.bgColor || 'ff244c3a'}`,
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
