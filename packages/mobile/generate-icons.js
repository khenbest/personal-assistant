const { createCanvas } = require('canvas');
const fs = require('fs');

// Create icon (1024x1024)
function createIcon(size, filename, text = 'E') {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#007AFF';
  ctx.fillRect(0, 0, size, size);
  
  // Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename}`);
}

// Generate icons
createIcon(1024, 'assets/icon.png', 'E');
createIcon(1024, 'assets/adaptive-icon.png', 'E');
createIcon(2732, 'assets/splash.png', 'Eidolon');

console.log('Icons generated successfully!');