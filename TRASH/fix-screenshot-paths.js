#!/usr/bin/env node

/**
 * Fix Screenshot Paths: Update MongoDB screenshot records to use correct public paths
 */

require('dotenv').config();
const mongoDB = require('./mongodb');

async function fixScreenshotPaths() {
  console.log('🔧 Fixing screenshot paths in MongoDB...\n');

  try {
    await mongoDB.connect();
    console.log('✅ Connected to MongoDB\n');

    // Get all screenshots
    const screenshots = await mongoDB.getScreenshots(50);
    console.log(`📸 Found ${screenshots.length} screenshots to update`);

    let updated = 0;
    for (const screenshot of screenshots) {
      try {
        // Update the localPath to point to public/screenshots/
        const newPath = `screenshots/${screenshot.filename}`;
        
        // Update the record in MongoDB
        const collection = mongoDB.getCollection('screenshots');
        await collection.updateOne(
          { _id: screenshot._id },
          { 
            $set: { 
              localPath: newPath,
              updated_at: new Date()
            } 
          }
        );
        
        updated++;
        console.log(`   ✅ Updated: ${screenshot.filename} → ${newPath}`);
        
      } catch (error) {
        console.log(`   ❌ Failed to update ${screenshot.filename}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Updated ${updated} screenshot paths successfully!`);
    console.log('💡 Screenshots are now accessible via web interface.');

  } catch (error) {
    console.error('❌ Failed to fix screenshot paths:', error.message);
  } finally {
    await mongoDB.disconnect();
  }
}

fixScreenshotPaths();
