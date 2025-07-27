const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
require('dotenv').config();

puppeteer.use(StealthPlugin());

async function scrapeProfileViewers(storage, log) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  const page = await browser.newPage();

  await page.setCookie(
    { name: 'li_at', value: process.env.LI_AT, domain: '.linkedin.com' },
    { name: 'JSESSIONID', value: process.env.JSESSIONID.replace(/"/g, ''), domain: '.linkedin.com' }
  );
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto('https://www.linkedin.com/analytics/profile-views/', { waitUntil: 'networkidle2' });
    // Human-like actions
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);
    await page.mouse.move(300, 300);
    await new Promise(res => setTimeout(res, Math.random() * 2000 + 1000));
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(res => setTimeout(res, Math.random() * 2000 + 1000));

    // Scrape up to 3 visible viewer names
    const viewers = await page.evaluate(() => {
      // Adjust selector as needed based on LinkedIn's DOM
      const items = Array.from(document.querySelectorAll('[data-viewer-name], .profile-viewer-card, .artdeco-entity-lockup__title'));
      return items.slice(0, 3).map(item => ({
        name: item.innerText.trim(),
        timestamp: new Date().toISOString()
      }));
    });

    // Store new viewers using storage abstraction
    for (const viewer of viewers) {
      await storage.addViewer(viewer);
    }
    log('INFO', `Scraped viewers: ${viewers.map(v => v.name).join(', ')}`);
    await browser.close();
    return viewers;
  } catch (err) {
    log('ERROR', err.message);
    await browser.close();
    return [];
  }
}

module.exports = { scrapeProfileViewers };
