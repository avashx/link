const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractViewerNamesFromScreenshot(screenshotPath) {
  // Crop the area where viewer names are expected (adjust as needed)
  const croppedPath = screenshotPath.replace('.png', '-cropped.png');
  await sharp(screenshotPath)
    .extract({ left: 300, top: 200, width: 800, height: 300 }) // Adjust these values for your layout
    .toFile(croppedPath);

  const { data: { text } } = await Tesseract.recognize(croppedPath, 'eng');
  // Extract names: assume names are lines before '1st', '2nd', '3rd'
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const names = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^(1st|2nd|3rd)/.test(lines[i])) {
      if (i > 0) names.push(lines[i - 1]);
    }
  }
  // Return up to 3 names
  return names.slice(0, 3);
}

async function processAllScreenshots() {
  const dir = path.join(__dirname, 'public', 'screenshots');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  const results = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const names = await extractViewerNamesFromScreenshot(fullPath);
    results.push({ timestamp: file.split('profile-views-')[1].replace('.png', ''), names, file });
  }
  return results;
}

module.exports = { extractViewerNamesFromScreenshot, processAllScreenshots };
