require('dotenv').config();
const storage = require('./mongodb.js');

async function testViewerSaving() {
  try {
    await storage.connect();
    console.log('Connected to MongoDB');
    
    // Test saving a free viewer
    const testFreeViewer = {
      name: "John Doe",
      headline: "Software Engineer",
      company: "Tech Corp",
      timestamp: new Date().toISOString()
    };
    
    console.log('Testing free viewer save...');
    const result1 = await storage.saveViewer(testFreeViewer);
    console.log('Result:', result1.acknowledged);
    
    // Test saving a premium viewer
    const testPremiumViewer = {
      name: "Someone at Google",
      headline: "",
      company: "",
      timestamp: new Date().toISOString()
    };
    
    console.log('Testing premium viewer save...');
    const result2 = await storage.saveViewer(testPremiumViewer);
    console.log('Result:', result2.acknowledged);
    
    // Test duplicate prevention
    console.log('Testing duplicate prevention...');
    const result3 = await storage.saveViewer(testFreeViewer);
    console.log('Duplicate result type:', result3.acknowledged !== undefined ? 'insert' : 'update');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error testing viewer saving:', error);
    process.exit(1);
  }
}

testViewerSaving();
