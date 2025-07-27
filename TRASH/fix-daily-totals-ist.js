const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixDailyTotalsIstTimestamp() {
  let client;
  
  try {
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'linkrtgod';
    
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    const dailyTotalsCollection = db.collection('daily_totals');
    
    // Get all daily totals with Invalid Date
    const invalidRecords = await dailyTotalsCollection.find({
      istTimestamp: "Invalid Date"
    }).toArray();
    
    console.log(`Found ${invalidRecords.length} records with Invalid Date`);
    
    for (const record of invalidRecords) {
      let istTimestamp;
      
      // Try to create istTimestamp from created_at
      if (record.created_at) {
        const date = new Date(record.created_at);
        istTimestamp = date.toLocaleString('en-IN', {
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
        // Use current time
        istTimestamp = new Date().toLocaleString('en-IN', {
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
      
      await dailyTotalsCollection.updateOne(
        { _id: record._id },
        { $set: { istTimestamp: istTimestamp } }
      );
      
      console.log(`✅ Fixed record with date: ${record.date} -> istTimestamp: ${istTimestamp}`);
    }
    
    console.log('🎉 All Invalid Date issues fixed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

fixDailyTotalsIstTimestamp();
