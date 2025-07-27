const { scrapeProfileViews } = require('./scraper');
const mongoDB = require('./mongodb');
require('dotenv').config();

// Simple test log function
function testLog(type, message) {
  console.log(`${new Date().toLocaleTimeString()} [${type}] ${message}`);
}

async function testScraper() {
  try {
    console.log('🧪 Testing scraper with MongoDB...');
    
    // Connect to MongoDB
    await mongoDB.connect();
    console.log('✅ MongoDB connected');
    
    // Test the scraper
    const result = await scrapeProfileViews(mongoDB, testLog);
    console.log('✅ Scraper test completed:', result);
    
  } catch (error) {
    console.error('❌ Scraper test failed:', error.message);
  } finally {
    await mongoDB.disconnect();
  }
}

testScraper();
