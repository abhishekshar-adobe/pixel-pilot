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
