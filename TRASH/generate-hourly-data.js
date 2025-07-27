const mongoDB = require('./mongodb');

async function generateInitialHourlyData() {
  try {
    await mongoDB.connect();
    console.log('Connected to MongoDB');
    
    // Generate hourly data for the past 24 hours
    const now = new Date();
    const hourlyData = [];
    
    for (let i = 23; i >= 0; i--) {
      const hourTimestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
      await mongoDB.saveHourlyStats(hourTimestamp);
      console.log(`Generated hourly stats for: ${hourTimestamp.toISOString()}`);
    }
    
    console.log('Initial hourly data generated successfully');
    await mongoDB.disconnect();
    
  } catch (error) {
    console.error('Error generating hourly data:', error);
  }
}

generateInitialHourlyData();
