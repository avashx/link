const { MongoClient } = require('mongodb');
require('dotenv').config();

async function addSampleViewedTimeData() {
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
    
    // Sample viewed time data
    const sampleViewedTimes = [
      '2 hours ago',
      '5 hours ago', 
      '1 day ago',
      '3 hours ago',
      '8 hours ago',
      '12 hours ago',
      '1 hour ago',
      '6 hours ago',
      '4 hours ago',
      '10 hours ago'
    ];
    
    console.log('🔍 Finding free viewer records to update...');
    
    // Get the first 10 free viewers
    const freeViewers = await viewersCollection.find({ type: 'free' }).limit(10).toArray();
    
    console.log(`📊 Found ${freeViewers.length} free viewer records`);
    
    let updatedCount = 0;
    for (let i = 0; i < freeViewers.length && i < sampleViewedTimes.length; i++) {
      const record = freeViewers[i];
      const viewedTime = sampleViewedTimes[i];
      
      await viewersCollection.updateOne(
        { _id: record._id },
        { $set: { viewedTime: viewedTime } }
      );
      
      console.log(`✅ Updated ${record.name.substring(0, 50)}... with viewedTime: ${viewedTime}`);
      updatedCount++;
    }
    
    console.log(`\n🎉 Updated ${updatedCount} records with sample viewed time data`);
    
    // Show sample of updated data
    console.log('\n📊 Sample of updated data:');
    const sampleRecords = await viewersCollection.find({ 
      type: 'free', 
      viewedTime: { $ne: 'Unknown' } 
    }).limit(3).toArray();
    
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.name.substring(0, 50)}...`);
      console.log(`   viewedTime: ${record.viewedTime}`);
      console.log(`   timestamp: ${record.timestamp}`);
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

// Run the script
addSampleViewedTimeData();
