// Test script to verify the new data display functionality
const testData = {
    "status": "done",
    "result": {
        "totalViewers": 1437,
        "freeViewers": [
            {
                "name": "Test User View Test User's profile",
                "headline": "Software Engineer | React Developer",
                "company": "Tech Corp",
                "timestamp": ""
            }
        ],
        "allViewers": [
            {
                "name": "Test User View Test User's profile",
                "headline": "Software Engineer | React Developer", 
                "company": "Tech Corp",
                "timestamp": ""
            },
            {
                "name": "Jane Smith View Jane Smith's profile",
                "headline": "Product Manager",
                "company": "Startup Inc",
                "timestamp": ""
            },
            {
                "name": "Someone at Google",
                "headline": "",
                "company": "",
                "timestamp": ""
            }
        ]
    }
};

console.log('Testing fresh data display...');
console.log('Sample data:', JSON.stringify(testData, null, 2));
