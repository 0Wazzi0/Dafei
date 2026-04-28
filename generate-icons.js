import sharp from 'sharp';
import fs from 'fs';

async function generateIcons() {
  const svgBuffer = fs.readFileSync('./src-tauri/icons/icon.svg');
  
  // Generate PNG icons
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile('./src-tauri/icons/32x32.png');
    
  await sharp(svgBuffer)
    .resize(128, 128)
    .png()
    .toFile('./src-tauri/icons/128x128.png');
    
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile('./src-tauri/icons/128x128@2x.png');
    
  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);