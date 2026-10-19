const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '../dist');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

let hasErrors = false;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    hasErrors = true;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('--- NutriTrack AI PWA Verification ---\n');

// 1. Verify Manifest files exist in public and dist
const publicManifestPath = path.join(PUBLIC_DIR, 'manifest.webmanifest');
const distManifestPath = path.join(DIST_DIR, 'manifest.webmanifest');

assert(fs.existsSync(publicManifestPath), 'public/manifest.webmanifest exists');
assert(fs.existsSync(distManifestPath), 'dist/manifest.webmanifest exists');

const manifestContent = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));

// 2. Validate manifest fields
assert(manifestContent.name === 'NutriTrack AI', `Manifest name is "NutriTrack AI" (got "${manifestContent.name}")`);
assert(manifestContent.short_name === 'NutriTrack', `Manifest short_name is "NutriTrack" (got "${manifestContent.short_name}")`);
assert(typeof manifestContent.description === 'string' && manifestContent.description.length > 10, 'Manifest has valid description');
assert(manifestContent.start_url === '/', `Manifest start_url is "/" (got "${manifestContent.start_url}")`);
assert(manifestContent.display === 'standalone', `Manifest display is "standalone" (got "${manifestContent.display}")`);
assert(manifestContent.theme_color.toLowerCase() === '#244c3a', `Manifest theme_color is "#244C3A" (got "${manifestContent.theme_color}")`);
assert(manifestContent.background_color.toLowerCase() === '#f8f6ef', `Manifest background_color is "#f8f6ef" (got "${manifestContent.background_color}")`);

// 3. Verify Icons
const iconSizes = manifestContent.icons.map(i => `${i.sizes} (${i.purpose || 'any'})`);
console.log('Manifest icons found:', iconSizes.join(', '));

const icon192 = manifestContent.icons.find(i => i.sizes === '192x192' && (!i.purpose || i.purpose === 'any'));
const icon512 = manifestContent.icons.find(i => i.sizes === '512x512' && (!i.purpose || i.purpose === 'any'));
const icon192Maskable = manifestContent.icons.find(i => i.sizes === '192x192' && i.purpose === 'maskable');
const icon512Maskable = manifestContent.icons.find(i => i.sizes === '512x512' && i.purpose === 'maskable');

assert(!!icon192, 'Manifest contains 192x192 standard icon');
assert(!!icon512, 'Manifest contains 512x512 standard icon');
assert(!!icon192Maskable, 'Manifest contains 192x192 maskable icon');
assert(!!icon512Maskable, 'Manifest contains 512x512 maskable icon');

for (const icon of manifestContent.icons) {
  const localPath = path.join(DIST_DIR, icon.src.replace(/^\//, ''));
  const exists = fs.existsSync(localPath);
  assert(exists, `Icon file exists at dist path: ${icon.src}`);
  if (exists) {
    const stat = fs.statSync(localPath);
    assert(stat.size > 100, `Icon file is non-empty (${stat.size} bytes): ${icon.src}`);
  }
}

// 4. Verify Apple Touch Icon
const appleTouchIconDist = path.join(DIST_DIR, 'apple-touch-icon.png');
assert(fs.existsSync(appleTouchIconDist), 'dist/apple-touch-icon.png exists');
if (fs.existsSync(appleTouchIconDist)) {
  const stat = fs.statSync(appleTouchIconDist);
  assert(stat.size > 100, `Apple touch icon is non-empty (${stat.size} bytes)`);
}

// 5. Verify index.html tags
const distIndexHtml = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
assert(distIndexHtml.includes('rel="manifest"'), 'dist/index.html includes rel="manifest"');
assert(distIndexHtml.includes('name="theme-color" content="#244C3A"'), 'dist/index.html includes theme-color #244C3A');
assert(distIndexHtml.includes('rel="apple-touch-icon"'), 'dist/index.html includes apple-touch-icon');
assert(distIndexHtml.includes('name="mobile-web-app-capable"'), 'dist/index.html includes mobile-web-app-capable');
assert(distIndexHtml.includes('name="apple-mobile-web-app-capable"'), 'dist/index.html includes apple-mobile-web-app-capable');

// 6. Verify Service Worker safety and offline fallback
const swPath = path.join(DIST_DIR, 'sw.js');
assert(fs.existsSync(swPath), 'dist/sw.js exists');
const swContent = fs.readFileSync(swPath, 'utf8');

assert(swContent.includes('isPrivateOrApiRequest'), 'Service worker has private/API request filter');
assert(swContent.includes('/api/'), 'Service worker explicitly skips /api/ paths');
assert(swContent.includes('/auth/'), 'Service worker explicitly skips /auth/ paths');
assert(swContent.includes('Authorization'), 'Service worker skips Authorization headers');
assert(swContent.includes('navigate'), 'Service worker handles SPA navigate requests');
assert(swContent.includes('skipWaiting'), 'Service worker implements safe update activation');

const offlineHtmlPath = path.join(DIST_DIR, 'offline.html');
assert(fs.existsSync(offlineHtmlPath), 'dist/offline.html fallback exists');

if (hasErrors) {
  console.error('\n❌ PWA verification encountered failures.');
  process.exit(1);
} else {
  console.log('\n🎉 ALL PWA CRITERIA VERIFIED SUCCESSFULLY!');
}
