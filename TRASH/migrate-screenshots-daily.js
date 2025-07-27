#!/usr/bin/env node

/**
 * Enhanced Migration Script: Migrate screenshots and generate daily totals
 * 
 * This script migrates:
 * - Screenshot files → MongoDB screenshots collection
 * - Generate daily totals from existing viewer data
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoDB = require('./mongodb');

async function migrateScreenshotsAndDailyTotals() {
  console.log('🚀 Starting screenshots & daily totals migration...\n');

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoDB.connect();
    console.log('✅ Connected successfully!\n');

    let totalMigrated = 0;

    // 1. Migrate Screenshots
    console.log('📸 Looking for screenshot files...');
    const screenshotFiles = fs.readdirSync('.')
      .filter(file => file.startsWith('profile-views-') && file.endsWith('.png'))
      .sort();

    console.log(`   Found ${screenshotFiles.length} screenshot files`);

    if (screenshotFiles.length > 0) {
      let migratedScreenshots = 0;
      
      for (const filename of screenshotFiles) {
        try {
          const filePath = path.join(__dirname, filename);
          const stats = fs.statSync(filePath);
          
          // Extract date from filename (profile-views-2025-07-26_3-51-29_am.png)
          const dateMatch = filename.match(/profile-views-(\d{4}-\d{2}-\d{2})_(\d+)-(\d+)-(\d+)_(\w+)\.png/);
          let timestamp = new Date().toISOString();
          
          if (dateMatch) {
            const [, date, hour, minute, second, ampm] = dateMatch;
            let hour24 = parseInt(hour);
            if (ampm === 'pm' && hour24 !== 12) hour24 += 12;
            if (ampm === 'am' && hour24 === 12) hour24 = 0;
            
            timestamp = new Date(`${date}T${hour24.toString().padStart(2, '0')}:${minute}:${second}`).toISOString();
          }

          const screenshotData = {
            filename: filename,
            localPath: filename, // Relative path from public directory
            size: stats.size,
            timestamp: timestamp,
            istTimestamp: new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            totalViewers: null, // Will be extracted from OCR if available
            migrated_from: 'file_system',
            migrated_at: new Date().toISOString()
          };

          await mongoDB.saveScreenshot(screenshotData);
          migratedScreenshots++;
          
          if (migratedScreenshots % 5 === 0) {
            console.log(`   ⏳ Migrated ${migratedScreenshots}/${screenshotFiles.length} screenshots...`);
          }
        } catch (error) {
          console.log(`   ⚠️  Skipped screenshot "${filename}": ${error.message}`);
        }
      }

      console.log(`   ✅ Migrated ${migratedScreenshots} screenshots to MongoDB`);
      totalMigrated += migratedScreenshots;
    }

    // 2. Generate Daily Totals from existing viewer data
    console.log('\n📊 Generating daily totals from viewer data...');
    
    const viewers = await mongoDB.getViewers(1000); // Get all viewers
    console.log(`   Found ${viewers.length} viewers to analyze`);

    if (viewers.length > 0) {
      // Group viewers by date
      const dailyGroups = {};
      
      viewers.forEach(viewer => {
        const date = new Date(viewer.timestamp || viewer.created_at);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!dailyGroups[dateStr]) {
          dailyGroups[dateStr] = {
            date: dateStr,
            viewers: [],
            total: 0
          };
        }
        
        dailyGroups[dateStr].viewers.push(viewer);
        dailyGroups[dateStr].total++;
      });

      console.log(`   Found data for ${Object.keys(dailyGroups).length} unique days`);

      let savedDailyTotals = 0;
      for (const [dateStr, dayData] of Object.entries(dailyGroups)) {
        try {
          await mongoDB.saveDailyTotal(dateStr, dayData.total);
          savedDailyTotals++;
          
          if (savedDailyTotals % 5 === 0) {
            console.log(`   ⏳ Saved ${savedDailyTotals}/${Object.keys(dailyGroups).length} daily totals...`);
          }
        } catch (error) {
          console.log(`   ⚠️  Skipped daily total for ${dateStr}: ${error.message}`);
        }
      }

      console.log(`   ✅ Generated ${savedDailyTotals} daily total records`);
      totalMigrated += savedDailyTotals;
    }

    // 3. Verify migration
    console.log('\n📊 Migration Summary:');
    console.log(`   Total records migrated: ${totalMigrated}`);
    
    const stats = await mongoDB.getStats();
    console.log(`   MongoDB viewers: ${stats.totalViewers}`);
    console.log(`   MongoDB daily records: ${stats.totalDailyRecords}`);
    console.log(`   MongoDB screenshots: ${stats.totalScreenshots}`);
    
    console.log('\n🎉 Enhanced migration completed successfully!');
    console.log('💡 Refresh your web application to see the migrated data.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('💡 Please check your MongoDB Atlas connection and try again.');
    process.exit(1);
  } finally {
    await mongoDB.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateScreenshotsAndDailyTotals().catch(console.error);
}

module.exports = { migrateScreenshotsAndDailyTotals };
