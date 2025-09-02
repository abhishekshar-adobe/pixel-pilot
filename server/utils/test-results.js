const fs = require('fs-extra');
const path = require('path');

async function getLatestTestResults(projectId) {
  try {
    if (!projectId) throw new Error('projectId is required');
    const testDir = path.join(__dirname, '..', 'backstop_data', projectId, 'bitmaps_test');
    if (!await fs.pathExists(testDir)) {
      return { error: 'No test results found for this project. Please run a test.' };
    }
    // Get the latest test directory
    const testDirs = await fs.readdir(testDir);
    const latestDir = testDirs
      .filter(dir => !dir.startsWith('.'))
      .sort()
      .pop();
    if (!latestDir) {
      return { error: 'No test results found for this project. Please run a test.' };
    }
    // Read the report.json file
    const reportPath = path.join(testDir, latestDir, 'report.json');
    if (await fs.pathExists(reportPath)) {
      const report = await fs.readJson(reportPath);
      
      // Add the test execution date from directory name or file stats
      if (latestDir.match(/^\d{8}-\d{6}$/)) {
        // Parse directory name format: YYYYMMDD-HHMMSS
        const dateStr = latestDir;
        const year = dateStr.substr(0, 4);
        const month = dateStr.substr(4, 2);
        const day = dateStr.substr(6, 2);
        const hour = dateStr.substr(9, 2);
        const minute = dateStr.substr(11, 2);
        const second = dateStr.substr(13, 2);
        
        const testDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        
        // Enhance the report with date information
        report.testSuite = {
          name: report.testSuite,
          date: testDate.toISOString()
        };
      } else {
        // Fallback to file stats
        const stats = await fs.stat(reportPath);
        report.testSuite = {
          name: report.testSuite,
          date: stats.mtime.toISOString()
        };
      }
      
      return report;
    }
    return { error: 'No test results found for this project. Please run a test.' };
  } catch (error) {
    console.error('Error reading test results:', error);
    return null;
  }
}

module.exports = {
  getLatestTestResults
};
