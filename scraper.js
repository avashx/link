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
    storageBucket: 'linkrtdb.appspot.com'
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

puppeteer.use(StealthPlugin());

async function scrapeProfileViews(log) {
  const path = require('path');
  const COOKIES_PATH = path.join(__dirname, 'linkedin_cookies.json');
  const SCREENSHOT_DIR = path.join(__dirname, 'public');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Auto-generate cookies file from .env if not present
  if (!fs.existsSync(COOKIES_PATH)) {
    if (process.env.LI_AT && process.env.JSESSIONID) {
      const cookies = [
        { name: 'li_at', value: process.env.LI_AT, domain: '.linkedin.com' },
        { name: 'JSESSIONID', value: process.env.JSESSIONID.replace(/"/g, ''), domain: '.linkedin.com' }
      ];
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      log('INFO', 'linkedin_cookies.json generated from .env');
    }
  }
  // Load cookies from file for stealth
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
    await page.setCookie(...cookies);
    log('INFO', 'Session cookies loaded.');
  } else {
    log('ERROR', 'No LinkedIn cookies found. Please upload cookies or set .env.');
    await browser.close();
    return [];
  }

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto('https://www.linkedin.com/me/profile-views/', { waitUntil: 'networkidle2' });
    await new Promise(res => setTimeout(res, 3000));

    // Check for login redirect
    if (page.url().includes('/login')) {
      log('ERROR', 'Session expired. Please update cookies.');
      await browser.close();
      return [];
    }

    // Human-like actions for stealth
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);
    await page.mouse.move(300, 300);
    await new Promise(res => setTimeout(res, Math.random() * 2000 + 1000));
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(res => setTimeout(res, Math.random() * 2000 + 1000));

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
    log('INFO', `Total Viewers: ${result.totalViewers}, Free Viewers: ${result.freeViewers.length}`);
    
    // Save viewer data to Firestore with IST timestamp
    for (const viewer of result.allViewers) {
      if (viewer.name && viewer.name.trim()) { // Only save if name exists
        const viewerWithTimestamp = {
          ...viewer,
          timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          scraped_at: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('viewers').add(viewerWithTimestamp);
      }
    }
    log('INFO', 'Viewer data uploaded to Firestore');

    // Save daily total to Firestore
    const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    await db.collection('daily_totals').add({
      date: today,
      total: result.totalViewers,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    log('INFO', 'Daily total saved to Firestore');

    // Take screenshot and upload to Firebase Storage with IST timestamp
    const now = new Date();
    const istTime = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const [datePart, timePart] = istTime.split(', ');
    const [day, month, year] = datePart.split('/');
    const formattedDate = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    const formattedTime = timePart.replace(/:/g, '-').replace(' ', '_');
    const screenshotName = `profile-views-${formattedDate}_${formattedTime}.png`;
    
    const screenshotPath = path.join(__dirname, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log('INFO', `Screenshot taken: ${screenshotName}`);

    // Upload screenshot to Firebase Storage
    try {
      await bucket.upload(screenshotPath, {
        destination: `screenshots/${screenshotName}`,
        metadata: {
          metadata: {
            timestamp: istTime,
            totalViewers: result.totalViewers.toString()
          }
        }
      });
      log('INFO', 'Screenshot uploaded to Firebase Storage');
      
      // Clean up local screenshot file
      fs.unlinkSync(screenshotPath);
    } catch (uploadError) {
      log('ERROR', `Failed to upload screenshot: ${uploadError.message}`);
    }

    await browser.close();
    return result;
  } catch (error) {
    log('ERROR', `Error in scrapeProfileViews: ${error.message}`);
    await browser.close();
    return [];
  }
}

module.exports = scrapeProfileViews;