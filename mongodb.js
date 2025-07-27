const { MongoClient } = require('mongodb');

class MongoDB {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Use MongoDB Atlas connection string or local MongoDB
      const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.MONGODB_DB_NAME || 'linkrtgod';
      
      console.log('🔌 Connecting to MongoDB...');
      console.log(`📍 Connection: ${connectionString.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in log
      console.log(`📂 Database: ${dbName}`);
      
      this.client = new MongoClient(connectionString, {
        serverSelectionTimeoutMS: 10000, // Increase timeout for Atlas
        connectTimeoutMS: 10000,
      });

      console.log('🔄 Attempting connection...');
      await this.client.connect();
      
      console.log('🔄 Testing database access...');
      // Test the connection
      await this.client.db(dbName).admin().ping();
      
      this.db = this.client.db(dbName);
      this.isConnected = true;
      
      console.log('✅ Connected to MongoDB successfully');
      console.log(`📊 Database: ${dbName}`);
      
      // Create indexes for better performance
      await this.createIndexes();
      
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      
      // Provide specific troubleshooting for common Atlas issues
      if (error.message.includes('bad auth')) {
        console.error('🔑 Authentication failed - check username/password');
        console.error('💡 Verify MongoDB Atlas user credentials');
        console.error('💡 Ensure database user has readWrite permissions');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
        console.error('🌐 Network connection failed');
        console.error('💡 Check internet connection');
        console.error('💡 Verify IP address is whitelisted in MongoDB Atlas');
      } else if (error.message.includes('AuthenticationFailed')) {
        console.error('🔐 MongoDB Atlas authentication failed');
        console.error('💡 Check if cluster is active (not paused)');
        console.error('💡 Verify connection string format');
      }
      
      console.error('💡 Make sure MongoDB is running or use MongoDB Atlas');
      console.error('💡 Set MONGODB_URI in .env for custom connection string');
      this.isConnected = false;
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Create indexes for better query performance
      await this.db.collection('viewers').createIndex({ "timestamp": -1 });
      await this.db.collection('viewers').createIndex({ "scraped_at": -1 });
      await this.db.collection('viewers').createIndex({ "name": 1 });
      
      await this.db.collection('daily_totals').createIndex({ "date": -1 });
      await this.db.collection('screenshots').createIndex({ "timestamp": -1 });
      
      // Add index for hourly tracking
      await this.db.collection('hourly_stats').createIndex({ "hour": -1 });
      await this.db.collection('hourly_stats').createIndex({ "timestamp": -1 });
      
      // Add index for scraping logs
      await this.db.collection('scraping_logs').createIndex({ "timestamp": -1 });
      await this.db.collection('scraping_logs').createIndex({ "triggerType": 1 });
      
      console.log('📊 MongoDB indexes created successfully');
    } catch (error) {
      console.warn('⚠️ Index creation warning:', error.message);
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  getDb() {
    if (!this.isConnected || !this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db;
  }

  // Collection helpers
  getCollection(name) {
    return this.getDb().collection(name);
  }

  // Viewers collection methods
  async addViewer(viewerData) {
    // Alias for saveViewer to match the interface expected by scraper
    return await this.saveViewer(viewerData);
  }

  async saveViewer(viewerData) {
    const collection = this.getCollection('viewers');
    
    // Determine viewer type based on name content
    const viewerType = this.determineViewerType(viewerData.name);
    
    // Check for existing viewer with same name and recent timestamp (within last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const existingViewer = await collection.findOne({
      name: viewerData.name,
      timestamp: { $gte: sevenDaysAgo }
    });
    
    // Add MongoDB document metadata with viewer type
    const istTimestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const document = {
      ...viewerData,
      type: viewerType, // Add viewer type field
      timestamp: istTimestamp, // Use IST timestamp for scraping time
      istTimestamp: istTimestamp, // Add istTimestamp field
      scraped_at: viewerData.scraped_at || istTimestamp,
      _id: undefined, // Let MongoDB generate the ID
      created_at: new Date()
    };
    
    if (existingViewer) {
      // Update existing viewer with most recent data
      const updateResult = await collection.updateOne(
        { _id: existingViewer._id },
        { 
          $set: {
            ...document,
            _id: existingViewer._id, // Keep original ID
            created_at: existingViewer.created_at, // Keep original creation date
            updated_at: new Date() // Add update timestamp
          }
        }
      );
      console.log(`Updated existing viewer: ${viewerData.name}`);
      return updateResult;
    } else {
      // Insert new viewer
      const result = await collection.insertOne(document);
      console.log(`New viewer added: ${viewerData.name} (${viewerType})`);
      return result;
    }
  }

  // Helper method to determine viewer type
  determineViewerType(name) {
    if (!name || typeof name !== 'string') {
      return 'premium'; // Default for unknown
    }
    
    const lowerName = name.toLowerCase();
    
    // Premium/anonymous viewer patterns
    if (lowerName.includes('someone at') || 
        lowerName.includes('linkedin member') ||
        lowerName.includes('work at') ||
        lowerName.includes('found you through') ||
        lowerName.includes('has a connection') ||
        name.length < 3) {
      return 'premium';
    }
    
    // Free viewer (visible name)
    return 'free';
  }

  async saveViewers(viewersArray) {
    const results = [];
    
    // Process each viewer individually to handle duplicates properly
    for (const viewer of viewersArray) {
      try {
        const result = await this.saveViewer(viewer);
        results.push(result);
      } catch (error) {
        console.error(`Error saving viewer ${viewer.name}:`, error.message);
      }
    }
    
    return results;
  }

  async getViewers(limit = 50) {
    const collection = this.getCollection('viewers');
    const viewers = await collection
      .find({})
      .sort({ scraped_at: -1 })
      .limit(limit)
      .toArray();
    return viewers;
  }

  async getFreeViewers(limit = 50) {
    const collection = this.getCollection('viewers');
    
    // Query using the type field for better performance
    const freeViewers = await collection
      .find({ type: 'free' })
      .sort({ scraped_at: -1 })
      .limit(limit)
      .toArray();
    
    return freeViewers;
  }

  // Daily totals collection methods
  async saveDailyTotal(date, increment, absoluteTotal = null) {
    const collection = this.getCollection('daily_totals');
    
    // Generate IST timestamp
    const istTimestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const document = {
      date: date,
      total: increment, // This is the daily increment
      absoluteTotal: absoluteTotal, // This is the cumulative total
      timestamp: istTimestamp,
      istTimestamp: istTimestamp, // Add istTimestamp field
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Upsert based on date
    const result = await collection.replaceOne(
      { date: date },
      document,
      { upsert: true }
    );
    
    return result;
  }

  async getDailyTotal(date) {
    const collection = this.getCollection('daily_totals');
    const total = await collection.findOne({ date: date });
    return total;
  }

  async getDailyTotals(limit = 30) {
    const collection = this.getCollection('daily_totals');
    const totals = await collection
      .find({})
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
    return totals;
  }

  // Screenshots collection methods
  async saveScreenshot(screenshotData) {
    const collection = this.getCollection('screenshots');
    
    // Generate IST timestamp if not provided
    const istTimestamp = screenshotData.istTimestamp || new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const document = {
      ...screenshotData,
      istTimestamp: istTimestamp, // Ensure istTimestamp field exists
      timestamp: screenshotData.timestamp || istTimestamp, // Use provided timestamp or IST
      _id: undefined, // Let MongoDB generate the ID
      created_at: new Date(),
      uploaded_at: new Date()
    };
    
    const result = await collection.insertOne(document);
    return result;
  }

  // Save screenshot with binary data for serverless deployment
  async saveScreenshotWithData(filename, imageBuffer, metadata = {}) {
    const collection = this.getCollection('screenshots');
    
    // Generate IST timestamp
    const istTimestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const document = {
      filename: filename,
      imageData: imageBuffer.toString('base64'), // Store as base64
      contentType: 'image/png',
      size: imageBuffer.length,
      istTimestamp: istTimestamp,
      timestamp: istTimestamp,
      created_at: new Date(),
      uploaded_at: new Date(),
      ...metadata // Include any additional metadata
    };
    
    const result = await collection.insertOne(document);
    return result;
  }

  // Get screenshot binary data by filename
  async getScreenshotData(filename) {
    const collection = this.getCollection('screenshots');
    const screenshot = await collection.findOne({ filename: filename });
    
    if (screenshot && screenshot.imageData) {
      return {
        data: Buffer.from(screenshot.imageData, 'base64'),
        contentType: screenshot.contentType || 'image/png',
        filename: screenshot.filename,
        metadata: screenshot
      };
    }
    
    return null;
  }

  async getScreenshots(limit = 20) {
    const collection = this.getCollection('screenshots');
    const screenshots = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    return screenshots;
  }

  // Analytics methods
  async getStats() {
    const viewersCollection = this.getCollection('viewers');
    const dailyTotalsCollection = this.getCollection('daily_totals');
    const screenshotsCollection = this.getCollection('screenshots');

    // Get the latest daily total to get the actual profile views count
    const latestDailyTotal = await dailyTotalsCollection
      .findOne({}, { sort: { date: -1 } });
    
    const actualTotalProfileViews = latestDailyTotal?.absoluteTotal || 0;

    const [
      totalViewersRecords,
      totalDailyRecords,
      totalScreenshots,
      freeViewersCount
    ] = await Promise.all([
      viewersCollection.countDocuments(),
      dailyTotalsCollection.countDocuments(),
      screenshotsCollection.countDocuments(),
      viewersCollection.countDocuments({ type: 'free' })
    ]);

    return {
      totalViewers: actualTotalProfileViews, // This is the actual profile views count
      totalViewersRecords: totalViewersRecords, // This is just the count of viewer records
      totalDailyRecords,
      totalScreenshots,
      freeViewersCount,
      premiumViewersCount: totalViewersRecords - freeViewersCount
    };
  }

  // Get viewers from past X hours
  async getViewersFromPastHours(hours = 24) {
    const collection = this.getCollection('viewers');
    const hoursAgo = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const count = await collection.countDocuments({
      scraped_at: { $gte: hoursAgo }
    });
    
    return count;
  }

  // Hourly statistics methods
  async saveHourlyStats(hourTimestamp, actualTotalViewers = null) {
    const collection = this.getCollection('hourly_stats');
    
    // Generate IST timestamp
    const istTimestamp = new Date(hourTimestamp).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    // Use actual scraped total if provided, otherwise get from latest daily total
    let totalViewers = actualTotalViewers;
    if (totalViewers === null) {
      const dailyTotalsCollection = this.getCollection('daily_totals');
      const latestDailyTotal = await dailyTotalsCollection
        .findOne({}, { sort: { date: -1 } });
      totalViewers = latestDailyTotal?.absoluteTotal || 0;
    }
    
    // Get the hour as a string (YYYY-MM-DD HH:00)
    const hourKey = new Date(hourTimestamp).toISOString().slice(0, 13) + ':00:00.000Z';
    
    // Get the previous hour's count for calculating increase
    const previousHour = new Date(hourTimestamp.getTime() - 60 * 60 * 1000);
    const previousHourKey = previousHour.toISOString().slice(0, 13) + ':00:00.000Z';
    
    const previousStats = await collection.findOne({ hour: previousHourKey });
    const previousTotal = previousStats ? previousStats.totalViewers : 0;
    const viewerIncrease = Math.max(0, totalViewers - previousTotal);
    
    const document = {
      hour: hourKey,
      timestamp: new Date(hourTimestamp),
      istTimestamp: istTimestamp, // Add istTimestamp field
      totalViewers: totalViewers,
      viewerIncrease: viewerIncrease,
      scrapedTotal: actualTotalViewers, // Store the actual scraped total for reference
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Upsert based on hour
    const result = await collection.replaceOne(
      { hour: hourKey },
      document,
      { upsert: true }
    );
    
    console.log(`📊 Hourly stats saved: ${hourKey} - Total: ${totalViewers}, Increase: ${viewerIncrease}`);
    return result;
  }

  async getHourlyStats(limit = 168) { // Default to 7 days (168 hours)
    const collection = this.getCollection('hourly_stats');
    const stats = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return stats.reverse(); // Return in chronological order for the chart
  }

  async getHourlyStatsInRange(startDate, endDate) {
    const collection = this.getCollection('hourly_stats');
    const stats = await collection
      .find({
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      })
      .sort({ timestamp: 1 })
      .toArray();
    
    return stats;
  }
  
  // Scraping logs methods
  async saveScrapingLog(triggerType, status, details = {}) {
    const collection = this.getCollection('scraping_logs');
    const now = new Date();
    const newDelhiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    
    const document = {
      timestamp: newDelhiTime.toISOString(),
      triggerType: triggerType, // 'manual' or 'automatic'
      status: status, // 'started', 'completed', 'failed'
      details: details,
      screenshotTaken: details.screenshotTaken || false, // Track if screenshot was taken
      successful: details.successful !== undefined ? details.successful : (status === 'completed'), // Track success
      totalViewers: details.totalViewers || 0, // Track total viewers found
      freeViewers: details.freeViewers || 0, // Track free viewers found
      duration: details.duration || 0, // Track scraping duration in seconds
      errorMessage: details.errorMessage || null, // Store error message if failed
      istTimestamp: now.toLocaleString("en-IN", { 
        timeZone: "Asia/Kolkata",
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      created_at: newDelhiTime
    };
    
    const result = await collection.insertOne(document);
    console.log(`📋 Scraping log saved: ${triggerType} - ${status}`);
    return result;
  }
  
  async getScrapingLogs(limit = 50) {
    const collection = this.getCollection('scraping_logs');
    const logs = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    return logs;
  }
  
  async getLastScrapingLog() {
    const collection = this.getCollection('scraping_logs');
    const log = await collection
      .findOne(
        { status: 'completed' },
        { sort: { timestamp: -1 } }
      );
    return log;
  }
  
  async getNextScheduledScrapeTime(schedule = 'hourly') {
    const now = new Date();
    const next = new Date(now);
    
    switch (schedule) {
      case 'hourly':
        next.setHours(next.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const daysUntilNextWeek = 7 - next.getDay();
        next.setDate(next.getDate() + daysUntilNextWeek);
        next.setHours(0, 0, 0, 0);
        break;
      case 'disabled':
        return null;
      default:
        next.setHours(next.getHours() + 1, 0, 0, 0);
    }
    
    return next.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

module.exports = MongoDB;

// Create singleton instance
const mongoDB = new MongoDB();

module.exports = mongoDB;
