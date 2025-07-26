const db = require('./firebase-admin.js');
const admin = require('firebase-admin');

// Check current project configuration
console.log('🔍 Checking Firebase Admin Configuration...\n');

try {
    const app = admin.app();
    const projectId = app.options.projectId;
    
    console.log('✅ Admin SDK Configuration:');
    console.log('   Project ID:', projectId);
    console.log('   Credential Type:', app.options.credential?.constructor?.name || 'Unknown');
    
    console.log('\n🔥 Testing Firestore Admin Access...');
    
    // List all collections
    db.listCollections()
        .then(collections => {
            console.log('\n📚 Available Collections:');
            collections.forEach(collection => {
                console.log('  -', collection.id);
            });
            
            // Count documents in each expected collection
            return Promise.all([
                db.collection('viewers').get(),
                db.collection('daily_totals').get(), 
                db.collection('screenshots').get()
            ]);
        })
        .then(([viewers, dailyTotals, screenshots]) => {
            console.log('\n📊 Document Counts:');
            console.log('   viewers:', viewers.size);
            console.log('   daily_totals:', dailyTotals.size);
            console.log('   screenshots:', screenshots.size);
            
            console.log('\n✅ Admin SDK is working correctly!');
            console.log('\n🚨 The issue is likely Firebase Security Rules blocking client access.');
            console.log('\n📋 Next Steps:');
            console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
            console.log('2. Select project: linkedin-tracker-8a84b');
            console.log('3. Go to Firestore Database → Rules');
            console.log('4. Update rules to allow read access');
            
            console.log('\n🔧 Required Security Rules:');
            console.log(`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /viewers/{document} {
      allow read, write: if true;
    }
    match /daily_totals/{document} {
      allow read, write: if true;
    }
    match /screenshots/{document} {
      allow read, write: if true;
    }
  }
}`);
        })
        .catch(error => {
            console.error('❌ Admin SDK Error:', error.message);
        });
        
} catch (error) {
    console.error('❌ Configuration Error:', error.message);
}
