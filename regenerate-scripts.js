const fs = require('fs-extra');
const path = require('path');

const projectId = '3e933221-e424-45c6-92e3-d1424f324787';
const configPath = path.join(__dirname, 'server/backstop_data', projectId, 'backstop.json');

async function regenerate() {
  console.log('📖 Reading config...');
  const config = await fs.readJson(configPath);
  
  console.log('📝 Config loaded. Scenarios:', config.scenarios.length);
  
  // Import the generateCustomScripts function from server
  // We'll do this by making a simple HTTP call to trigger re-save
  console.log('\n⚠️  To regenerate scripts, you need to:');
  console.log('1. Open the UI and navigate to project:', projectId);
  console.log('2. Make any small change to a scenario (or just click Save)');
  console.log('3. The new code will automatically strip the module.exports wrapper\n');
  
  console.log('Or you can use curl to trigger it:');
  console.log(`curl -X POST http://localhost:5000/api/projects/${projectId}/scenarios \\
  -H "Content-Type: application/json" \\
  -d @server/backstop_data/${projectId}/backstop.json`);
}

regenerate().catch(console.error);
