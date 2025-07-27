#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixAllOtherViewersType() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('linkv');
    const collection = db.collection('viewers');
    
    console.log('🔍 Checking for misclassified "All other viewers" entries...');
    
    // Helper method to determine viewer type (updated logic)
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
    
    // Find all viewers
    const allViewers = await collection.find({}).toArray();
    console.log(`📊 Found ${allViewers.length} total viewers`);
    
    let correctedCount = 0;
    let potentialMatches = [];
    
    for (const viewer of allViewers) {
      const currentType = viewer.type || 'free';
      const correctType = determineViewerType(viewer.name);
      
      if (currentType !== correctType) {
        potentialMatches.push({
          _id: viewer._id,
          name: viewer.name,
          currentType,
          correctType,
          headline: viewer.headline || ''
        });
      }
    }
    
    console.log(`\n🎯 Found ${potentialMatches.length} viewers with potentially incorrect types:`);
    
    for (const match of potentialMatches) {
      console.log(`  - "${match.name}" (${match.currentType} → ${match.correctType})`);
      if (match.headline) {
        console.log(`    Headline: "${match.headline}"`);
      }
    }
    
    if (potentialMatches.length > 0) {
      console.log(`\n🔧 Updating ${potentialMatches.length} viewers...`);
      
      for (const match of potentialMatches) {
        await collection.updateOne(
          { _id: match._id },
          { $set: { type: match.correctType } }
        );
        correctedCount++;
      }
      
      console.log(`✅ Successfully corrected ${correctedCount} viewer types`);
    } else {
      console.log('✅ No corrections needed - all viewer types are correct');
    }
    
    // Final count verification
    const freeCount = await collection.countDocuments({ type: 'free' });
    const premiumCount = await collection.countDocuments({ type: 'premium' });
    
    console.log(`\n📈 Final counts:`);
    console.log(`   Free viewers: ${freeCount}`);
    console.log(`   Premium viewers: ${premiumCount}`);
    console.log(`   Total: ${freeCount + premiumCount}`);
    
  } catch (error) {
    console.error('❌ Error fixing viewer types:', error);
  } finally {
    await client.close();
  }
}

// Run the fix
fixAllOtherViewersType();
