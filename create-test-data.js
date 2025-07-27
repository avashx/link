const mongoDB = require('./mongodb');

async function createSimulatedHourlyData() {
  try {
    await mongoDB.connect();
    console.log('Connected to MongoDB');
    
    // Create data for the past few hours with simulated growth
    const now = new Date();
    const baseViewers = 80; // Starting point
    
    for (let i = 5; i >= 1; i--) {
      const hourTimestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const simulatedViewers = baseViewers + (Math.random() * 10 + (5 - i) * 3);
      
      // Manually create the document
      const collection = mongoDB.getCollection('hourly_stats');
      const hourKey = hourTimestamp.toISOString().slice(0, 13) + ':00:00.000Z';
      
      const document = {
        hour: hourKey,
        timestamp: hourTimestamp,
        totalViewers: Math.floor(simulatedViewers),
        viewerIncrease: Math.floor(Math.random() * 5 + 1),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await collection.replaceOne(
        { hour: hourKey },
        document,
        { upsert: true }
      );
      
      console.log(`Created hourly stats for: ${hourKey} - Viewers: ${document.totalViewers}`);
    }
    
    console.log('Simulated hourly data created successfully');
    await mongoDB.disconnect();
    
  } catch (error) {
    console.error('Error creating simulated data:', error);
  }
}

createSimulatedHourlyData();
