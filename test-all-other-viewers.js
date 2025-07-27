#!/usr/bin/env node

// Test file to verify "All other viewers" type classification

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

console.log('🧪 Testing "All other viewers" classification logic...\n');

const testCases = [
  // Should be PREMIUM (All other viewers patterns)
  'Founder in the Legal Services industry from Greater Delhi Area',
  'CEO in the Technology industry from Mumbai Area',
  'Manager in the Financial Services industry from Bangalore Region',
  'Director in the Healthcare industry from Pune Area',
  'Engineer in the Software industry from Chennai Region',
  'Analyst in the Consulting industry from Hyderabad Area',
  'Consultant in Financial Services from Delhi',
  'Specialist in Technology industry from Mumbai',
  'Student at XYZ University from Greater Mumbai Area',
  'Professional in the Marketing industry from Kolkata Region',
  'Executive at ABC Corp from Greater Noida Area',
  
  // Should be PREMIUM (existing patterns)
  'Someone at Google',
  'LinkedIn Member',
  '20 work at Microsoft',
  '5 found you through search',
  '1 has a connection who works at Apple',
  'AB',
  
  // Should be FREE (actual names)
  'John Doe',
  'Priya Sharma',
  'Rajesh Kumar View Profile',
  'Sarah Johnson View Sarah Johnson\'s profile',
  'Michael Chen Student at IIT Delhi',
  'Anita Gupta Software Engineer'
];

let passedTests = 0;
let totalTests = 0;

testCases.forEach((testCase, index) => {
  totalTests++;
  const result = determineViewerType(testCase);
  const expected = index < 11 ? 'premium' : (index < 17 ? 'premium' : 'free');
  const status = result === expected ? '✅' : '❌';
  
  if (result === expected) passedTests++;
  
  console.log(`${status} "${testCase}" → ${result} (expected: ${expected})`);
});

console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed! The logic correctly identifies "All other viewers" entries.');
} else {
  console.log('⚠️  Some tests failed. Review the logic for edge cases.');
}
