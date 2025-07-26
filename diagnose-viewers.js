const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

console.log('🔍 Diagnosing viewer count discrepancy...\n');

// Initialize Firebase Admin
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    
    const db = admin.firestore();
    
    async function diagnoseViewerCount() {
        try {
            // Check viewers collection
            console.log('📊 Checking viewers collection...');
            const viewersSnapshot = await db.collection('viewers').get();
            console.log(`Total documents in 'viewers' collection: ${viewersSnapshot.size}`);
            
            // Check for duplicate names/entries
            const nameCount = new Map();
            const uniqueNames = new Set();
            let freeViewers = 0;
            let premiumViewers = 0;
            
            viewersSnapshot.forEach(doc => {
                const data = doc.data();
                let displayName = data.name || 'Anonymous';
                
                // Clean up name
                if (displayName.includes('View ') && displayName.includes("'s profile")) {
                    displayName = displayName.replace(/View\s+(.+)'s profile/, '$1').trim();
                }
                
                // Count occurrences
                nameCount.set(displayName, (nameCount.get(displayName) || 0) + 1);
                uniqueNames.add(displayName);
                
                // Categorize viewer type
                const isFreeViewer = data.name && 
                    !data.name.includes('Someone at') && 
                    !data.name.includes('LinkedIn Member') &&
                    !data.name.includes('work at') &&
                    !data.name.includes('found you through') &&
                    !data.name.includes('has a connection') &&
                    data.name.length > 10;
                
                if (isFreeViewer) {
                    freeViewers++;
                } else {
                    premiumViewers++;
                }
            });
            
            console.log(`\n📈 Analysis Results:`);
            console.log(`- Total documents: ${viewersSnapshot.size}`);
            console.log(`- Unique names: ${uniqueNames.size}`);
            console.log(`- Free viewers: ${freeViewers}`);
            console.log(`- Premium/Anonymous viewers: ${premiumViewers}`);
            
            // Show duplicates
            console.log(`\n🔄 Duplicate Analysis:`);
            const duplicates = Array.from(nameCount.entries()).filter(([name, count]) => count > 1);
            if (duplicates.length > 0) {
                console.log(`Found ${duplicates.length} names with duplicates:`);
                duplicates.slice(0, 10).forEach(([name, count]) => {
                    console.log(`  - "${name}": ${count} occurrences`);
                });
                if (duplicates.length > 10) {
                    console.log(`  ... and ${duplicates.length - 10} more`);
                }
            } else {
                console.log('No duplicate names found');
            }
            
            // Check if there are other collections that might contain viewer data
            console.log(`\n🔍 Checking for other potential viewer collections...`);
            const collections = await db.listCollections();
            console.log('Available collections:');
            collections.forEach(collection => {
                console.log(`  - ${collection.id}`);
            });
            
            // Sample a few documents to see the data structure
            console.log(`\n📄 Sample viewer documents:`);
            const sampleDocs = viewersSnapshot.docs.slice(0, 3);
            sampleDocs.forEach((doc, index) => {
                const data = doc.data();
                console.log(`Sample ${index + 1}:`);
                console.log(`  ID: ${doc.id}`);
                console.log(`  Name: ${data.name || 'N/A'}`);
                console.log(`  Company: ${data.company || 'N/A'}`);
                console.log(`  Timestamp: ${data.timestamp || 'N/A'}`);
                console.log(`  Has scraped_at: ${!!data.scraped_at}`);
                console.log('');
            });
            
        } catch (error) {
            console.error('❌ Error during diagnosis:', error);
        }
    }
    
    diagnoseViewerCount().then(() => {
        console.log('\n🎉 Diagnosis complete!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Diagnosis failed:', error);
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
}
