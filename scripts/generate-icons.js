import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

async function generate() {
  console.log('Generating Brilliant Budget Official App Icons from public/icon.svg...');

  const svgPath = path.resolve(process.cwd(), 'public', 'icon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  // 1. Generate 1024x1024 PNG for iOS AppIcon
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

  // 2. Generate 512x512 PNG for PWA & web assets
  const pwaIconPath = path.resolve(process.cwd(), 'public', 'icon-512.png');
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(pwaIconPath);
  console.log('✓ Generated 512x512 PWA icon at:', pwaIconPath);

  // 3. Generate 192x192 PNG for PWA
  const pwaIcon192 = path.resolve(process.cwd(), 'public', 'icon-192.png');
  await sharp(Buffer.from(svgContent))
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(pwaIcon192);
  console.log('✓ Generated 192x192 PWA icon at:', pwaIcon192);

  // 4. Generate apple-touch-icon.png (180x180)
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
