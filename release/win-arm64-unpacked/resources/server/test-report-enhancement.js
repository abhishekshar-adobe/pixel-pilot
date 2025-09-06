// Test script to verify report enhancement functionality
const fs = require('fs-extra');
const path = require('path');

// Mock project data for testing
const projectId = 'c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b';
const reportPath = path.join(__dirname, 'backstop_data', projectId, 'html_report', 'config.js');
const backupPath = path.join(__dirname, 'backstop_data', projectId, 'html_report', 'config_original_backup.js');

async function testReportEnhancement() {
  try {
    console.log('🧪 Testing Report Enhancement Functionality\n');
    
    // 1. Check if report exists
    console.log(`📁 Checking report path: ${reportPath}`);
    const reportExists = await fs.pathExists(reportPath);
    console.log(`📋 Report exists: ${reportExists}\n`);
    
    if (!reportExists) {
      console.error('❌ Report file not found! Run a BackstopJS test first.');
      return;
    }
    
    // 2. Read current report
    console.log('📖 Reading current report...');
    const reportContent = await fs.readFile(reportPath, 'utf8');
    console.log(`📊 Report content length: ${reportContent.length} characters`);
    
    // 3. Parse current report data
    const reportMatch = reportContent.match(/report\((.*)\);/s);
    if (!reportMatch) {
      console.error('❌ Could not parse report format!');
      return;
    }
    
    const currentReportData = JSON.parse(reportMatch[1]);
    console.log(`📋 Current report has ${currentReportData.tests?.length || 0} tests`);
    console.log(`📝 Test labels: ${currentReportData.tests?.map(t => t.pair?.label).join(', ')}`);
    
    // 4. Create backup
    console.log('\n💾 Creating backup of original report...');
    await fs.copy(reportPath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
    
    // 5. Mock invalid scenarios (simulating what should have been detected)
    const mockInvalidScenarios = [
      {
        scenario: {
          label: 'network-test',
          url: 'http://localhost:5175/scenarios',
          selector: 'document'
        },
        reason: 'CONNECTION_REFUSED',
        message: 'Connection refused - server not responding',
        validation: {
          valid: false,
          type: 'CONNECTION_REFUSED',
          message: 'Connection refused - server not responding',
          severity: 'high'
        }
      }
    ];
    
    console.log(`\n🧪 Testing with ${mockInvalidScenarios.length} mock invalid scenarios:`);
    mockInvalidScenarios.forEach(({ scenario, reason, message }) => {
      console.log(`   - ${scenario.label}: ${reason} - ${message}`);
    });
    
    // 6. Mock config (simulating BackstopJS config)
    const mockConfig = {
      paths: {
        html_report: path.join(__dirname, 'backstop_data', projectId, 'html_report')
      },
      viewports: [
        {
          label: 'Tablet_Landscape',
          width: 1024,
          height: 768
        }
      ]
    };
    
    // 7. Test the enhancement function
    console.log('\n🔧 Testing appendInvalidScenariosToReport function...');
    await testAppendInvalidScenarios(projectId, mockConfig, mockInvalidScenarios, currentReportData);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.stack);
  }
}

// Copy the enhancement function from the main server file for testing
async function testAppendInvalidScenarios(projectId, config, invalidScenarios, backstopResult) {
  try {
    console.log(`📋 Generating mock results for ${invalidScenarios.length} invalid scenarios...`);
    
    const mockResults = [];
    
    // Create mock test results for each invalid scenario across all viewports
    for (const { scenario, reason, message, validation } of invalidScenarios) {
      for (const viewport of config.viewports || []) {
        const mockResult = {
          pair: {
            reference: null,
            test: null,
            selector: scenario.selector || 'document',
            fileName: `${projectId}_${scenario.label}_${viewport.label}_network_error`,
            label: scenario.label,
            viewportLabel: viewport.label,
            url: scenario.url,
            referenceUrl: scenario.referenceUrl || scenario.url,
            expect: 0,
            viewportSize: {
              width: viewport.width,
              height: viewport.height
            },
            diff: {
              isSameDimensions: false,
              dimensionDifference: {
                width: 0,
                height: 0
              },
              misMatchPercentage: 100, // 100% mismatch for network errors
              analysisTime: 0,
              getDiffImage: null
            }
          },
          status: 'fail',
          error: `Network Error [${reason}]: ${message}`,
          networkError: true,
          errorType: reason,
          originalValidation: validation || null,
          timestamp: new Date().toISOString()
        };
        
        mockResults.push(mockResult);
        console.log(`   ✅ Created mock result for: ${scenario.label} (${viewport.label})`);
      }
    }
    
    // Merge mock results with actual BackstopJS results
    const enhancedResult = {
      ...backstopResult,
      tests: [
        ...(backstopResult.tests || []),
        ...mockResults
      ],
      hasNetworkErrors: true,
      networkErrorCount: invalidScenarios.length,
      totalScenarios: (backstopResult.tests?.length || 0) + mockResults.length,
      validScenariosCount: backstopResult.tests?.length || 0,
      invalidScenariosCount: invalidScenarios.length
    };
    
    console.log(`\n📊 Enhanced result summary:`);
    console.log(`   - Original tests: ${backstopResult.tests?.length || 0}`);
    console.log(`   - Mock results: ${mockResults.length}`);
    console.log(`   - Total tests: ${enhancedResult.tests?.length || 0}`);
    console.log(`   - Has network errors: ${enhancedResult.hasNetworkErrors}`);
    
    // Write enhanced report to BackstopJS report location
    const reportPath = path.join(config.paths.html_report, 'config.js');
    const testReportPath = path.join(config.paths.html_report, 'config_test_enhanced.js');
    
    const reportData = `report(${JSON.stringify(enhancedResult, null, 2)});`;
    
    await fs.writeFile(testReportPath, reportData, 'utf8');
    
    console.log(`\n✅ Test enhanced report written to: ${testReportPath}`);
    console.log(`📊 Final report contains: ${enhancedResult.totalScenarios} total scenarios (${enhancedResult.validScenariosCount} tested + ${enhancedResult.invalidScenariosCount} network errors)`);
    
    // Verify the file was written correctly
    const verifyContent = await fs.readFile(testReportPath, 'utf8');
    const verifyMatch = verifyContent.match(/report\((.*)\);/s);
    if (verifyMatch) {
      const verifyData = JSON.parse(verifyMatch[1]);
      console.log(`\n🔍 Verification: Enhanced file contains ${verifyData.tests?.length || 0} tests`);
      console.log(`📝 Enhanced test labels: ${verifyData.tests?.map(t => t.pair?.label).join(', ')}`);
      
      // Check for network error tests
      const networkErrorTests = verifyData.tests?.filter(t => t.networkError);
      console.log(`🚫 Network error tests: ${networkErrorTests?.length || 0}`);
      
      if (networkErrorTests?.length > 0) {
        console.log('✅ SUCCESS: Network error tests were successfully added to the report!');
      } else {
        console.log('❌ FAILURE: Network error tests are missing from the enhanced report!');
      }
    }
    
    return enhancedResult;
    
  } catch (error) {
    console.error('❌ Enhancement test failed:', error);
    throw error;
  }
}

// Run the test
testReportEnhancement();
