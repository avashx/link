This is a LinkedIn profile viewer tracker I built that shows who visited your profile, with charts, screenshots, and live tracking. I moved it from Firebase to MongoDB because Firebase had annoying limits and MongoDB is faster and gives more control.

To run it, you need Node.js, a LinkedIn account with cookies, and MongoDB (local or cloud). After setting up the database and environment file, you just start the server and open the dashboard in your browser.

The tool scrapes viewer data, stores it in MongoDB, and shows it on a clean dashboard. It has buttons to start/stop tracking and refresh data. It also takes screenshots and keeps daily view stats.

I added several API endpoints to get all the data, and the system works better now with no Firebase limits. Everything runs locally or on the cloud, and it’s easy to manage and update.
