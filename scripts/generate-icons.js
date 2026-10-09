import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// SVG Definition of Brilliant Budget App Icon
// Minimalist, high-contrast, Apple HIG compliant (solid background, no pre-rounded corners)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Deep Obsidian Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="50%" stop-color="#0B0F19" />
      <stop offset="100%" stop-color="#050811" />
    </linearGradient>

    <!-- Radial Emerald Ambient Glow -->
    <radialGradient id="ambientGlow" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="#059669" stop-opacity="0.32" />
      <stop offset="60%" stop-color="#047857" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Facet Gradients for the Brilliant Diamond Vault -->
    <linearGradient id="tableFacet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <linearGradient id="topFacetLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6EE7B7" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <linearGradient id="topFacetRight" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>

    <linearGradient id="centerDiamond" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#A7F3D0" />
      <stop offset="100%" stop-color="#34D399" />
    </linearGradient>

    <linearGradient id="midFacetLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <linearGradient id="midFacetRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="100%" stop-color="#064E3B" />
    </linearGradient>

    <linearGradient id="lowerFacetLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#065F46" />
    </linearGradient>

    <linearGradient id="lowerFacetRight" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#064E3B" />
      <stop offset="100%" stop-color="#022C22" />
    </linearGradient>

    <linearGradient id="bottomApex" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <!-- Subtle Drop Shadow for Emblem -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Solid Opaque Background (Apple Requirement: No Transparency) -->
  <rect width="1024" height="1024" fill="url(#bgGrad)" />

  <!-- Ambient Light Sphere -->
  <circle cx="512" cy="510" r="440" fill="url(#ambientGlow)" />

  <!-- Outer Protective Halo Ring -->
  <circle cx="512" cy="512" r="390" fill="none" stroke="#10B981" stroke-width="1.5" stroke-opacity="0.2" />
  <circle cx="512" cy="512" r="380" fill="none" stroke="#34D399" stroke-width="1" stroke-opacity="0.15" stroke-dasharray="16 12" />

  <!-- Central Brilliant Diamond-Vault Glyph -->
  <g filter="url(#shadow)">
    <!-- Top Crown Table Facet -->
    <polygon points="340,270 684,270 604,395 420,395" fill="url(#tableFacet)" stroke="#ECFDF5" stroke-width="1" stroke-opacity="0.4" />

    <!-- Top Left Facet -->
    <polygon points="340,270 200,395 420,395" fill="url(#topFacetLeft)" stroke="#ECFDF5" stroke-width="1" stroke-opacity="0.3" />

    <!-- Top Right Facet -->
    <polygon points="684,270 824,395 604,395" fill="url(#topFacetRight)" stroke="#ECFDF5" stroke-width="1" stroke-opacity="0.3" />

    <!-- Center Upper Diamond Keystone -->
    <polygon points="420,395 604,395 512,525" fill="url(#centerDiamond)" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity="0.6" />

    <!-- Mid Left Facet -->
    <polygon points="200,395 420,395 512,525 330,590" fill="url(#midFacetLeft)" stroke="#ECFDF5" stroke-width="1" stroke-opacity="0.25" />

    <!-- Mid Right Facet -->
    <polygon points="824,395 604,395 512,525 694,590" fill="url(#midFacetRight)" stroke="#ECFDF5" stroke-width="1" stroke-opacity="0.25" />

    <!-- Lower Vault Body - Left Core -->
    <polygon points="330,590 512,525 512,790" fill="url(#lowerFacetLeft)" stroke="#ECFDF5" stroke-width="1" stroke-opacity="0.2" />

    <!-- Lower Vault Body - Right Core -->
    <polygon points="694,590 512,525 512,790" fill="url(#lowerFacetRight)" stroke="#ECFDF5" stroke-width="1" stroke-opacity="0.2" />

    <!-- Outer Lower Flanks - Left -->
    <polygon points="200,395 330,590 512,790" fill="url(#midFacetLeft)" fill-opacity="0.8" stroke="#10B981" stroke-width="1" stroke-opacity="0.2" />

    <!-- Outer Lower Flanks - Right -->
    <polygon points="824,395 694,590 512,790" fill="url(#midFacetRight)" fill-opacity="0.8" stroke="#047857" stroke-width="1" stroke-opacity="0.2" />

    <!-- Internal Radiant Micro-Star / Sparkle at Pavilion Center -->
    <circle cx="512" cy="525" r="5" fill="#FFFFFF" opacity="0.9" />
    <path d="M512 485 L516 521 L552 525 L516 529 L512 565 L508 529 L472 525 L508 521 Z" fill="#FFFFFF" opacity="0.75" />

    <!-- Inner Financial Growth Pillar Accent (Vertical Vault Seam) -->
    <line x1="512" y1="525" x2="512" y2="788" stroke="#34D399" stroke-width="2.5" stroke-opacity="0.8" stroke-linecap="round" />
  </g>
</svg>
`;

async function generate() {
  console.log('Generating Brilliant Budget Official App Icons...');

  // 1. Save public/icon.svg
  const svgPath = path.resolve(process.cwd(), 'public', 'icon.svg');
  fs.writeFileSync(svgPath, svgContent.trim());
  console.log('✓ Wrote public/icon.svg');

  // 2. Generate 1024x1024 PNG for iOS AppIcon
  const iosIconPath = path.resolve(
    process.cwd(),
    'ios',
    'App',
    'App',
    'Assets.xcassets',
    'AppIcon.appiconset',
    'AppIcon-512@2x.png'
  );
  
  await sharp(Buffer.from(svgContent))
    .resize(1024, 1024)
    .png({ compressionLevel: 9 })
    .toFile(iosIconPath);
  console.log('✓ Generated 1024x1024 iOS native icon at:', iosIconPath);

  // 3. Generate 512x512 PNG for PWA & web assets
  const pwaIconPath = path.resolve(process.cwd(), 'public', 'icon-512.png');
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(pwaIconPath);
  console.log('✓ Generated 512x512 PWA icon at:', pwaIconPath);

  // 4. Generate 192x192 PNG for PWA
  const pwaIcon192 = path.resolve(process.cwd(), 'public', 'icon-192.png');
  await sharp(Buffer.from(svgContent))
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(pwaIcon192);
  console.log('✓ Generated 192x192 PWA icon at:', pwaIcon192);

  // 5. Generate apple-touch-icon.png (180x180)
  const appleTouchPath = path.resolve(process.cwd(), 'public', 'apple-touch-icon.png');
  await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(appleTouchPath);
  console.log('✓ Generated apple-touch-icon.png at:', appleTouchPath);

  console.log('\nAll App Icons successfully created!');
}

generate().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
