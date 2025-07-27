const db = require('./firebase-admin.js');

async function testFirebaseConnection() {
  console.log('🔥 Testing Firebase Admin SDK connection...');
  
  try {
    // Test viewers collection
    console.log('\n📊 Testing viewers collection...');
    const viewersSnapshot = await db.collection('viewers').limit(5).get();
    console.log(`Found ${viewersSnapshot.size} viewer records`);
    
    if (!viewersSnapshot.empty) {
      viewersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: ${data.name?.substring(0, 50)}...`);
      });
    }
    
    // Test daily_totals collection
    console.log('\n📅 Testing daily_totals collection...');
    const dailySnapshot = await db.collection('daily_totals').limit(5).get();
    console.log(`Found ${dailySnapshot.size} daily total records`);
    
    if (!dailySnapshot.empty) {
      dailySnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: Date=${data.date}, Total=${data.total}`);
      });
    }
    
    // Test screenshots collection
    console.log('\n📸 Testing screenshots collection...');
    const screenshotsSnapshot = await db.collection('screenshots').limit(5).get();
    console.log(`Found ${screenshotsSnapshot.size} screenshot records`);
    
    if (!screenshotsSnapshot.empty) {
      screenshotsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: ${data.filename}`);
      });
    }
    
    console.log('\n✅ Firebase connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Firebase connection error:', error.message);
    console.error('Full error:', error);
  }
}

testFirebaseConnection();
