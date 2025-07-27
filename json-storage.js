const fs = require('fs');
const path = require('path');

/**
 * Simple JSON file-based storage as fallback when MongoDB is not available
 * This allows development to continue while MongoDB Atlas is being configured
 */
class JSONStorage {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.isConnected = true; // Always available
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('📁 Created data directory for JSON storage');
    }
  }

  getFilePath(collection) {
    return path.join(this.dataDir, `${collection}.json`);
  }

  loadCollection(collection) {
    const filePath = this.getFilePath(collection);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`⚠️ Error reading ${collection}.json:`, error.message);
      return [];
    }
  }

  saveCollection(collection, data) {
    const filePath = this.getFilePath(collection);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`❌ Error saving ${collection}.json:`, error.message);
      throw error;
    }
  }

  // Simulate MongoDB methods for compatibility
  async connect() {
    console.log('📁 Using JSON file storage (MongoDB fallback)');
    console.log('💡 Data will be stored in ./data/ directory');
    this.isConnected = true;
    return this;
  }

  async disconnect() {
    this.isConnected = false;
    console.log('📁 JSON storage disconnected');
  }

  getDb() {
    return this;
  }

  getCollection(name) {
    return {
      insertOne: async (doc) => {
        const data = this.loadCollection(name);
        const newDoc = { ...doc, _id: this.generateId(), created_at: new Date() };
        data.push(newDoc);
        this.saveCollection(name, data);
        return { insertedId: newDoc._id };
      },

      insertMany: async (docs) => {
        const data = this.loadCollection(name);
        const newDocs = docs.map(doc => ({ 
          ...doc, 
          _id: this.generateId(), 
          created_at: new Date() 
        }));
        data.push(...newDocs);
        this.saveCollection(name, data);
        return { insertedIds: newDocs.map(d => d._id) };
      },

      find: (query = {}) => ({
        sort: (sortOptions) => ({
          limit: (limitCount) => ({
            toArray: async () => {
              let data = this.loadCollection(name);
              
              // Simple query filtering (basic implementation)
              if (Object.keys(query).length > 0) {
                data = data.filter(doc => {
                  return Object.entries(query).every(([key, value]) => {
                    if (typeof value === 'object' && value.$exists !== undefined) {
                      const exists = doc[key] !== undefined && doc[key] !== null;
                      return value.$exists ? exists : !exists;
                    }
                    if (typeof value === 'object' && value.$ne !== undefined) {
                      return doc[key] !== value.$ne;
                    }
                    if (typeof value === 'object' && value.$not !== undefined) {
                      if (value.$not instanceof RegExp) {
                        return !value.$not.test(doc[key] || '');
                      }
                    }
                    if (typeof value === 'object' && value.$gte !== undefined) {
                      return new Date(doc[key]) >= value.$gte;
                    }
                    return doc[key] === value;
                  });
                });
              }
              
              // Simple sorting
              if (sortOptions) {
                data.sort((a, b) => {
                  for (const [field, direction] of Object.entries(sortOptions)) {
                    let aVal = a[field];
                    let bVal = b[field];
                    
                    // Handle date strings
                    if (field.includes('_at') || field === 'timestamp') {
                      aVal = new Date(aVal);
                      bVal = new Date(bVal);
                    }
                    
                    if (direction === -1) {
                      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
                    } else {
                      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                    }
                  }
                  return 0;
                });
              }
              
              // Apply limit
              if (limitCount) {
                data = data.slice(0, limitCount);
              }
              
              return data;
            }
          }),
          toArray: async () => {
            let data = this.loadCollection(name);
            if (Object.keys(query).length > 0) {
              // Apply basic query filtering
              data = data.filter(doc => {
                return Object.entries(query).every(([key, value]) => doc[key] === value);
              });
            }
            if (sortOptions) {
              data.sort((a, b) => {
                for (const [field, direction] of Object.entries(sortOptions)) {
                  if (direction === -1) {
                    return new Date(b[field]) - new Date(a[field]);
                  } else {
                    return new Date(a[field]) - new Date(b[field]);
                  }
                }
                return 0;
              });
            }
            return data;
          }
        }),
        limit: (limitCount) => ({
          toArray: async () => {
            let data = this.loadCollection(name);
            if (Object.keys(query).length > 0) {
              data = data.filter(doc => {
                return Object.entries(query).every(([key, value]) => doc[key] === value);
              });
            }
            return data.slice(0, limitCount);
          }
        }),
        toArray: async () => {
          let data = this.loadCollection(name);
          if (Object.keys(query).length > 0) {
            data = data.filter(doc => {
              return Object.entries(query).every(([key, value]) => doc[key] === value);
            });
          }
          return data;
        }
      }),

      countDocuments: async (query = {}) => {
        let data = this.loadCollection(name);
        if (Object.keys(query).length > 0) {
          data = data.filter(doc => {
            return Object.entries(query).every(([key, value]) => {
              if (typeof value === 'object' && value.$and) {
                return value.$and.every(condition => {
                  return Object.entries(condition).every(([k, v]) => {
                    if (typeof v === 'object' && v.$exists !== undefined) {
                      const exists = doc[k] !== undefined && doc[k] !== null;
                      return v.$exists ? exists : !exists;
                    }
                    if (typeof v === 'object' && v.$ne !== undefined) {
                      return doc[k] !== v.$ne;
                    }
                    if (typeof v === 'object' && v.$not !== undefined) {
                      if (v.$not instanceof RegExp) {
                        return !v.$not.test(doc[k] || '');
                      }
                    }
                    if (typeof v === 'object' && v.$expr !== undefined) {
                      // Simple implementation for $expr with $gt and $strLenCP
                      if (v.$expr.$gt && Array.isArray(v.$expr.$gt)) {
                        const [strLenExpr, minLength] = v.$expr.$gt;
                        if (strLenExpr.$strLenCP) {
                          const fieldName = strLenExpr.$strLenCP.replace('$', '');
                          return (doc[fieldName] || '').length > minLength;
                        }
                      }
                    }
                    if (typeof v === 'object' && v.$gte !== undefined) {
                      return new Date(doc[k]) >= v.$gte;
                    }
                    return doc[k] === v;
                  });
                });
              }
              return doc[key] === value;
            });
          });
        }
        return data.length;
      },

      replaceOne: async (filter, replacement, options = {}) => {
        const data = this.loadCollection(name);
        const index = data.findIndex(doc => {
          return Object.entries(filter).every(([key, value]) => doc[key] === value);
        });
        
        if (index >= 0) {
          data[index] = { ...replacement, _id: data[index]._id };
          this.saveCollection(name, data);
          return { modifiedCount: 1 };
        } else if (options.upsert) {
          const newDoc = { ...replacement, _id: this.generateId() };
          data.push(newDoc);
          this.saveCollection(name, data);
          return { upsertedId: newDoc._id };
        }
        return { modifiedCount: 0 };
      }
    };
  }

  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
  }

  // MongoDB compatibility methods
  async addViewer(viewerData) {
    // Alias for saveViewer to match the interface expected by scraper
    return await this.saveViewer(viewerData);
  }

  async saveViewer(viewerData) {
    const collection = this.getCollection('viewers');
    return await collection.insertOne(viewerData);
  }

  async saveViewers(viewersArray) {
    const collection = this.getCollection('viewers');
    return await collection.insertMany(viewersArray);
  }

  async getViewers(limit = 50) {
    const collection = this.getCollection('viewers');
    return await collection.find({}).sort({ scraped_at: -1 }).limit(limit).toArray();
  }

  async getFreeViewers(limit = 50) {
    const collection = this.getCollection('viewers');
    return await collection.find({
      $and: [
        { name: { $exists: true } },
        { name: { $ne: "" } },
        { name: { $not: /Someone at/i } },
        { name: { $not: /LinkedIn Member/i } },
        { $expr: { $gt: [{ $strLenCP: "$name" }, 10] } }
      ]
    }).sort({ scraped_at: -1 }).limit(limit).toArray();
  }

  async saveDailyTotal(date, total) {
    const collection = this.getCollection('daily_totals');
    return await collection.replaceOne(
      { date: date },
      { date: date, total: total, created_at: new Date(), updated_at: new Date() },
      { upsert: true }
    );
  }

  async getDailyTotals(limit = 30) {
    const collection = this.getCollection('daily_totals');
    return await collection.find({}).sort({ date: -1 }).limit(limit).toArray();
  }

  async saveScreenshot(screenshotData) {
    const collection = this.getCollection('screenshots');
    return await collection.insertOne(screenshotData);
  }

  async getScreenshots(limit = 20) {
    const collection = this.getCollection('screenshots');
    return await collection.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
  }

  async getStats() {
    const viewersCollection = this.getCollection('viewers');
    const dailyTotalsCollection = this.getCollection('daily_totals');
    const screenshotsCollection = this.getCollection('screenshots');

    const [
      totalViewers,
      totalDailyRecords,
      totalScreenshots,
      freeViewersCount
    ] = await Promise.all([
      viewersCollection.countDocuments(),
      dailyTotalsCollection.countDocuments(),
      screenshotsCollection.countDocuments(),
      viewersCollection.countDocuments({
        $and: [
          { name: { $exists: true } },
          { name: { $ne: "" } },
          { name: { $not: /Someone at/i } },
          { name: { $not: /LinkedIn Member/i } },
          { $expr: { $gt: [{ $strLenCP: "$name" }, 10] } }
        ]
      })
    ]);

    return {
      totalViewers,
      totalDailyRecords,
      totalScreenshots,
      freeViewersCount,
      premiumViewersCount: totalViewers - freeViewersCount
    };
  }

  async getViewersFromPastHours(hours = 24) {
    const viewers = this.loadCollection('viewers');
    const hoursAgo = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return viewers.filter(v => new Date(v.scraped_at) >= hoursAgo).length;
  }

  // Hourly statistics methods
  async saveHourlyStats(hourTimestamp) {
    const hourlyStats = this.loadCollection('hourly_stats');
    const viewers = this.loadCollection('viewers');
    
    // Count total viewers at this point in time
    const totalViewers = viewers.length;
    
    // Get the hour as a string (YYYY-MM-DD HH:00)
    const hourKey = new Date(hourTimestamp).toISOString().slice(0, 13) + ':00:00.000Z';
    
    // Get the previous hour's count for calculating increase
    const previousHour = new Date(hourTimestamp.getTime() - 60 * 60 * 1000);
    const previousHourKey = previousHour.toISOString().slice(0, 13) + ':00:00.000Z';
    
    const previousStats = hourlyStats.find(s => s.hour === previousHourKey);
    const previousTotal = previousStats ? previousStats.totalViewers : 0;
    const viewerIncrease = Math.max(0, totalViewers - previousTotal);
    
    const document = {
      hour: hourKey,
      timestamp: new Date(hourTimestamp).toISOString(),
      totalViewers: totalViewers,
      viewerIncrease: viewerIncrease,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Remove existing entry for this hour and add new one
    const filteredStats = hourlyStats.filter(s => s.hour !== hourKey);
    filteredStats.push(document);
    
    this.saveCollection('hourly_stats', filteredStats);
    
    console.log(`📊 Hourly stats saved: ${hourKey} - Total: ${totalViewers}, Increase: ${viewerIncrease}`);
    return { acknowledged: true };
  }

  async getHourlyStats(limit = 168) { // Default to 7 days (168 hours)
    const hourlyStats = this.loadCollection('hourly_stats');
    return hourlyStats
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit);
  }

  async getHourlyStatsInRange(startDate, endDate) {
    const hourlyStats = this.loadCollection('hourly_stats');
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return hourlyStats
      .filter(s => {
        const timestamp = new Date(s.timestamp);
        return timestamp >= start && timestamp <= end;
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
  
  // Scraping logs methods
  async saveScrapingLog(triggerType, status, details = {}) {
    const scrapingLogs = this.loadCollection('scraping_logs');
    const now = new Date();
    const newDelhiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    
    const document = {
      timestamp: newDelhiTime.toISOString(),
      triggerType: triggerType, // 'manual' or 'automatic'
      status: status, // 'started', 'completed', 'failed'
      details: details,
      istTimestamp: now.toLocaleString("en-IN", { 
        timeZone: "Asia/Kolkata",
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      created_at: newDelhiTime.toISOString()
    };
    
    scrapingLogs.push(document);
    this.saveCollection('scraping_logs', scrapingLogs);
    
    console.log(`📋 Scraping log saved: ${triggerType} - ${status}`);
    return { acknowledged: true };
  }
  
  async getScrapingLogs(limit = 50) {
    const scrapingLogs = this.loadCollection('scraping_logs');
    return scrapingLogs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
  
  async getLastScrapingLog() {
    const scrapingLogs = this.loadCollection('scraping_logs');
    const completedLogs = scrapingLogs.filter(log => log.status === 'completed');
    if (completedLogs.length === 0) return null;
    
    return completedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  }
  
  async getNextScheduledScrapeTime() {
    // This will be updated based on current cron schedule
    // For now, return next hour
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    nextHour.setMilliseconds(0);
    
    return nextHour.toISOString();
  }
}

module.exports = JSONStorage;
