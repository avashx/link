require('dotenv').config();
const storage = require('./mongodb.js');

async function addViewerTypeToExistingRecords() {
  try {
    await storage.connect();
    console.log('Connected to MongoDB');
    
    const db = storage.db;
    const collection = db.collection('viewers');
    
    // Get all viewers without a type field
    const viewersWithoutType = await collection.find({ type: { $exists: false } }).toArray();
    console.log(`Found ${viewersWithoutType.length} viewers without type field`);
    
    let updatedCount = 0;
    
    for (const viewer of viewersWithoutType) {
      // Determine type using the same logic as the new method
      const viewerType = determineViewerType(viewer.name);
      
      // Update the record
      await collection.updateOne(
        { _id: viewer._id },
        { 
          $set: { 
            type: viewerType,
            updated_at: new Date()
          }
        }
      );
      
      updatedCount++;
      console.log(`${updatedCount}/${viewersWithoutType.length}: ${viewer.name} -> ${viewerType}`);
    }
    
    console.log(`\n✅ Successfully updated ${updatedCount} viewer records with type field`);
    
    // Show summary statistics
    const freeCount = await collection.countDocuments({ type: 'free' });
    const premiumCount = await collection.countDocuments({ type: 'premium' });
    console.log(`\n📊 Summary:`);
    console.log(`   Free viewers: ${freeCount}`);
    console.log(`   Premium viewers: ${premiumCount}`);
    console.log(`   Total: ${freeCount + premiumCount}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error updating viewer records:', error);
    process.exit(1);
  }
}

// Helper method to determine viewer type (same as in mongodb.js)
function determineViewerType(name) {
  if (!name || typeof name !== 'string') {
    return 'premium'; // Default for unknown
  }
  
  const lowerName = name.toLowerCase();
  
  // Premium/anonymous viewer patterns
  if (lowerName.includes('someone at') || 
      lowerName.includes('linkedin member') ||
      lowerName.includes('work at') ||
      lowerName.includes('found you through') ||
      lowerName.includes('has a connection') ||
      name.length < 3) {
    return 'premium';
  }
  
  // "All other viewers" patterns - professional descriptions without actual names
  // These are from the premium "All other viewers" section showing anonymous profile info
  if (lowerName.includes(' in the ') && lowerName.includes(' industry') ||
      lowerName.includes(' from ') && (lowerName.includes(' area') || lowerName.includes(' region')) ||
      lowerName.match(/^(founder|ceo|cto|manager|director|engineer|developer|analyst|consultant|specialist)\s+in/i) ||
      lowerName.match(/^(student|professional|executive)\s+(at|in)/i) ||
      lowerName.includes('industry from') ||
      lowerName.includes('services industry') ||
      lowerName.includes('technology industry') ||
      lowerName.includes('financial services') ||
      lowerName.includes('greater') && lowerName.includes('area')) {
    return 'premium';
  }
  
  // Free viewer (visible name)
  return 'free';
}

addViewerTypeToExistingRecords();
