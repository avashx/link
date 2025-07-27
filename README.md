# LinkedIn Profile Views Tracker

This is a LinkedIn profile viewer tracker I built that shows who visited your profile, with charts, screenshots, and live tracking. I moved it from Firebase to MongoDB because Firebase had annoying limits and MongoDB is faster and gives more control.

To run it, you need Node.js, a LinkedIn account with cookies, and MongoDB (local or cloud). After setting up the database and environment file, you just start the server and open the dashboard in your browser.

The tool scrapes viewer data, stores it in MongoDB, and shows it on a clean dashboard. It has buttons to start/stop tracking and refresh data. It also takes screenshots and keeps daily view stats.

I added several API endpoints to get all the data, and the system works better now with no Firebase limits. Everything runs locally or on the cloud, and it's easy to manage and update.

## Setup

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Copy environment template and configure:
   ```bash
   cp .env.example .env
   ```

3. Add your LinkedIn cookies to `.env` or `linkedin_cookies.json`

4. Start the server:
   ```bash
   node server.js
   ```

5. Open `http://localhost:3000` in your browser

## Essential Files

- `server.js` - Main server and API
- `scraper.js` - LinkedIn scraper  
- `mongodb.js` - Database operations
- `json-storage.js` - Backup storage
- `public/` - Web dashboard
- `.env` - Configuration
