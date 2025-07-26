const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Use the correct storage bucket for linkrtdb project
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'linkrtdb.firebasestorage.app'
  });
}

const db = admin.firestore();
// Use the default bucket - Firebase will handle the correct bucket name
const bucket = admin.storage().bucket();

puppeteer.use(StealthPlugin());

async function scrapeProfileViews(log) {
  const path = require('path');
  const COOKIES_PATH = path.join(__dirname, 'linkedin_cookies.json');
  const SCREENSHOT_DIR = path.join(__dirname, 'public');
  
  log('INFO', '🔧 Initializing Puppeteer browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    // Auto-generate cookies file from .env if not present
    if (!fs.existsSync(COOKIES_PATH)) {
      if (process.env.LI_AT && process.env.JSESSIONID) {
        const cookies = [
          { name: 'li_at', value: process.env.LI_AT, domain: '.linkedin.com' },
          { name: 'JSESSIONID', value: process.env.JSESSIONID.replace(/"/g, ''), domain: '.linkedin.com' }
        ];
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        log('INFO', '🍪 linkedin_cookies.json generated from .env');
      }
    }
    
    // Load cookies from file for stealth
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
      await page.setCookie(...cookies);
      log('INFO', '🍪 Session cookies loaded successfully.');
    } else {
      log('ERROR', '❌ No LinkedIn cookies found. Please upload cookies or set .env.');
      await browser.close();
      return { totalViewers: 0, freeViewers: [], allViewers: [] };
    }

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    log('INFO', '🌐 Navigating to LinkedIn profile views page...');
    await page.goto('https://www.linkedin.com/me/profile-views/', { waitUntil: 'networkidle2' });
    await new Promise(res => setTimeout(res, 3000));

    // Check for login redirect
    if (page.url().includes('/login')) {
      log('ERROR', '🚫 Session expired. Please update cookies.');
      await browser.close();
      return { totalViewers: 0, freeViewers: [], allViewers: [] };
    }

    // Human-like actions for stealth
    log('INFO', '🤖 Performing human-like interactions...');
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);
    await page.mouse.move(300, 300);
    await new Promise(res => setTimeout(res, Math.random() * 2000 + 1000));
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(res => setTimeout(res, Math.random() * 2000 + 1000));

    log('INFO', '📊 Extracting viewer data from page...');
    // Use more robust selectors for viewer cards
    const result = await page.evaluate(() => {
      let totalViewers = 0;
      // Try to get total viewers from the main analytics header
      const totalEl = document.querySelector('p.text-body-medium-bold.pr1.text-heading-large');
      if (totalEl) {
        totalViewers = parseInt(totalEl.textContent.replace(/[^\d]/g, ''));
      }
      // Find 'Viewers you can browse for free' section
      let freeViewers = [];
      let allViewers = [];
      // Use more robust selectors for viewer cards
      const viewerCards = document.querySelectorAll('.profile-view-card, .artdeco-list__item');
      viewerCards.forEach(row => {
        const name = row.querySelector('.profile-view-card__name, .artdeco-entity-lockup__title')?.textContent.trim() || '';
        const headline = row.querySelector('.profile-view-card__headline, .artdeco-entity-lockup__subtitle')?.textContent.trim() || '';
        const company = row.querySelector('.profile-view-card__company, .artdeco-entity-lockup__metadata')?.textContent.trim() || '';
        const timestamp = row.querySelector('.profile-view-card__timestamp, .member-analytics-addon-summary__list-item-date')?.textContent.trim() || '';
        allViewers.push({ name, headline, company, timestamp });
      });
      // Find free viewers section by heading text
      const freeSection = Array.from(document.querySelectorAll('section')).find(sec => sec.textContent.includes('Viewers you can browse for free'));
      if (freeSection) {
        freeViewers = Array.from(freeSection.querySelectorAll('.profile-view-card, .artdeco-list__item')).map(row => {
          const name = row.querySelector('.profile-view-card__name, .artdeco-entity-lockup__title')?.textContent.trim() || '';
          const headline = row.querySelector('.profile-view-card__headline, .artdeco-entity-lockup__subtitle')?.textContent.trim() || '';
          const company = row.querySelector('.profile-view-card__company, .artdeco-entity-lockup__metadata')?.textContent.trim() || '';
          const timestamp = row.querySelector('.profile-view-card__timestamp, .member-analytics-addon-summary__list-item-date')?.textContent.trim() || '';
          return { name, headline, company, timestamp };
        });
      }
      // Remove duplicates from allViewers
      const seen = new Set();
      allViewers = allViewers.filter(v => {
        const key = v.name + v.headline + v.company + v.timestamp;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { totalViewers, freeViewers, allViewers };
    });

    // Log and save the result
    log('INFO', `📈 Total Viewers: ${result.totalViewers}, Free Viewers: ${result.freeViewers.length}`);
    
    log('INFO', '💾 Saving viewer data to Firestore...');
    // Save individual viewers to Firestore
    let savedCount = 0;
    for (const viewer of result.allViewers) {
      if (viewer.name && viewer.name.trim()) { // Only save if name exists
        const viewerWithTimestamp = {
          ...viewer,
          timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          scraped_at: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('viewers').add(viewerWithTimestamp);
        savedCount++;
      }
    }
    log('INFO', `✅ Saved ${savedCount} viewer records to Firestore`);

    // Save daily total to Firestore
    log('INFO', '📊 Saving daily total to Firestore...');
    const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    await db.collection('daily_totals').add({
      date: today,
      total: result.totalViewers,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    log('INFO', `✅ Daily total (${result.totalViewers}) saved to Firestore`);

    // Take screenshot and upload to Firebase Storage with IST timestamp
    log('INFO', '📸 Taking screenshot...');
    const now = new Date();
    const istTime = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const [datePart, timePart] = istTime.split(', ');
    const [day, month, year] = datePart.split('/');
    const formattedDate = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    const formattedTime = timePart.replace(/:/g, '-').replace(' ', '_');
    const screenshotName = `profile-views-${formattedDate}_${formattedTime}.png`;
    
    // Save screenshot to public/screenshots directory for web access
    const publicScreenshotDir = path.join(__dirname, 'public', 'screenshots');
    if (!fs.existsSync(publicScreenshotDir)) {
      fs.mkdirSync(publicScreenshotDir, { recursive: true });
    }
    const publicScreenshotPath = path.join(publicScreenshotDir, screenshotName);
    
    await page.screenshot({ path: publicScreenshotPath, fullPage: true });
    log('INFO', `📸 Screenshot saved to public directory: ${screenshotName}`);

    // Upload screenshot to Firebase Storage (with fallback)
    const enableFirebaseStorage = process.env.ENABLE_FIREBASE_STORAGE !== 'false';
    
    if (!enableFirebaseStorage) {
      log('INFO', '📋 Firebase Storage upload disabled via environment variable');
    } else {
      log('INFO', '☁️ Attempting to upload screenshot to Firebase Storage...');
    }
    
    let firebaseUploaded = false;
    
    if (enableFirebaseStorage) {
      try {
        // Check if Firebase Storage is properly configured
        const bucketName = bucket.name;
        log('INFO', `📦 Using Firebase Storage bucket: ${bucketName}`);
        
        // Read the screenshot file
        const screenshotBuffer = fs.readFileSync(publicScreenshotPath);
        
        // Try to upload to Firebase Storage with timeout
        const file = bucket.file(`screenshots/${screenshotName}`);
        const uploadPromise = file.save(screenshotBuffer, {
          metadata: {
            contentType: 'image/png',
            metadata: {
              timestamp: istTime,
              totalViewers: result.totalViewers.toString(),
              uploadTime: new Date().toISOString()
            }
          }
        });

        // Add timeout to prevent hanging
        await Promise.race([
          uploadPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
          )
        ]);
        
        firebaseUploaded = true;
        log('INFO', '✅ Screenshot uploaded to Firebase Storage successfully');
      } catch (uploadError) {
        // Log the full error details for debugging
        if (uploadError.details) {
          log('ERROR', `⚠️ Firebase Storage upload failed: ${JSON.stringify(uploadError.details)}`);
        } else if (uploadError.message) {
          log('ERROR', `⚠️ Firebase Storage upload failed: ${uploadError.message}`);
        } else {
          log('ERROR', '⚠️ Firebase Storage upload failed: Unknown error');
        }
        
        // Check if it's a bucket configuration issue
        if (uploadError.message && uploadError.message.includes('bucket does not exist')) {
          log('ERROR', '❌ Firebase Storage bucket not found. Please ensure Firebase Storage is enabled in your project.');
          log('INFO', '💡 Tip: Go to Firebase Console > Storage and initialize Cloud Storage');
          log('INFO', '💡 Or set ENABLE_FIREBASE_STORAGE=false in .env to disable uploads');
        }
        
        log('INFO', '💾 Screenshot will be served from local public directory instead');
      }
    }
    
    if (!enableFirebaseStorage) {
      log('INFO', '💾 Screenshot will be served from local public directory');
    }
    
    // Save screenshot metadata to Firestore regardless of upload status
    try {
      await db.collection('screenshots').add({
        filename: screenshotName,
        timestamp: istTime,
        totalViewers: result.totalViewers,
        uploadTime: admin.firestore.FieldValue.serverTimestamp(),
        firebasePath: firebaseUploaded ? `screenshots/${screenshotName}` : null,
        localPath: `/screenshots/${screenshotName}`, // Web-accessible path
        status: firebaseUploaded ? 'uploaded' : 'local_only',
        size: fs.statSync(publicScreenshotPath).size,
        istTimestamp: now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      });
      
      log('INFO', '📋 Screenshot metadata saved to Firestore');
    } catch (metadataError) {
      log('ERROR', `❌ Failed to save screenshot metadata: ${metadataError.message}`);
    }

    await browser.close();
    log('INFO', '✅ Scraping completed successfully');
    return result;
  } catch (error) {
    log('ERROR', `❌ Error in scrapeProfileViews: ${error.message}`);
    
    // Ensure browser is closed even on error
    try {
      if (browser) {
        await browser.close();
      }
    } catch (closeError) {
      log('ERROR', `❌ Error closing browser: ${closeError.message}`);
    }
    
    // Return default structure instead of throwing to prevent stack overflow
    return { totalViewers: 0, freeViewers: [], allViewers: [], error: error.message };
  }
}

module.exports = scrapeProfileViews;