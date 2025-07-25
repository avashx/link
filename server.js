const express = require('express');
const scrapeProfileViews = require('./scraper');
const cron = require('node-cron');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const { processAllScreenshots } = require('./ocr');

let logs = [];
let scrapingProcess = null;
let cronTask = null;

function log(type, message) {
  const color = {
    INFO: chalk.blue,
    ERROR: chalk.red,
    WARN: chalk.yellow,
    NETWORK: chalk.green,
    DEBUG: chalk.magenta
  }[type];
  const entry = `${new Date().toLocaleTimeString()} [${type}] ${message}`;
  const plainEntry = `${new Date().toLocaleTimeString()} [${type}] ${message}`;
  logs.unshift(plainEntry);
  if (logs.length > 100) logs.pop();
  console.log(color ? color(entry) : entry);
}




const app = express();
app.use(express.static('public'));

// OCR API for screenshots (must be after app is initialized)
app.get('/api/screenshot-ocr', async (req, res) => {
  try {
    const results = await processAllScreenshots();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/viewers', (req, res) => {
  let total = 0;
  let freeViewers = [];
  let allViewers = [];
  if (fs.existsSync('viewers.json')) {
    const data = JSON.parse(fs.readFileSync('viewers.json'));
    total = data.total || 0;
    freeViewers = data.freeViewers || [];
    allViewers = data.allViewers || [];
  }
  res.json({ total, freeViewers, allViewers });
});

// Export viewers as CSV
app.get('/api/export-csv', (req, res) => {
  const data = fs.existsSync('viewers.json') ? JSON.parse(fs.readFileSync('viewers.json')) : [];
  let rows = [];
  // Support nested viewers array (from new scraper)
  if (data.length && data[0].viewers) {
    rows = data[0].viewers;
  } else {
    rows = data;
  }
  const header = ['Name', 'Headline', 'Company', 'Timestamp'];
  const csv = [header.join(',')].concat(
    rows.map(v => [v.name || '', v.headline || '', v.company || '', v.timestamp || ''].map(x => `"${x.replace(/"/g, '""')}"`).join(','))
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="viewers.csv"');
  res.send(csv);
});


app.get('/screenshots', (req, res) => {
  const dir = path.join(__dirname, 'public', 'screenshots');
  let files = [];
  if (fs.existsSync(dir)) {
    files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.png'))
      .map(f => `/screenshots/${f}`)
      .sort();
  }
  res.json(files);
});

app.get('/api/logs', (req, res) => {
  res.json({ logs });
});

app.post('/api/scrape', async (req, res) => {
  try {
    log('INFO', '🚀 Starting scrape process (manual trigger)');
    log('INFO', '📋 Initializing LinkedIn scraper...');
    
    // Store the scraping process
    scrapingProcess = scrapeProfileViews(log);
    const result = await scrapingProcess;
    scrapingProcess = null;
    
    log('INFO', '✅ Scrape process completed successfully');
    log('INFO', `📊 Results: ${result.totalViewers || 0} total viewers, ${result.allViewers?.length || 0} detailed records`);
    
    res.json({ status: 'done', result });
  } catch (error) {
    log('ERROR', `❌ Scrape failed: ${error.message}`);
    scrapingProcess = null;
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Enhanced stop endpoints
app.post('/api/stop-scraper', (req, res) => {
  log('INFO', '⏹ Stop scraper request received');
  
  try {
    // Stop the cron task if running
    if (cronTask) {
      cronTask.stop();
      log('INFO', '⏹ Scheduled scraping stopped');
    }
    
    // Note: Current scraper doesn't support mid-process stopping
    // But we can log the request and clear the process reference
    if (scrapingProcess) {
      log('INFO', '⚠️ Scraping process is currently running - will complete current cycle');
      scrapingProcess = null;
    }
    
    log('INFO', '✅ Stop command processed successfully');
    res.json({ 
      status: 'stopped', 
      message: 'Scraper stop command processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('ERROR', `❌ Error stopping scraper: ${error.message}`);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Alternative stop endpoint for compatibility
app.post('/api/stop', (req, res) => {
  log('INFO', '⏹ Alternative stop endpoint called');
  
  try {
    if (cronTask) {
      cronTask.stop();
      log('INFO', '⏹ Scheduled scraping stopped via /api/stop');
    }
    
    res.json({ 
      status: 'stopped', 
      message: 'Scraper stopped successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('ERROR', `❌ Error in stop endpoint: ${error.message}`);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Start scheduled scraping
function startScheduledScraping() {
  if (cronTask) {
    cronTask.destroy();
  }
  
  // Schedule every 30 minutes by default
  cronTask = cron.schedule('*/30 * * * *', () => {
    log('DEBUG', 'Starting scheduled scrape...');
    scrapeProfileViews(log).then(() => {
      log('DEBUG', 'Scheduled scrape completed');
    }).catch(error => {
      log('ERROR', `Scheduled scrape failed: ${error.message}`);
    });
  });
  
  log('INFO', '📅 Scheduled scraping started (every 30 minutes)');
}

// Start the scheduled scraping when server starts
startScheduledScraping();

app.listen(3000, () => log('INFO', 'Server running on http://localhost:3000'));