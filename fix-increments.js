require('dotenv').config();
const storage = require('./mongodb.js');

async function fixDailyTotalsToIncrements() {
  try {
    await storage.connect();
    console.log('Connected to MongoDB');
    
    // Get all daily totals
    const db = storage.db;
    const collection = db.collection('daily_totals');
    
    const records = await collection.find().sort({ date: 1 }).toArray();
    console.log(`\nFound ${records.length} daily total records`);
    
    // Convert absolute values to daily increments
    let previousTotal = 0;
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const currentTotal = record.total;
      
      // Calculate increment based on previous day
      let increment = currentTotal;
      if (i > 0 && previousTotal > 0) {
        increment = currentTotal - previousTotal;
      }
      
      console.log(`Date: ${record.date}, Previous: ${previousTotal}, Current: ${currentTotal}, Increment: ${increment}`);
      
      // Update the record
      await collection.updateOne(
        { _id: record._id },
        { 
          $set: { 
            total: increment, // Store increment as total
            absoluteTotal: currentTotal, // Store absolute value for future calculations
            updated_at: new Date()
          }
        }
      );
      
      previousTotal = currentTotal;
    }
    
    console.log('\n✅ Successfully converted daily totals to increments');
    process.exit(0);
    
  } catch (error) {
    console.error('Error fixing daily totals:', error);
    process.exit(1);
  }
}

fixDailyTotalsToIncrements();
