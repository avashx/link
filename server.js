let logs = [];

function log(type, message) {
  const color = {
    INFO: chalk.blue,
    ERROR: chalk.red,
    WARN: chalk.yellow,
    NETWORK: chalk.green,
    DEBUG: chalk.magenta
  }[type];
  const entry = `${new Date().toLocaleTimeString()} [${type}] ${message}`;
  logs.unshift((color ? color(entry) : chalk.white(entry)));
  if (logs.length > 100) logs.pop();
}
const express = require('express');
const scrapeProfileViews = require('./scraper');
const cron = require('node-cron');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const { processAllScreenshots } = require('./ocr');




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
  log('DEBUG', 'Starting scrapeProfileViews (manual trigger)');
  await scrapeProfileViews(log);
  log('DEBUG', 'Finished scrapeProfileViews (manual trigger)');
  res.json({ status: 'done' });
});

// Schedule every 3 minutes
cron.schedule('*/3 * * * *', () => {
  log('DEBUG', 'Starting scrapeProfileViews (cron)');
  scrapeProfileViews(log);
  log('DEBUG', 'Finished scrapeProfileViews (cron)');
  log('INFO', 'Scheduled scrape triggered');
});

app.listen(3000, () => log('INFO', 'Server running on http://localhost:3000'));