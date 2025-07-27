#!/usr/bin/env node

/**
 * Generate Historical Daily Totals
 * Creates sample daily totals for the past week to populate the analytics
 */

require('dotenv').config();
const mongoDB = require('./mongodb');

async function generateHistoricalDailyTotals() {
  console.log('📊 Generating historical daily totals...\n');

  try {
    await mongoDB.connect();
    console.log('✅ Connected to MongoDB\n');

    // Generate daily totals for the past 7 days
    const today = new Date();
    const historicalData = [];

    for (let i = 7; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      // Generate realistic viewer counts (10-50 range with some variation)
      const baseCount = 15;
      const variation = Math.floor(Math.random() * 35) + 10; // 10-45
      const dailyTotal = baseCount + variation;

      historicalData.push({
        date: dateStr,
        total: dailyTotal
      });
    }

    console.log('📅 Generated historical data:');
    historicalData.forEach(day => {
      console.log(`   ${day.date}: ${day.total} viewers`);
    });

    // Save to MongoDB
    console.log('\n💾 Saving to MongoDB...');
    let saved = 0;
    for (const dayData of historicalData) {
      try {
        await mongoDB.saveDailyTotal(dayData.date, dayData.total);
        saved++;
      } catch (error) {
        console.log(`   ⚠️  Day ${dayData.date} might already exist: ${error.message}`);
      }
    }

    console.log(`\n✅ Saved ${saved} new daily total records`);
    
    // Verify the data
    const stats = await mongoDB.getStats();
    console.log(`📊 Total daily records in database: ${stats.totalDailyRecords}`);

    console.log('\n🎉 Historical daily totals generated successfully!');
    console.log('💡 Refresh your web application to see the updated charts.');

  } catch (error) {
    console.error('❌ Failed to generate historical data:', error.message);
  } finally {
    await mongoDB.disconnect();
  }
}

generateHistoricalDailyTotals();
