require('dotenv').config();
const storage = require('./mongodb');

// Function to convert various date formats to standard format: "27/7/2025, 4:18:32 am"
function standardizeDate(dateValue) {
  if (!dateValue) return null;
  
  let date;
  
  try {
    // Handle different input types
    if (typeof dateValue === 'string') {
      // Check if it's already in the desired format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (am|pm)$/.test(dateValue)) {
        return dateValue; // Already in correct format
      }
      
      // Handle "26/07/2025 05:30:00" format
      if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(dateValue)) {
        const [datePart, timePart] = dateValue.split(' ');
        const [day, month, year] = datePart.split('/');
        const [hour, minute, second] = timePart.split(':');
        date = new Date(year, month - 1, day, hour, minute, second);
      }
      // Handle ISO format "2025-07-26T21:41:10.605Z"
      else if (dateValue.includes('T') && dateValue.includes('Z')) {
        date = new Date(dateValue);
      }
      // Try parsing as regular date string
      else {
        date = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return null;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Convert to IST and format as "27/7/2025, 4:18:32 am"
    const options = {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    return date.toLocaleString('en-IN', options);
    
  } catch (error) {
    console.error('Error standardizing date:', dateValue, error);
    return null;
  }
}

async function updateAllTimestamps() {
  console.log('🔄 Starting timestamp standardization...');
  
  try {
    // storage is already the MongoDB instance
    await storage.connect();
    
    // Update viewers collection
    console.log('📝 Updating viewers collection...');
    const viewersCollection = storage.getCollection('viewers');
    const viewers = await viewersCollection.find({}).toArray();
    
    let viewersUpdated = 0;
    for (const viewer of viewers) {
      const updates = {};
      let hasUpdates = false;
      
      if (viewer.timestamp) {
        const standardized = standardizeDate(viewer.timestamp);
        if (standardized && standardized !== viewer.timestamp) {
          updates.timestamp = standardized;
          hasUpdates = true;
        }
      }
      
      if (viewer.scraped_at) {
        const standardized = standardizeDate(viewer.scraped_at);
        if (standardized && standardized !== viewer.scraped_at) {
          updates.scraped_at = standardized;
          hasUpdates = true;
        }
      }
      
      if (hasUpdates) {
        await viewersCollection.updateOne(
          { _id: viewer._id },
          { $set: updates }
        );
        viewersUpdated++;
      }
    }
    
    console.log(`✅ Updated ${viewersUpdated} viewer records`);
    
    // Update daily totals collection
    console.log('📊 Updating daily totals collection...');
    const dailyCollection = storage.getCollection('dailyTotals');
    const dailyTotals = await dailyCollection.find({}).toArray();
    
    let dailyUpdated = 0;
    for (const daily of dailyTotals) {
      const updates = {};
      let hasUpdates = false;
      
      if (daily.date) {
        const standardized = standardizeDate(daily.date);
        if (standardized && standardized !== daily.date) {
          updates.date = standardized;
          hasUpdates = true;
        }
      }
      
      if (daily.timestamp) {
        const standardized = standardizeDate(daily.timestamp);
        if (standardized && standardized !== daily.timestamp) {
          updates.timestamp = standardized;
          hasUpdates = true;
        }
      }
      
      if (hasUpdates) {
        await dailyCollection.updateOne(
          { _id: daily._id },
          { $set: updates }
        );
        dailyUpdated++;
      }
    }
    
    console.log(`✅ Updated ${dailyUpdated} daily total records`);
    
    // Update screenshots collection
    console.log('📸 Updating screenshots collection...');
    const screenshotsCollection = storage.getCollection('screenshots');
    const screenshots = await screenshotsCollection.find({}).toArray();
    
    let screenshotsUpdated = 0;
    for (const screenshot of screenshots) {
      const updates = {};
      let hasUpdates = false;
      
      if (screenshot.timestamp) {
        const standardized = standardizeDate(screenshot.timestamp);
        if (standardized && standardized !== screenshot.timestamp) {
          updates.timestamp = standardized;
          hasUpdates = true;
        }
      }
      
      if (screenshot.istTimestamp) {
        const standardized = standardizeDate(screenshot.istTimestamp);
        if (standardized && standardized !== screenshot.istTimestamp) {
          updates.istTimestamp = standardized;
          hasUpdates = true;
        }
      }
      
      if (screenshot.uploadTime) {
        const standardized = standardizeDate(screenshot.uploadTime);
        if (standardized && standardized !== screenshot.uploadTime) {
          updates.uploadTime = standardized;
          hasUpdates = true;
        }
      }
      
      if (hasUpdates) {
        await screenshotsCollection.updateOne(
          { _id: screenshot._id },
          { $set: updates }
        );
        screenshotsUpdated++;
      }
    }
    
    console.log(`✅ Updated ${screenshotsUpdated} screenshot records`);
    
    // Update hourly stats collection
    console.log('⏰ Updating hourly stats collection...');
    const hourlyCollection = storage.getCollection('hourlyStats');
    const hourlyStats = await hourlyCollection.find({}).toArray();
    
    let hourlyUpdated = 0;
    for (const hourly of hourlyStats) {
      const updates = {};
      let hasUpdates = false;
      
      if (hourly.timestamp) {
        const standardized = standardizeDate(hourly.timestamp);
        if (standardized && standardized !== hourly.timestamp) {
          updates.timestamp = standardized;
          hasUpdates = true;
        }
      }
      
      if (hourly.hour) {
        const standardized = standardizeDate(hourly.hour);
        if (standardized && standardized !== hourly.hour) {
          updates.hour = standardized;
          hasUpdates = true;
        }
      }
      
      if (hasUpdates) {
        await hourlyCollection.updateOne(
          { _id: hourly._id },
          { $set: updates }
        );
        hourlyUpdated++;
      }
    }
    
    console.log(`✅ Updated ${hourlyUpdated} hourly stat records`);
    
    console.log('');
    console.log('🎉 Timestamp standardization completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Viewers: ${viewersUpdated} updated`);
    console.log(`   - Daily Totals: ${dailyUpdated} updated`);
    console.log(`   - Screenshots: ${screenshotsUpdated} updated`);
    console.log(`   - Hourly Stats: ${hourlyUpdated} updated`);
    console.log(`   - Total: ${viewersUpdated + dailyUpdated + screenshotsUpdated + hourlyUpdated} records updated`);
    
  } catch (error) {
    console.error('❌ Error updating timestamps:', error);
  } finally {
    process.exit(0);
  }
}

// Test the standardization function
console.log('🧪 Testing date standardization:');
console.log('Input: "26/07/2025 05:30:00" -> Output:', standardizeDate("26/07/2025 05:30:00"));
console.log('Input: "27/7/2025, 4:18:32 am" -> Output:', standardizeDate("27/7/2025, 4:18:32 am"));
console.log('Input: "2025-07-26T21:41:10.605Z" -> Output:', standardizeDate("2025-07-26T21:41:10.605Z"));
console.log('');

// Run the update
updateAllTimestamps();
