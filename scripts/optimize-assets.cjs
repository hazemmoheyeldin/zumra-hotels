const sharp = require('sharp');
const path = require('path');

async function optimize() {
  const assetsDir = path.join(__dirname, '..', 'src', 'assets');

  // Logo: displayed at ~92px height in PDF header, ~120px wide max
  // Create a 2x version for retina (240px wide, ~184px tall)
  await sharp(path.join(assetsDir, 'zumra-logo.png'))
    .resize(240, null, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 80, compressionLevel: 9, progressive: true })
    .toFile(path.join(assetsDir, 'zumra-logo-opt.png'));

  // Also create a JPEG version for PDF embedding (no transparency needed on white bg)
  await sharp(path.join(assetsDir, 'zumra-logo.png'))
    .resize(240, null, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(path.join(assetsDir, 'zumra-logo-opt.jpg'));

  // Stamp: displayed at ~80-100px in documents
  await sharp(path.join(assetsDir, 'stamp.png'))
    .resize(160, null, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 80, compressionLevel: 9, progressive: true })
    .toFile(path.join(assetsDir, 'stamp-opt.png'));

  // Report sizes
  const fs = require('fs');
  const files = ['zumra-logo.png', 'zumra-logo-opt.png', 'zumra-logo-opt.jpg', 'stamp.png', 'stamp-opt.png'];
  for (const f of files) {
    const fp = path.join(assetsDir, f);
    if (fs.existsSync(fp)) {
      const stat = fs.statSync(fp);
      console.log(`${f}: ${(stat.size / 1024).toFixed(1)} KB`);
    }
  }
}

optimize().catch(console.error);
