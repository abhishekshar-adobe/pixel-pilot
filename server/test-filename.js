const fs = require('fs-extra');
const path = require('path');

async function testSync() {
  try {
    console.log('Testing manual sync...');
    
    // Check if uploads exist
    const uploadsDir = './uploads';
    const uploads = await fs.readdir(uploadsDir);
    console.log('Upload files found:', uploads.length);
    uploads.forEach(file => console.log('- ' + file));
    
    // Check scenario screenshots
    const scenarioDataPath = './backstop_data/scenario_screenshots.json';
    const scenarioData = await fs.readJson(scenarioDataPath);
    console.log('\nScenario data keys:', Object.keys(scenarioData));
    
    // Check config
    const configPath = './backstop_data/backstop.json';
    const config = await fs.readJson(configPath);
    console.log('\nBackstop scenarios:', config.scenarios.map(s => s.label));
    console.log('Viewports:', config.viewports.map(v => v.label));
    
    // Test manual sync for Footer scenario
    const referenceDir = './backstop_data/bitmaps_reference';
    await fs.ensureDir(referenceDir);
    console.log('\nReference directory ensured');
    
    // Try to find a recent Footer upload
    const footerDesktop = scenarioData['Footer_desktop'];
    if (footerDesktop && footerDesktop.referenceScreenshot) {
      const refScreenshot = footerDesktop.referenceScreenshot;
      console.log('\nFound Footer desktop reference:', refScreenshot.filename);
      
      // Generate expected filename
      const scenario = 'Footer';
      const viewport = 'desktop';
      const viewportIndex = config.viewports.findIndex(v => v.label === viewport);
      const scenarioConfig = config.scenarios.find(s => s.label === scenario);
      
      // Sanitize scenario name to match BackstopJS naming convention
      const sanitizedScenario = scenario.replace(/\s+/g, '_');
      
      if (scenarioConfig && scenarioConfig.selectors) {
        const selectorName = scenarioConfig.selectors[0]
          .replace(/#/g, '') // Remove hash symbols
          .replace(/\./g, '') // Remove dots  
          .replace(/\s*>\s*/g, '') // Remove child selectors and spaces
          .replace(/\s+/g, '') // Remove remaining spaces
          .toLowerCase(); // BackstopJS uses lowercase
        const backstopFilename = `backstop_default_${sanitizedScenario}_0_${selectorName}_${viewportIndex}_${viewport}.png`;
        
        console.log('Expected backstop filename:', backstopFilename);
        
        // Try manual copy
        const sourcePath = refScreenshot.path;
        const targetPath = path.join(referenceDir, backstopFilename);
        
        console.log('Source exists:', await fs.pathExists(sourcePath));
        console.log('Source path:', sourcePath);
        console.log('Target path:', targetPath);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, targetPath);
          console.log('✅ Manual sync successful!');
        } else {
          console.log('❌ Source file not found');
        }
      }
    } else {
      console.log('❌ No Footer desktop reference found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSync();
