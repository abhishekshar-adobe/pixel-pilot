const fs = require('fs-extra');
const path = require('path');

async function getLatestTestResults() {
  try {
    const configDir = path.join(__dirname, '..', 'backstop_data');
    const testDir = path.join(configDir, 'bitmaps_test');
    
    // Get the latest test directory
    const testDirs = await fs.readdir(testDir);
    const latestDir = testDirs
      .filter(dir => !dir.startsWith('.'))
      .sort()
      .pop();
    
    if (!latestDir) {
      return null;
    }

    // Read the report.json file
    const reportPath = path.join(testDir, latestDir, 'report.json');
    if (await fs.pathExists(reportPath)) {
      const report = await fs.readJson(reportPath);
      return report;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading test results:', error);
    return null;
  }
}

module.exports = {
  getLatestTestResults
};
