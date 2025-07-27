const fs = require('fs');
const path = require('path');
const mongoDB = require('./mongodb');

async function migrateScreenshotsToMongoDB() {
  console.log('🔄 Starting screenshot migration to MongoDB...');
  
  try {
    // Connect to MongoDB
    await mongoDB.connect();
    console.log('✅ Connected to MongoDB');
    
    // Find all screenshots in public/screenshots directory
    const screenshotsDir = path.join(__dirname, 'public', 'screenshots');
    
    if (!fs.existsSync(screenshotsDir)) {
      console.log('❌ Screenshots directory not found');
      return;
    }
    
    const screenshotFiles = fs.readdirSync(screenshotsDir)
      .filter(file => file.endsWith('.png') && file.startsWith('profile-views-'));
    
    console.log(`📁 Found ${screenshotFiles.length} screenshots to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const filename of screenshotFiles) {
      try {
        // Check if screenshot already exists in database
        const existing = await mongoDB.getScreenshotData(filename);
        if (existing) {
          console.log(`⏭️  Skipping ${filename} (already exists)`);
          skipped++;
          continue;
        }
        
        // Read screenshot file
        const filePath = path.join(screenshotsDir, filename);
        const imageBuffer = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);
        
        // Extract timestamp from filename (profile-views-YYYY-MM-DD_HH-MM-SS_AM/PM.png)
        const timestampMatch = filename.match(/profile-views-(.+)\.png$/);
        let parsedTimestamp = 'Unknown';
        
        if (timestampMatch) {
          try {
            const timestampStr = timestampMatch[1].replace(/_/g, ' ');
            const date = new Date(timestampStr);
            if (!isNaN(date.getTime())) {
              parsedTimestamp = date.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              });
            }
          } catch (parseError) {
            console.log(`⚠️  Could not parse timestamp for ${filename}, using file creation time`);
            parsedTimestamp = stats.birthtime.toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: 'numeric',
              month: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            });
          }
        }
        
        // Save to MongoDB
        await mongoDB.saveScreenshotWithData(filename, imageBuffer, {
          totalViewers: 0, // Unknown for migrated files
          triggerType: 'migrated',
          istTimestamp: parsedTimestamp,
          migrated: true,
          originalPath: filePath,
          fileCreated: stats.birthtime,
          fileModified: stats.mtime
        });
        
        console.log(`✅ Migrated ${filename}`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating ${filename}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Migrated: ${migrated} files`);
    console.log(`   ⏭️  Skipped: ${skipped} files`);
    console.log(`   📁 Total: ${screenshotFiles.length} files`);
    
    await mongoDB.client.close();
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateScreenshotsToMongoDB();
}

module.exports = migrateScreenshotsToMongoDB;
