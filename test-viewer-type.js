const testName = 'Founder in the Legal Services industry from Greater Delhi Area';
const lowerName = testName.toLowerCase();

console.log('Original:', testName);
console.log('Lowercase:', lowerName);
console.log('Test 1 - in the + industry:', lowerName.includes(' in the ') && lowerName.includes(' industry'));
console.log('Test 2 - from + area:', lowerName.includes(' from ') && lowerName.includes(' area'));
console.log('Test 3 - founder regex:', lowerName.match(/^(founder|ceo|cto|manager|director|engineer|developer|analyst|consultant|specialist)\s+in/i));

function determineViewerType(name) {
  if (!name || typeof name !== 'string') {
    return 'premium';
  }
  
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('someone at') || 
      lowerName.includes('linkedin member') ||
      lowerName.includes('work at') ||
      lowerName.includes('found you through') ||
      lowerName.includes('has a connection') ||
      name.length < 3) {
    return 'premium';
  }
  
  // "All other viewers" patterns
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
  
  return 'free';
}

console.log('Final result:', determineViewerType(testName));
