const scraper = require('./scraper.js');

const log = (level, message) => console.log(`[${new Date().toLocaleTimeString()}] ${level}: ${message}`);

scraper(log).then(result => {
  console.log('Scraper completed:', result);
  process.exit(0);
}).catch(error => {
  console.error('Scraper error:', error);
  process.exit(1);
});
