#!/usr/bin/env node

/**
 * Migration Script: Migrate existing JSON data to MongoDB Atlas
 * 
 * This script migrates:
 * - viewers.json → MongoDB viewers collection
 * - Any other legacy data files → MongoDB collections
 */

require('dotenv').config(); // Load environment variables
const fs = require('fs');
const path = require('path');
const mongoDB = require('./mongodb');

async function migrateData() {
  console.log('🚀 Starting data migration to MongoDB Atlas...\n');

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoDB.connect();
    console.log('✅ Connected successfully!\n');

    let totalMigrated = 0;

    // Migrate viewers.json
    const viewersFile = path.join(__dirname, 'viewers.json');
    if (fs.existsSync(viewersFile)) {
      console.log('📄 Found viewers.json, migrating...');
      
      const viewersData = JSON.parse(fs.readFileSync(viewersFile));
      
      // Handle different data formats
      let viewersToMigrate = [];
      
      if (viewersData.allViewers && Array.isArray(viewersData.allViewers)) {
        viewersToMigrate = viewersData.allViewers;
      } else if (viewersData.freeViewers && Array.isArray(viewersData.freeViewers)) {
        viewersToMigrate = viewersData.freeViewers;
      } else if (Array.isArray(viewersData)) {
        viewersToMigrate = viewersData;
      }

      console.log(`   Found ${viewersToMigrate.length} viewers to migrate`);

      let migratedViewers = 0;
      for (const viewer of viewersToMigrate) {
        try {
          // Clean up viewer data
          const cleanViewer = {
            name: viewer.name || 'Unknown',
            headline: viewer.headline || '',
            company: viewer.company || '',
            timestamp: viewer.timestamp || new Date().toISOString(),
            // Add migration metadata
            migrated_from: 'viewers.json',
            migrated_at: new Date().toISOString()
          };

          await mongoDB.addViewer(cleanViewer);
          migratedViewers++;
          
          if (migratedViewers % 50 === 0) {
            console.log(`   ⏳ Migrated ${migratedViewers}/${viewersToMigrate.length} viewers...`);
          }
        } catch (error) {
          console.log(`   ⚠️  Skipped viewer "${viewer.name}": ${error.message}`);
        }
      }

      console.log(`   ✅ Migrated ${migratedViewers} viewers to MongoDB`);
      totalMigrated += migratedViewers;

      // Backup original file
      const backupFile = `viewers.json.backup-${Date.now()}`;
      fs.copyFileSync(viewersFile, backupFile);
      console.log(`   💾 Backed up original to: ${backupFile}`);
    }

    // Check for other data files
    const dataFiles = ['daily-totals.json', 'screenshots.json'];
    for (const file of dataFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`\n📄 Found ${file}, would need custom migration logic`);
        // TODO: Add specific migration logic for other data types
      }
    }

    // Show final stats
    console.log('\n📊 Migration Summary:');
    console.log(`   Total records migrated: ${totalMigrated}`);
    
    // Verify migration
    const stats = await mongoDB.getStats();
    console.log(`   MongoDB total viewers: ${stats.totalViewers}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 You can now start the server to use MongoDB Atlas storage.');

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
  migrateData().catch(console.error);
}

module.exports = { migrateData };
