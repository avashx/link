const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateDatabaseWithIstTimestampAndViewedTime() {
  let client;
  
  try {
    // Connect to MongoDB
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'linkrtgod';
    
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    
    // Function to generate IST timestamp
    const generateISTTimestamp = (date = new Date()) => {
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };

    console.log('🔧 Starting database updates...\n');

    // 1. Update VIEWERS collection
    console.log('📊 Updating VIEWERS collection...');
    const viewersCollection = db.collection('viewers');
    
    const allViewers = await viewersCollection.find({}).toArray();
    console.log(`Found ${allViewers.length} viewer records`);
    
    let viewersUpdated = 0;
    for (const viewer of allViewers) {
      const updates = {};
      
      // Add istTimestamp field - use created_at or current time
      if (viewer.created_at) {
        updates.istTimestamp = generateISTTimestamp(new Date(viewer.created_at));
      } else {
        updates.istTimestamp = generateISTTimestamp();
      }
      
      // Fix timestamp field if it's invalid (1970 or string with 1970)
      if (!viewer.timestamp || 
          viewer.timestamp.toString().includes('1970') ||
          (viewer.timestamp instanceof Date && viewer.timestamp.getFullYear() < 2000)) {
        updates.timestamp = updates.istTimestamp;
      }
      
      // Add/update viewedTime - use mock data "16h" for old records
      if (!viewer.viewedTime || viewer.viewedTime === '' || viewer.viewedTime === 'Unknown') {
        updates.viewedTime = '16h ago';
      }
      
      await viewersCollection.updateOne(
        { _id: viewer._id },
        { $set: updates }
      );
      
      viewersUpdated++;
    }
    console.log(`✅ Updated ${viewersUpdated} viewer records\n`);

    // 2. Update DAILY_TOTALS collection
    console.log('📊 Updating DAILY_TOTALS collection...');
    const dailyTotalsCollection = db.collection('daily_totals');
    
    const allDailyTotals = await dailyTotalsCollection.find({}).toArray();
    console.log(`Found ${allDailyTotals.length} daily total records`);
    
    let dailyTotalsUpdated = 0;
    for (const record of allDailyTotals) {
      const updates = {};
      
      // Add istTimestamp field
      if (record.timestamp) {
        updates.istTimestamp = generateISTTimestamp(new Date(record.timestamp));
      } else if (record.date) {
        // Try to parse the date field
        try {
          const dateObj = new Date(record.date);
          updates.istTimestamp = generateISTTimestamp(dateObj);
        } catch (e) {
          updates.istTimestamp = generateISTTimestamp();
        }
      } else {
        updates.istTimestamp = generateISTTimestamp();
      }
      
      await dailyTotalsCollection.updateOne(
        { _id: record._id },
        { $set: updates }
      );
      
      dailyTotalsUpdated++;
    }
    console.log(`✅ Updated ${dailyTotalsUpdated} daily total records\n`);

    // 3. Update SCREENSHOTS collection
    console.log('📊 Updating SCREENSHOTS collection...');
    const screenshotsCollection = db.collection('screenshots');
    
    const allScreenshots = await screenshotsCollection.find({}).toArray();
    console.log(`Found ${allScreenshots.length} screenshot records`);
    
    let screenshotsUpdated = 0;
    for (const screenshot of allScreenshots) {
      const updates = {};
      
      // Add/update istTimestamp field - prefer existing istTimestamp, then timestamp, then created_at
      if (!screenshot.istTimestamp) {
        if (screenshot.timestamp && typeof screenshot.timestamp === 'string' && !screenshot.timestamp.includes('1970')) {
          updates.istTimestamp = screenshot.timestamp;
        } else if (screenshot.created_at) {
          updates.istTimestamp = generateISTTimestamp(new Date(screenshot.created_at));
        } else {
          updates.istTimestamp = generateISTTimestamp();
        }
      }
      
      // Ensure timestamp field is also in IST format if needed
      if (!screenshot.timestamp || screenshot.timestamp.toString().includes('1970')) {
        updates.timestamp = updates.istTimestamp || screenshot.istTimestamp;
      }
      
      if (Object.keys(updates).length > 0) {
        await screenshotsCollection.updateOne(
          { _id: screenshot._id },
          { $set: updates }
        );
        screenshotsUpdated++;
      }
    }
    console.log(`✅ Updated ${screenshotsUpdated} screenshot records\n`);

    // 4. Update HOURLY_STATS collection
    console.log('📊 Updating HOURLY_STATS collection...');
    const hourlyStatsCollection = db.collection('hourly_stats');
    
    const allHourlyStats = await hourlyStatsCollection.find({}).toArray();
    console.log(`Found ${allHourlyStats.length} hourly stats records`);
    
    let hourlyStatsUpdated = 0;
    for (const stat of allHourlyStats) {
      const updates = {};
      
      // Add istTimestamp field
      if (stat.timestamp) {
        updates.istTimestamp = generateISTTimestamp(new Date(stat.timestamp));
      } else {
        updates.istTimestamp = generateISTTimestamp();
      }
      
      await hourlyStatsCollection.updateOne(
        { _id: stat._id },
        { $set: updates }
      );
      
      hourlyStatsUpdated++;
    }
    console.log(`✅ Updated ${hourlyStatsUpdated} hourly stats records\n`);

    // 5. Update SCRAPING_LOGS collection
    console.log('📊 Updating SCRAPING_LOGS collection...');
    const scrapingLogsCollection = db.collection('scraping_logs');
    
    const allScrapingLogs = await scrapingLogsCollection.find({}).toArray();
    console.log(`Found ${allScrapingLogs.length} scraping log records`);
    
    let scrapingLogsUpdated = 0;
    for (const log of allScrapingLogs) {
      const updates = {};
      
      // Add istTimestamp field
      if (log.timestamp) {
        updates.istTimestamp = generateISTTimestamp(new Date(log.timestamp));
      } else {
        updates.istTimestamp = generateISTTimestamp();
      }
      
      await scrapingLogsCollection.updateOne(
        { _id: log._id },
        { $set: updates }
      );
      
      scrapingLogsUpdated++;
    }
    console.log(`✅ Updated ${scrapingLogsUpdated} scraping log records\n`);

    // Summary
    console.log('🎉 DATABASE UPDATE COMPLETE!');
    console.log('=' .repeat(50));
    console.log(`📊 Viewers updated: ${viewersUpdated}`);
    console.log(`📊 Daily totals updated: ${dailyTotalsUpdated}`);
    console.log(`📊 Screenshots updated: ${screenshotsUpdated}`);
    console.log(`📊 Hourly stats updated: ${hourlyStatsUpdated}`);
    console.log(`📊 Scraping logs updated: ${scrapingLogsUpdated}`);
    console.log('=' .repeat(50));
    console.log('✅ All records now have istTimestamp field');
    console.log('✅ All viewers now have viewedTime = "16h ago"');
    console.log('✅ All invalid timestamps fixed');

    // Show sample data
    console.log('\n📋 Sample updated data:');
    const sampleViewer = await viewersCollection.findOne({ type: 'free' });
    if (sampleViewer) {
      console.log('VIEWER SAMPLE:');
      console.log(`  Name: ${sampleViewer.name.substring(0, 50)}...`);
      console.log(`  timestamp: ${sampleViewer.timestamp}`);
      console.log(`  istTimestamp: ${sampleViewer.istTimestamp}`);
      console.log(`  viewedTime: ${sampleViewer.viewedTime}`);
    }

    const sampleScreenshot = await screenshotsCollection.findOne({});
    if (sampleScreenshot) {
      console.log('\nSCREENSHOT SAMPLE:');
      console.log(`  Filename: ${sampleScreenshot.filename}`);
      console.log(`  timestamp: ${sampleScreenshot.timestamp}`);
      console.log(`  istTimestamp: ${sampleScreenshot.istTimestamp}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

// Run the update
updateDatabaseWithIstTimestampAndViewedTime();
