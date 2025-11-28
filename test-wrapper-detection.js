// Test the wrapper detection logic
const customScript = `module.exports = async (page) => { console.log('🟢 START: Custom ready script execution'); await page.evaluate(() => { console.log('🔵 INSIDE page.evaluate - about to walk DOM'); function walk(node) { if (node.nodeType === Node.TEXT_NODE) { node.textContent = "X"; } node = node.firstChild; while (node) { walk(node); node = node.nextSibling; } } walk(document.body); console.log('🟢 COMPLETED: DOM walk finished'); }); console.log('🟢 END: Custom ready script execution'); };`;

console.log('📝 Original customScript:');
console.log(customScript);
console.log('\n' + '='.repeat(80) + '\n');

// Test the regex pattern
const moduleExportsPattern = /^module\.exports\s*=\s*async\s*\(.*?\)\s*=>\s*\{([\s\S]*)\};?\s*$/;
const match = customScript.trim().match(moduleExportsPattern);

if (match) {
  console.log('✅ MATCH FOUND! Wrapper will be stripped.');
  console.log('\n📦 Extracted inner code:');
  console.log(match[1].trim());
} else {
  console.log('❌ NO MATCH - wrapper will NOT be stripped');
  console.log('\nTrying to understand why...');
  
  // Debug the pattern
  console.log('\nPattern expects:');
  console.log('- Start with: module.exports =');
  console.log('- Followed by: async (params) => {');
  console.log('- Content in middle');
  console.log('- End with: };');
  
  console.log('\nActual string:');
  console.log('- Starts with:', customScript.substring(0, 30));
  console.log('- Ends with:', customScript.substring(customScript.length - 10));
}
