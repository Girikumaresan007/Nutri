const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Consistent Warm Ivory Background matching manifest background_color: #F8F6EF -->
  <rect width="512" height="512" fill="#F8F6EF"/>
  
  <defs>
    <filter id="std-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <filter id="std-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#244C3A" flood-opacity="0.22"/>
    </filter>
  </defs>

  <!-- Ambient soft sage glow behind card -->
  <circle cx="256" cy="256" r="170" fill="#A8C5A0" opacity="0.45" filter="url(#std-glow)"/>

  <!-- Centered Elevated Brand Card strictly within 80% safe circle -->
  <g filter="url(#std-card-shadow)">
    <!-- Squircle Card -->
    <rect x="106" y="106" width="300" height="300" rx="80" fill="#244C3A" stroke="#A8C5A0" stroke-width="5" stroke-opacity="0.45"/>
    
    <!-- NutriTrack Leaf Artwork centered (106, 106) with scale = 300 / 128 = 2.34375 -->
    <g transform="translate(106, 106) scale(2.34375)">
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
  <!-- Exact Warm Ivory Background that fills 100% of maskable canvas to edge -->
  <rect width="512" height="512" fill="#F8F6EF"/>
  
  <defs>
    <filter id="mask-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <filter id="mask-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#244C3A" flood-opacity="0.22"/>
    </filter>
  </defs>

  <!-- Ambient soft sage glow behind card -->
  <circle cx="256" cy="256" r="170" fill="#A8C5A0" opacity="0.45" filter="url(#mask-glow)"/>

  <!-- Centered Elevated Logo Card strictly inside safe zone (80% circle) -->
  <g filter="url(#mask-card-shadow)">
    <!-- Squircle Card -->
    <rect x="106" y="106" width="300" height="300" rx="80" fill="#244C3A" stroke="#A8C5A0" stroke-width="5" stroke-opacity="0.45"/>
    
    <!-- NutriTrack Leaf Artwork centered (106, 106) with scale = 300 / 128 = 2.34375 -->
    <g transform="translate(106, 106) scale(2.34375)">
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
  <!-- Apple touch icon filled with deep forest green canvas -->
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
  { name: 'icon-192.png', size: 192, svg: standardSvg, transparent: false, bgColor: 'fff8f6ef' },
  { name: 'icon-512.png', size: 512, svg: standardSvg, transparent: false, bgColor: 'fff8f6ef' },
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
