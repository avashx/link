# LinkrtGOD - LinkedIn Analytics (MongoDB Version)

A comprehensive LinkedIn profile viewer tracker with automated scraping, analytics dashboard, and MongoDB storage.

## 🔄 Migration from Firebase to MongoDB

This version has been migrated from Firebase to MongoDB to eliminate quota limitations and provide better performance.

### ✨ Benefits of MongoDB Migration:

- **No quota limits** - Unlike Firebase's strict read/write quotas
- **Better performance** - Local or cloud MongoDB instances
- **More control** - Full control over your database
- **Cost effective** - Free for local development, flexible pricing for cloud

## 🚀 Quick Setup

### Prerequisites

- Node.js (v16 or higher)
- LinkedIn account with valid session cookies
- MongoDB (local installation or MongoDB Atlas)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd link
npm install
```

### 2. Setup MongoDB

#### Option A: Local MongoDB with Homebrew (macOS)

```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify MongoDB is running
brew services list | grep mongodb
```

#### Option B: MongoDB with Docker

```bash
# Run the setup script
./setup-mongodb.sh

# Or manually with Docker
docker run -d --name mongodb-linkrt -p 27017:27017 -v mongodb-data:/data/db mongo:latest
```

#### Option C: MongoDB Atlas (Cloud)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. **Important Setup Steps:**
   - Add your IP address to Network Access (or allow 0.0.0.0/0 for all IPs)
   - Create a database user with read/write permissions
   - Get the connection string from "Connect" → "Connect your application"
4. Update `.env` file with Atlas connection string

**MongoDB Atlas Connection String Format:**

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

**Troubleshooting MongoDB Atlas:**

- Ensure your IP is whitelisted in Network Access
- Verify database user credentials
- Check if the cluster is active (not paused)
- Make sure the database name matches your configuration

### 3. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file with your settings
nano .env
```

#### Required Environment Variables:

```env
# LinkedIn Authentication
LI_AT=your_li_at_cookie_value
JSESSIONID=your_jsessionid_cookie_value

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=linkrtgod

# Optional
PORT=3000
```

### 4. Start the Server

```bash
node server.js
```

### 5. Access the Dashboard

Open your browser and navigate to: `http://localhost:3000`

## 📊 Features

### Analytics Dashboard

- **Real-time data** - No quota limitations with MongoDB
- **Comprehensive tables** - Viewers, daily totals, screenshots
- **Live system logs** - Real-time monitoring
- **Modern UI** - Notion-inspired clean design

### Data Collection

- **Profile viewers** - Free and premium viewer tracking
- **Daily statistics** - Historical view counts
- **Screenshots** - Visual records of profile views
- **Automated scraping** - Scheduled data collection

### System Controls

- **Start/Stop tracking** - Manual control over scraping
- **Data refresh** - Manual data synchronization
- **Scraping intervals** - Configurable timing
- **Random intervals** - Stealth mode for scraping

## 🔧 MongoDB Database Structure

### Collections:

- `viewers` - Individual profile viewer records
- `daily_totals` - Daily aggregated view counts
- `screenshots` - Screenshot metadata and paths

### Indexes (Auto-created):

- `viewers.timestamp` - For chronological queries
- `viewers.scraped_at` - For time-based filtering
- `daily_totals.date` - For date-based queries
- `screenshots.timestamp` - For screenshot chronology

## 🎯 API Endpoints

### MongoDB Data APIs:

- `GET /api/mongodb/viewers` - Get viewer records
- `GET /api/mongodb/free-viewers` - Get free viewers only
- `GET /api/mongodb/daily-totals` - Get daily statistics
- `GET /api/mongodb/screenshots` - Get screenshot records
- `GET /api/mongodb/stats` - Get analytics overview
- `GET /api/mongodb/past-hours?hours=24` - Get recent viewers
- `GET /api/mongodb/status` - Check MongoDB connection

### Control APIs:

- `POST /api/scrape` - Start scraping
- `POST /api/stop` - Stop scraping
- `GET /api/logs` - Get system logs
- `GET /api/health` - Server health check

## 🚨 Troubleshooting

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
brew services list | grep mongodb

# Start MongoDB if not running
brew services start mongodb-community

# Check MongoDB logs
brew services list mongodb-community
```

### Common Errors:

#### "MongoDB connection failed"

- Ensure MongoDB is installed and running
- Check MONGODB_URI in .env file
- Verify network connectivity for Atlas

#### "Database features may not work"

- Server runs but MongoDB is offline
- Check MongoDB service status
- Verify connection string format

### Docker MongoDB Issues:

```bash
# Check Docker containers
docker ps -a | grep mongodb

# Start stopped container
docker start mongodb-linkrt

# View container logs
docker logs mongodb-linkrt
```

## 🔄 Migration from Firebase

If you're migrating from a Firebase version:

1. **No data migration needed** - Start fresh with MongoDB
2. **Remove Firebase credentials** - No longer needed
3. **Update environment** - Add MongoDB configuration
4. **Existing screenshots** - Will continue to work from local storage

## 📈 Performance Improvements

### Compared to Firebase:

- **No read quotas** - Unlimited queries
- **Faster responses** - Direct database connection
- **Batch operations** - Efficient bulk inserts
- **Local development** - No internet dependency
- **Cost control** - Predictable hosting costs

## 🔒 Security

### MongoDB Security:

- Use authentication in production
- Enable SSL/TLS for connections
- Restrict network access
- Regular backups

### Example production connection:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/linkrtgod?retryWrites=true&w=majority
```

## 🛠️ Development

### Project Structure:

```
├── server.js          # Express server with MongoDB APIs
├── scraper.js         # LinkedIn scraper (MongoDB integrated)
├── mongodb.js         # MongoDB connection and utilities
├── public/
│   ├── index.html     # Analytics dashboard (MongoDB version)
│   └── screenshots/   # Local screenshot storage
├── setup-mongodb.sh   # MongoDB setup script
└── .env.example      # Environment template
```

### Adding New Features:

1. Add MongoDB collection method to `mongodb.js`
2. Create API endpoint in `server.js`
3. Update frontend in `public/index.html`

## 📄 License

MIT License - Use freely for personal and commercial projects.

## 🤝 Support

- Create GitHub issues for bugs
- Check MongoDB documentation for database issues
- Review server logs for debugging

---

**Note**: This version eliminates Firebase quota limitations and provides a more robust, scalable solution for LinkedIn analytics tracking.
