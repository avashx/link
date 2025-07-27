require('dotenv').config();
const storage = require('./mongodb.js');

async function fixNullTypes() {
  try {
    await storage.connect();
    console.log('Connected to MongoDB');
    
    const db = storage.db;
    const collection = db.collection('viewers');
    
    // Find records with null or missing type
    const recordsToFix = await collection.find({
      $or: [
        { type: null },
        { type: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`Found ${recordsToFix.length} records to fix`);
    
    for (const record of recordsToFix) {
      const viewerType = determineViewerType(record.name);
      
      await collection.updateOne(
        { _id: record._id },
        { 
          $set: { 
            type: viewerType,
            updated_at: new Date()
          }
        }
      );
      
      console.log(`Fixed: ${record.name} -> ${viewerType}`);
    }
    
    console.log(`✅ Fixed ${recordsToFix.length} records`);
    
    // Show final counts
    const freeCount = await collection.countDocuments({ type: 'free' });
    const premiumCount = await collection.countDocuments({ type: 'premium' });
    console.log(`Final counts: Free: ${freeCount}, Premium: ${premiumCount}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function determineViewerType(name) {
  if (!name || typeof name !== 'string') {
    return 'premium';
  }
  
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('someone at') || 
      lowerName.includes('linkedin member') ||
      lowerName.includes('work at') ||
      lowerName.includes('found you through') ||
      lowerName.includes('has a connection') ||
      name.length < 3) {
    return 'premium';
  }
  
  return 'free';
}

fixNullTypes();
