const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

console.log('🔢 Calculating total viewers from daily_totals...\n');

// Initialize Firebase Admin
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    
    const db = admin.firestore();
    
    async function calculateTotalViewers() {
        try {
            console.log('📊 Fetching daily_totals collection...');
            const snapshot = await db.collection('daily_totals').get();
            console.log(`Found ${snapshot.size} daily records`);
            
            let totalViewers = 0;
            let recordCount = 0;
            
            console.log('\n📈 Daily totals breakdown:');
            snapshot.forEach(doc => {
                const data = doc.data();
                const dailyTotal = data.total || 0;
                totalViewers += dailyTotal;
                recordCount++;
                
                console.log(`  ${data.date || 'Unknown date'}: ${dailyTotal} viewers`);
            });
            
            console.log(`\n🎯 FINAL RESULT:`);
            console.log(`  Total Viewers: ${totalViewers.toLocaleString()}`);
            console.log(`  From ${recordCount} daily records`);
            console.log(`  Average per day: ${Math.round(totalViewers / recordCount)}`);
            
        } catch (error) {
            console.error('❌ Error calculating total:', error);
        }
    }
    
    calculateTotalViewers().then(() => {
        console.log('\n✅ Calculation complete!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Calculation failed:', error);
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
}
