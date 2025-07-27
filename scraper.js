const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
// const admin = require('firebase-admin');
require('dotenv').config();

// Firebase temporarily disabled - using MongoDB instead
// Initialize Firebase Admin if not already initialized
/*
if (!admin.apps.length) {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Use the correct storage bucket for linkrtdb project
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'linkrtdb.firebasestorage.app'
  });
}
*/

// Firebase database and storage temporarily disabled - using MongoDB instead
/*
const db = admin.firestore();
// Use the default bucket - Firebase will handle the correct bucket name
const bucket = admin.storage().bucket();
*/

const { saveViewerData, saveScrapingLog } = require('./mongodb');

puppeteer.use(StealthPlugin());

async function scrapeProfileViews(storage, log, triggerType = 'manual') {
  const path = require('path');
  const COOKIES_PATH = path.join(__dirname, 'linkedin_cookies.json');
  const SCREENSHOT_DIR = path.join(__dirname, 'public');
  
  log('INFO', '🔧 Initializing Puppeteer browser...');
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    timeout: 60000 // 60 second timeout for browser launch
  });
  const page = await browser.newPage();
  
  // Set default timeout for all page operations
  page.setDefaultTimeout(60000); // 60 seconds

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
    await page.goto('https://www.linkedin.com/me/profile-views/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 // Increase timeout to 60 seconds
    });
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
      
      // Try to get total viewers from "Profile viewers in the past 90 days" section first
      const past90DaysElement = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent && el.textContent.includes('Profile viewers in the past 90 days')
      );
      
      if (past90DaysElement) {
        // Look for the number right above this text
        let current = past90DaysElement;
        while (current && current.previousElementSibling) {
          current = current.previousElementSibling;
          const text = current.textContent || '';
          const match = text.match(/(\d{1,4}(?:,\d{3})*)/);
          if (match) {
            totalViewers = parseInt(match[1].replace(/,/g, ''));
            break;
          }
        }
        
        // Also try looking in parent elements
        if (totalViewers === 0) {
          let parent = past90DaysElement.parentElement;
          while (parent && parent !== document.body) {
            const numberElements = parent.querySelectorAll('*');
            for (let el of numberElements) {
              const text = el.textContent || '';
              const match = text.match(/^(\d{1,4}(?:,\d{3})*)$/);
              if (match && parseInt(match[1].replace(/,/g, '')) > 100) {
                totalViewers = parseInt(match[1].replace(/,/g, ''));
                break;
              }
            }
            if (totalViewers > 0) break;
            parent = parent.parentElement;
          }
        }
      }
      
      // Fallback to original method if not found
      if (totalViewers === 0) {
        const totalEl = document.querySelector('p.text-body-medium-bold.pr1.text-heading-large');
        if (totalEl) {
          totalViewers = parseInt(totalEl.textContent.replace(/[^\d]/g, ''));
        }
      }
      
      // Find 'Viewers you can browse for free' section
      let freeViewers = [];
      let allViewers = [];
      
      // Use more robust selectors for viewer cards
      const viewerCards = document.querySelectorAll('.profile-view-card, .artdeco-list__item, .profile-views-analytics__item');
      viewerCards.forEach(row => {
        const name = row.querySelector('.profile-view-card__name, .artdeco-entity-lockup__title, .profile-topcard-person-entity__name')?.textContent.trim() || '';
        const headline = row.querySelector('.profile-view-card__headline, .artdeco-entity-lockup__subtitle, .profile-topcard-person-entity__headline')?.textContent.trim() || '';
        const company = row.querySelector('.profile-view-card__company, .artdeco-entity-lockup__metadata')?.textContent.trim() || '';
        
        // Try multiple selectors for timestamp/viewed time
        let timestamp = row.querySelector('.profile-view-card__timestamp, .member-analytics-addon-summary__list-item-date, .profile-views-analytics__item-time')?.textContent.trim() || '';
        
        // Also look for text nodes that might contain "Viewed X ago"
        if (!timestamp) {
          const allText = row.textContent || '';
          const timeMatch = allText.match(/Viewed (\d+) (hour|day|minute)s? ago/i);
          if (timeMatch) {
            timestamp = timeMatch[0];
          }
        }
        
        // Extract "Viewed X hours ago" information
        let viewedTime = 'Unknown';
        const timeMatch = timestamp.match(/Viewed (\d+) (hour|day|minute)s? ago/i);
        if (timeMatch) {
          const [, num, unit] = timeMatch;
          viewedTime = `${num} ${unit}${parseInt(num) !== 1 ? 's' : ''} ago`;
        } else if (timestamp && timestamp.toLowerCase().includes('ago')) {
          viewedTime = timestamp;
        } else {
          // If no "viewed time" found, use default
          viewedTime = 'Unknown';
        }
        
        allViewers.push({ name, headline, company, timestamp: '', viewedTime });
      });
      
      // Find free viewers section by heading text
      const freeSection = Array.from(document.querySelectorAll('section')).find(sec => 
        sec.textContent.includes('Viewers you can browse for free')
      );
      
      if (freeSection) {
        freeViewers = Array.from(freeSection.querySelectorAll('.profile-view-card, .artdeco-list__item, .profile-views-analytics__item')).map(row => {
          const name = row.querySelector('.profile-view-card__name, .artdeco-entity-lockup__title, .profile-topcard-person-entity__name')?.textContent.trim() || '';
          const headline = row.querySelector('.profile-view-card__headline, .artdeco-entity-lockup__subtitle, .profile-topcard-person-entity__headline')?.textContent.trim() || '';
          const company = row.querySelector('.profile-view-card__company, .artdeco-entity-lockup__metadata')?.textContent.trim() || '';
          
          // Try multiple selectors for timestamp/viewed time
          let timestamp = row.querySelector('.profile-view-card__timestamp, .member-analytics-addon-summary__list-item-date, .profile-views-analytics__item-time')?.textContent.trim() || '';
          
          // Also look for text nodes that might contain "Viewed X ago"
          if (!timestamp) {
            const allText = row.textContent || '';
            const timeMatch = allText.match(/Viewed (\d+) (hour|day|minute)s? ago/i);
            if (timeMatch) {
              timestamp = timeMatch[0];
            }
          }
          
          // Extract "Viewed X hours ago" information for free viewers too
          let viewedTime = 'Unknown';
          const timeMatch = timestamp.match(/Viewed (\d+) (hour|day|minute)s? ago/i);
          if (timeMatch) {
            const [, num, unit] = timeMatch;
            viewedTime = `${num} ${unit}${parseInt(num) !== 1 ? 's' : ''} ago`;
          } else if (timestamp && timestamp.toLowerCase().includes('ago')) {
            viewedTime = timestamp;
          } else {
            // If no "viewed time" found, use default
            viewedTime = 'Unknown';
          }
          
          return { name, headline, company, timestamp: '', viewedTime };
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
    
    // Save viewer data to MongoDB instead of Firestore
    log('INFO', '💾 Saving viewer data to MongoDB...');
    let savedCount = 0;
    try {
      for (const viewer of result.allViewers) {
        if (viewer.name && viewer.name.trim()) { // Only save if name exists
          const now = new Date();
          const istTimestamp = now.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
          
          const viewerWithTimestamp = {
            ...viewer,
            viewedTime: viewer.viewedTime || viewer.timestamp || 'Unknown', // Store the "Viewed X ago" info
            timestamp: istTimestamp, // Use IST timestamp
            istTimestamp: istTimestamp, // Add istTimestamp field
            scraped_at: istTimestamp
          };
          
          // Use the storage parameter passed from server.js
          await storage.saveViewer(viewerWithTimestamp);
          savedCount++;
        }
      }
      log('INFO', `✅ Saved ${savedCount} viewer records to MongoDB`);
    } catch (error) {
      log('ERROR', `❌ Failed to save viewers to MongoDB: ${error.message}`);
    }

    // Save daily total to MongoDB instead of Firestore
    log('INFO', '📊 Saving daily total to MongoDB...');
    try {
      const now = new Date();
      const standardTimestamp = now.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      await storage.saveDailyTotal(standardTimestamp, result.totalViewers, result.totalViewers);
      log('INFO', `✅ Daily total (${result.totalViewers}) saved to MongoDB`);
    } catch (error) {
      log('ERROR', `❌ Failed to save daily total to MongoDB: ${error.message}`);
    }

    // Take screenshot and upload to Firebase Storage with IST timestamp
    log('INFO', '📸 Taking screenshot...');
    const now = new Date();
    const istTime = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
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
    
    // Save screenshot metadata to MongoDB instead of Firestore
    try {
      const screenshotMetadata = {
        filename: screenshotName,
        timestamp: istTime,
        totalViewers: result.totalViewers,
        uploadTime: istTime, // Use standardized timestamp format
        firebasePath: firebaseUploaded ? `screenshots/${screenshotName}` : null,
        localPath: `/screenshots/${screenshotName}`, // Web-accessible path
        status: firebaseUploaded ? 'uploaded' : 'local_only',
        size: fs.statSync(publicScreenshotPath).size,
        istTimestamp: istTime, // Keep for compatibility
        triggerType: triggerType // Add trigger type to metadata
      };
      
      await storage.saveScreenshot(screenshotMetadata);
      log('INFO', '📋 Screenshot metadata saved to MongoDB');
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