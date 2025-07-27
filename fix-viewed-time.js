const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixViewedTimeData() {
  let client;
  
  try {
    // Connect to MongoDB
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'linkrtgod';
    
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    const viewersCollection = db.collection('viewers');
    
    console.log('🔍 Finding records with invalid timestamps...');
    
    // Find all records with 1970 timestamp strings
    const invalidRecords = await viewersCollection.find({
      $or: [
        { timestamp: /^1\/1\/1970/ },
        { timestamp: { $regex: '^1/1/1970' } },
        { viewedTime: { $exists: false } },
        { viewedTime: null }
      ]
    }).toArray();
    
    console.log(`📊 Found ${invalidRecords.length} records with invalid timestamps`);
    
    let updatedCount = 0;
    for (const record of invalidRecords) {
      const updates = {};
      
      // Fix timestamp to use scraped_at or current time as standardized format
      if (record.scraped_at) {
        updates.timestamp = record.scraped_at;
      } else if (record.created_at) {
        // Convert created_at to standardized format
        const date = new Date(record.created_at);
        updates.timestamp = date.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } else {
        // Use current time in standardized format
        const now = new Date();
        updates.timestamp = now.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
      
      // Set viewedTime field - for now, mark as 'Unknown' since we don't have the original "X ago" data
      if (!record.viewedTime) {
        updates.viewedTime = 'Unknown';
      }
      
      // Update the record
      await viewersCollection.updateOne(
        { _id: record._id },
        { $set: updates }
      );
      
      updatedCount++;
    }
    
    console.log(`✅ Updated ${updatedCount} records with fixed timestamps and viewedTime`);
    
    // Now let's check the corrected data
    console.log('\n📊 Sample of corrected data:');
    const sampleRecords = await viewersCollection.find({}).limit(3).toArray();
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.name}`);
      console.log(`   timestamp: ${record.timestamp}`);
      console.log(`   viewedTime: ${record.viewedTime}`);
      console.log(`   scraped_at: ${record.scraped_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the fix
fixViewedTimeData();
