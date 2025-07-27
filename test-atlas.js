#!/usr/bin/env node

/**
 * MongoDB Atlas Connection Test
 * This script tests the connection to MongoDB Atlas and helps debug issues
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testAtlasConnection() {
  console.log('🧪 MongoDB Atlas Connection Test');
  console.log('================================\n');

  const connectionString = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'linkrtgod';

  if (!connectionString) {
    console.error('❌ MONGODB_URI not found in .env file');
    console.log('💡 Make sure you have MONGODB_URI set in your .env file');
    return;
  }

  console.log('📋 Configuration:');
  console.log(`   Database: ${dbName}`);
  console.log(`   Connection: ${connectionString.replace(/\/\/.*@/, '//***:***@')}\n`);

  let client;
  try {
    console.log('🔄 Step 1: Creating MongoDB client...');
    client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log('🔄 Step 2: Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connection established successfully!');

    console.log('🔄 Step 3: Testing database access...');
    const db = client.db(dbName);
    await db.admin().ping();
    console.log('✅ Database ping successful!');

    console.log('🔄 Step 4: Testing basic operations...');
    const testCollection = db.collection('connection_test');
    
    // Insert test document
    const insertResult = await testCollection.insertOne({
      test: true,
      timestamp: new Date(),
      message: 'MongoDB Atlas connection test'
    });
    console.log('✅ Test document inserted:', insertResult.insertedId);

    // Read test document
    const testDoc = await testCollection.findOne({ _id: insertResult.insertedId });
    console.log('✅ Test document retrieved:', testDoc.message);

    // Clean up test document
    await testCollection.deleteOne({ _id: insertResult.insertedId });
    console.log('✅ Test document cleaned up');

    console.log('\n🎉 All tests passed! MongoDB Atlas is working correctly.');
    console.log('🚀 You can now start the server with: node server.js');

  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    
    // Provide specific troubleshooting based on error type
    if (error.message.includes('bad auth') || error.message.includes('authentication failed')) {
      console.log('\n🔑 Authentication Issue:');
      console.log('   - Check your username and password in MongoDB Atlas');
      console.log('   - Ensure the database user exists and has correct permissions');
      console.log('   - Verify the password doesn\'t contain special characters that need encoding');
      console.log('   - Make sure the user has "readWrite" role for the database');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
      console.log('\n🌐 Network Issue:');
      console.log('   - Check your internet connection');
      console.log('   - Verify your IP address is whitelisted in MongoDB Atlas Network Access');
      console.log('   - Try adding 0.0.0.0/0 (allow all) temporarily for testing');
      console.log('   - Check if you\'re behind a corporate firewall');
    } else if (error.message.includes('MongoServerSelectionError')) {
      console.log('\n🔧 Server Selection Issue:');
      console.log('   - Verify the cluster is running (not paused)');
      console.log('   - Check the connection string format');
      console.log('   - Ensure the cluster name is correct');
    }
    
    console.log('\n📚 Additional Resources:');
    console.log('   - MongoDB Atlas Docs: https://docs.atlas.mongodb.com/');
    console.log('   - Connection Troubleshooting: https://docs.atlas.mongodb.com/troubleshoot-connection/');
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Connection closed.');
    }
  }
}

// Run the test
testAtlasConnection().catch(console.error);
