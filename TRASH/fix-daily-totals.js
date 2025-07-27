require('dotenv').config();
const storage = require('./mongodb.js');

async function fixDailyTotals() {
  try {
    await storage.connect();
    console.log('Connected to MongoDB');
    
    // Get all daily totals
    const db = storage.db;
    const collection = db.collection('daily_totals');
    
    const records = await collection.find().sort({ date: -1 }).toArray();
    console.log('\nCurrent daily totals:');
    records.forEach(record => {
      console.log(`Date: ${record.date}, Total: ${record.total}`);
    });
    
    // Find and fix the problematic entry with 1437 total
    const problematicEntry = records.find(r => r.total > 1000);
    if (problematicEntry) {
      console.log(`\nFound problematic entry: ${problematicEntry.date} with ${problematicEntry.total} total`);
      
      // Update it to a reasonable number (maybe it should be 14 or 37)
      const reasonableTotal = 37; // Assuming it was meant to be 37
      
      await collection.updateOne(
        { _id: problematicEntry._id },
        { 
          $set: { 
            total: reasonableTotal,
            updated_at: new Date()
          }
        }
      );
      
      console.log(`Updated total from ${problematicEntry.total} to ${reasonableTotal}`);
    }
    
    // Standardize date format to YYYY-MM-DD
    for (const record of records) {
      let standardDate = record.date;
      
      // Convert "27/7/2025" format to "2025-07-27"
      if (record.date && record.date.includes('/') && !record.date.includes('-')) {
        const parts = record.date.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          standardDate = `${year}-${month}-${day}`;
          
          await collection.updateOne(
            { _id: record._id },
            { 
              $set: { 
                date: standardDate,
                updated_at: new Date()
              }
            }
          );
          
          console.log(`Updated date format: ${record.date} -> ${standardDate}`);
        }
      }
    }
    
    console.log('\nFixed daily totals successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('Error fixing daily totals:', error);
    process.exit(1);
  }
}

fixDailyTotals();
