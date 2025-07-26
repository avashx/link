const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

console.log('🔥 Verifying Server-side Firebase Configuration...\n');

// Initialize Firebase Admin
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    
    const db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log(`📊 Project ID: ${serviceAccount.project_id}`);
    console.log(`📧 Service Account: ${serviceAccount.client_email}\n`);
    
    // Test each collection
    const collections = ['viewers', 'daily_totals', 'screenshots'];
    
    async function testCollections() {
        for (const collectionName of collections) {
            try {
                console.log(`🔍 Testing ${collectionName} collection...`);
                const snapshot = await db.collection(collectionName).limit(1).get();
                
                if (snapshot.empty) {
                    console.log(`⚠️  ${collectionName}: Collection is empty`);
                } else {
                    console.log(`✅ ${collectionName}: Found ${snapshot.size} document(s)`);
                    // Show first document structure
                    const firstDoc = snapshot.docs[0];
                    console.log(`   Sample ID: ${firstDoc.id}`);
                    console.log(`   Sample fields: ${Object.keys(firstDoc.data()).join(', ')}`);
                }
            } catch (error) {
                console.log(`❌ ${collectionName}: Error - ${error.message}`);
            }
            console.log('');
        }
        
        // Get total counts
        console.log('📈 Getting total document counts...');
        for (const collectionName of collections) {
            try {
                const snapshot = await db.collection(collectionName).get();
                console.log(`   ${collectionName}: ${snapshot.size} documents`);
            } catch (error) {
                console.log(`   ${collectionName}: Error getting count - ${error.message}`);
            }
        }
    }
    
    testCollections().then(() => {
        console.log('\n🎉 Server-side Firebase verification complete!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
}
