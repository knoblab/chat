import { execSync } from 'child_process';
import fs from 'fs';

const conversions = [
  { src: 'public/icon-192.svg', dest: 'public/icon-192.png' },
  { src: 'public/icon-512.svg', dest: 'public/icon-512.png' },
  { src: 'public/apple-touch-icon.svg', dest: 'public/apple-touch-icon.png' },
  { src: 'public/og-image.svg', dest: 'public/og-image.png' },
  { src: 'public/og-image-1200x630.svg', dest: 'public/og-image-1200x630.png' },
];

console.log('✨ Starting SVG to PNG conversion using resvg-cli...\n');

for (const { src, dest } of conversions) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Warning: Source file ${src} does not exist. Skipping...`);
    continue;
  }
  console.log(`🚀 Converting: ${src} -> ${dest}`);
  try {
    execSync(`npx -y resvg-cli "${src}" "${dest}"`, { stdio: 'inherit' });
    console.log(`✅ Created ${dest}`);
  } catch (err) {
    console.error(`❌ Failed to convert ${src}:`, err.message || err);
  }
}

console.log('\n🎉 All conversions completed!');
