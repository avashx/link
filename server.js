const express = require('express');
const scrapeProfileViews = require('./scraper'); // Changed from destructuring to direct import
const cron = require('node-cron');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const mongoDB = require('./mongodb');
const JSONStorage = require('./json-storage');

let logs = [];
let scrapingProcess = null;
let cronTask = null;
let storage = null; // Will be either MongoDB or JSON storage

function log(type, message) {
  const color = {
    INFO: chalk.blue,
    ERROR: chalk.red,
    WARN: chalk.yellow,
    NETWORK: chalk.green,
    DEBUG: chalk.magenta
  }[type];
  const delhiTime = new Date().toLocaleTimeString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  const entry = `${delhiTime} [${type}] ${message}`;
  const plainEntry = `${delhiTime} [${type}] ${message}`;
  logs.unshift(plainEntry);
  if (logs.length > 100) logs.pop();
  console.log(color ? color(entry) : entry);
}

// Initialize storage (MongoDB or JSON fallback)
async function initializeStorage() {
  try {
    await mongoDB.connect();
    storage = mongoDB;
    log('INFO', '✅ MongoDB connected successfully');
  } catch (error) {
    log('ERROR', `❌ MongoDB connection failed: ${error.message}`);
    log('WARN', '🔄 Falling back to JSON file storage');
    
    // Initialize JSON storage as fallback
    storage = new JSONStorage();
    await storage.connect();
    log('INFO', '✅ JSON storage initialized as fallback');
    log('WARN', '💡 Fix MongoDB Atlas connection to use cloud storage');
  }
}

const app = express();
app.use(express.static('public'));
// Serve screenshot images from root directory
app.use('/screenshots', express.static('.', {
  setHeaders: (res, path) => {
    if (path.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
    }
  }
}));
app.use(express.json()); // Add JSON middleware for API requests

app.get('/api/viewers', (req, res) => {
  try {
    let data = [];
    if (fs.existsSync('viewers.json')) {
      data = JSON.parse(fs.readFileSync('viewers.json'));
    }
    const freeViewers = data.filter(item => !item.name.includes('work at') && !item.name.includes('found you through'));
    res.json({
      total: data.length,
      freeViewers: freeViewers.slice(0, 10),
      allViewers: data
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/api/export-csv', (req, res) => {
  try {
    let data = [];
    if (fs.existsSync('viewers.json')) {
      data = JSON.parse(fs.readFileSync('viewers.json'));
    }
    
    let csv = 'Name,Headline,Company,Timestamp\n';
    data.forEach(viewer => {
      csv += `"${viewer.name}","${viewer.headline || ''}","${viewer.company || ''}","${viewer.timestamp || ''}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="linkedin_viewers.csv"');
    res.send(csv);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/screenshots', (req, res) => {
  try {
    const files = fs.readdirSync('.')
      .filter(file => file.startsWith('profile-views-') && file.endsWith('.png'))
      .map(file => ({
        name: file,
        url: `/${file}`,
        timestamp: fs.statSync(file).mtime
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(files);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100; // Allow configurable limit, default 100
  res.json(logs.slice(-limit)); // Return last N logs
});

// MongoDB API endpoints
app.get('/api/mongodb/viewers', async (req, res) => {
  try {
    const viewers = await storage.getViewers();
    const freeViewers = viewers.filter(viewer => 
      viewer.name && 
      !viewer.name.includes('work at') && 
      !viewer.name.includes('found you through') &&
      !viewer.name.includes('has a connection') &&
      !viewer.name.toLowerCase().includes('someone at')
    );
    
    res.json({
      success: true,
      data: viewers.slice(0, 50) // Return viewers array directly as expected by frontend
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/free-viewers', async (req, res) => {
  try {
    const viewers = await storage.getViewers();
    const freeViewers = viewers.filter(viewer => 
      viewer.name && 
      !viewer.name.includes('work at') && 
      !viewer.name.includes('found you through') &&
      !viewer.name.includes('has a connection') &&
      !viewer.name.toLowerCase().includes('someone at')
    ).map(viewer => {
      // Clean up the name by removing the duplicate pattern
      let cleanName = viewer.name;
      
      // Simple approach: if name contains "View [Same Name]'s profile", extract the first part
      if (cleanName.includes('View') && cleanName.includes("'s profile")) {
        // Find the first occurrence of "View" and take everything before it
        const viewIndex = cleanName.indexOf('View');
        if (viewIndex > 0) {
          const beforeView = cleanName.substring(0, viewIndex).trim();
          if (beforeView.length > 2) {
            cleanName = beforeView;
          }
        }
      }
      
      // Remove extra whitespace and newlines
      cleanName = cleanName.replace(/\s+/g, ' ').trim();
      
      return {
        ...viewer,
        name: cleanName || viewer.name // fallback to original if cleaning failed
      };
    });
    
    res.json({
      success: true,
      data: freeViewers
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/daily-totals', async (req, res) => {
  try {
    const dailyTotals = await storage.getDailyTotals();
    res.json({
      success: true,
      data: dailyTotals
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/screenshots', async (req, res) => {
  try {
    const screenshots = await storage.getScreenshots();
    res.json({
      success: true,
      data: screenshots
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/stats', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/past-hours', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const viewers = await storage.getViewers();
    const recentViewers = viewers.filter(v => new Date(v.timestamp) > cutoff);
    
    res.json({
      success: true,
      data: {
        hours,
        total: recentViewers.length,
        viewers: recentViewers
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/status', (req, res) => {
  res.json({
    connected: true,
    usingMongoDB: storage === mongoDB,
    usingFallback: storage !== mongoDB,
    storageType: storage === mongoDB ? 'MongoDB Atlas' : 'JSON Files',
    database: storage === mongoDB ? process.env.MONGODB_DB_NAME : './data/',
    timestamp: new Date().toISOString()
  });
});

// Hourly statistics endpoints
app.get('/api/mongodb/hourly-stats', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 168; // Default 7 days
    const hourlyStats = await storage.getHourlyStats(limit);
    
    res.json({
      success: true,
      data: hourlyStats
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/hourly-stats-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.json({ 
        success: false, 
        error: 'startDate and endDate parameters are required' 
      });
    }
    
    const hourlyStats = await storage.getHourlyStatsInRange(startDate, endDate);
    
    res.json({
      success: true,
      data: hourlyStats,
      range: { startDate, endDate }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Scraping logs endpoints
app.get('/api/mongodb/scraping-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const scrapingLogs = await storage.getScrapingLogs(limit);
    
    res.json({
      success: true,
      data: scrapingLogs
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/mongodb/last-scraping-log', async (req, res) => {
  try {
    const lastLog = await storage.getLastScrapingLog();
    const nextScheduled = await storage.getNextScheduledScrapeTime();
    
    res.json({
      success: true,
      data: {
        lastLog: lastLog,
        nextScheduled: nextScheduled
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    storage: storage === mongoDB ? 'mongodb' : 'json',
    timestamp: new Date().toISOString()
  });
});

// Enhanced status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    scrapingActive: scrapingProcess !== null,
    scheduledScraping: cronTask !== null,
    lastLogCount: logs.length,
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    uptime: `${Math.floor(process.uptime())}s`
  });
});

app.post('/api/scrape', async (req, res) => {
  if (scrapingProcess) {
    return res.json({ status: 'error', message: 'Scraping already in progress' });
  }

  const startTime = new Date();
  
  try {
    log('INFO', '🔄 Manual scraping started');
    scrapingProcess = { status: 'running', startTime: startTime };
    
    // Log scraping start
    try {
      await storage.saveScrapingLog('manual', 'started', {
        message: 'Manual scraping initiated',
        startTime: startTime.toISOString()
      });
    } catch (logError) {
      log('WARN', `Failed to log scraping start: ${logError.message}`);
    }
    
    const result = await scrapeProfileViews(storage, log, 'manual');
    
    // Save hourly stats after successful manual scraping with actual total
    try {
      await storage.saveHourlyStats(new Date(), result.totalViewers);
      log('INFO', '📊 Hourly statistics saved successfully');
    } catch (statsError) {
      log('ERROR', `❌ Failed to save hourly stats: ${statsError.message}`);
    }
    
    scrapingProcess = null;
    log('INFO', '✅ Manual scraping completed');
    
    // Log successful completion
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    try {
      await storage.saveScrapingLog('manual', 'completed', {
        message: 'Manual scraping completed successfully',
        successful: true,
        screenshotTaken: !result.error,
        totalViewers: result.totalViewers || 0,
        freeViewers: (result.freeViewers || []).length,
        duration: duration,
        endTime: endTime.toISOString()
      });
    } catch (logError) {
      log('WARN', `Failed to log scraping completion: ${logError.message}`);
    }
    
    res.json({ 
      status: 'done', 
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    scrapingProcess = null;
    log('ERROR', `❌ Manual scraping failed: ${error.message}`);
    
    // Log scraping failure
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    try {
      await storage.saveScrapingLog('manual', 'failed', {
        message: 'Manual scraping failed',
        successful: false,
        screenshotTaken: false,
        duration: duration,
        endTime: endTime.toISOString(),
        errorMessage: error.message
      });
    } catch (logError) {
      log('WARN', `Failed to log scraping failure: ${logError.message}`);
    }
    
    res.json({ 
      status: 'error', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Function to scrape with timeout and process management
async function scrapeWithTimeout() {
  if (scrapingProcess) {
    log('WARN', '⏭️ Skipping scheduled scrape - manual scrape in progress');
    return;
  }

  const startTime = new Date();
  
  try {
    log('INFO', '⏰ Scheduled scraping started');
    scrapingProcess = { status: 'running', startTime: startTime };
    
    // Log scheduled scraping start
    try {
      await storage.saveScrapingLog('automatic', 'started', {
        message: 'Scheduled scraping initiated',
        startTime: startTime.toISOString()
      });
    } catch (logError) {
      log('WARN', `Failed to log scheduled scraping start: ${logError.message}`);
    }
    
    const result = await scrapeProfileViews(storage, log, 'automatic');
    
    // Save hourly stats after successful scraping with actual total
    try {
      await storage.saveHourlyStats(new Date(), result.totalViewers);
      log('INFO', '📊 Hourly statistics saved successfully');
    } catch (statsError) {
      log('ERROR', `❌ Failed to save hourly stats: ${statsError.message}`);
    }
    
    scrapingProcess = null;
    log('INFO', `✅ Scheduled scraping completed - Found ${result.totalViewers} viewers`);
    
    // Log successful completion
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    try {
      await storage.saveScrapingLog('automatic', 'completed', {
        message: 'Scheduled scraping completed successfully',
        successful: true,
        screenshotTaken: !result.error,
        totalViewers: result.totalViewers || 0,
        freeViewers: (result.freeViewers || []).length,
        duration: duration,
        endTime: endTime.toISOString()
      });
    } catch (logError) {
      log('WARN', `Failed to log scheduled scraping completion: ${logError.message}`);
    }
    
  } catch (error) {
    scrapingProcess = null;
    log('ERROR', `❌ Scheduled scraping failed: ${error.message}`);
    
    // Log scraping failure
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    try {
      await storage.saveScrapingLog('automatic', 'failed', {
        message: 'Scheduled scraping failed',
        successful: false,
        screenshotTaken: false,
        duration: duration,
        endTime: endTime.toISOString(),
        errorMessage: error.message
      });
    } catch (logError) {
      log('WARN', `Failed to log scheduled scraping failure: ${logError.message}`);
    }
  }
}

app.post('/api/stop-scraper', (req, res) => {
  if (scrapingProcess) {
    scrapingProcess = null;
    log('INFO', '🛑 Scraping process stopped');
    res.json({ status: 'stopped', message: 'Scraping process terminated' });
  } else {
    res.json({ status: 'not_running', message: 'No scraping process to stop' });
  }
});

// Update scraping schedule
app.post('/api/update-schedule', (req, res) => {
  try {
    const { schedule } = req.body;
    
    if (!schedule) {
      return res.json({ success: false, error: 'Schedule parameter is required' });
    }
    
    // Stop current cron task
    if (cronTask) {
      cronTask.destroy();
      log('INFO', '📅 Previous scheduled scraping stopped');
    }
    
    // Start new cron task with updated schedule
    cronTask = cron.schedule(schedule, scrapeWithTimeout, {
      scheduled: true,
      timezone: "America/New_York"
    });
    
    log('INFO', `📅 Scheduled scraping updated: ${schedule}`);
    
    res.json({ 
      success: true, 
      message: 'Scraping schedule updated successfully',
      schedule: schedule 
    });
    
  } catch (error) {
    log('ERROR', `❌ Failed to update schedule: ${error.message}`);
    res.json({ success: false, error: error.message });
  }
});

// Schedule scraping every hour (changed from 30 minutes)
cronTask = cron.schedule('0 * * * *', scrapeWithTimeout, {
  scheduled: true,
  timezone: "America/New_York"
});

log('INFO', '📅 Scheduled scraping started (every hour)');

// Test the cron immediately (for debugging)
// scrapeWithTimeout();

// Graceful shutdown handler
process.on('SIGINT', async () => {
  log('INFO', '🛑 Shutting down server...');
  
  if (cronTask) {
    cronTask.destroy();
    log('INFO', '📅 Scheduled scraping stopped');
  }
  
  if (storage && storage.close) {
    await storage.close();
    log('INFO', '💾 Database connection closed');
  }
  
  process.exit(0);
});

app.post('/api/stop', (req, res) => {
  res.json({ message: 'Server shutting down...' });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Initialize storage and start server
(async () => {
  await initializeStorage();
  
  // Start the server only after storage is initialized
  app.listen(3000, () => log('INFO', 'Server running on http://localhost:3000'));
})();