// Test script to debug appendInvalidScenariosToReport function
const fs = require('fs-extra');
const path = require('path');

// Simulate the appendInvalidScenariosToReport function (simplified version)
async function appendInvalidScenariosToReport(projectId, config, invalidScenarios, backstopResult) {
  try {
    console.log(`📋 Generating mock results for ${invalidScenarios.length} invalid scenarios...`);
    
    const mockResults = [];
    
    // Create mock test results for each invalid scenario across all viewports
    for (const { scenario, reason, message, validation, matchedFilter } of invalidScenarios) {
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
          error: `Network Error [${reason}]: ${message}${matchedFilter !== undefined ? (matchedFilter ? ' (Matched Filter)' : ' (Outside Filter - Shown for Awareness)') : ''}`,
          networkError: true,
          errorType: reason,
          matchedFilter: matchedFilter,
          originalValidation: validation || null,
          timestamp: new Date().toISOString()
        };
        
        mockResults.push(mockResult);
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
    
    console.log(`✅ Enhanced report created`);
    console.log(`📊 Final report contains: ${enhancedResult.totalScenarios} total scenarios (${enhancedResult.validScenariosCount} tested + ${enhancedResult.invalidScenariosCount} network errors)`);
    
    // Log details of what was added
    console.log(`📝 Mock results added:`);
    mockResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.pair.label} (${result.pair.viewportLabel}): ${result.status} - ${result.error}`);
    });
    
    return enhancedResult;
    
  } catch (error) {
    console.error('Error appending invalid scenarios to report:', error);
    throw error;
  }
}

async function testEnhancement() {
    console.log('🧪 Testing appendInvalidScenariosToReport function...');
    
    // Simulate existing BackstopJS result (what's currently in config.js)
    const existingBackstopResult = {
      testSuite: "BackstopJS",
      tests: [
        {
          pair: { label: "asset-share-commons", viewportLabel: "Tablet_Landscape" },
          status: "pass"
        },
        {
          pair: { label: "details", viewportLabel: "Tablet_Landscape" },
          status: "pass"
        },
        {
          pair: { label: "google", viewportLabel: "Tablet_Landscape" },
          status: "pass"
        },
        {
          pair: { label: "faq", viewportLabel: "Tablet_Landscape" },
          status: "pass"
        }
      ],
      id: "backstop_c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b"
    };
    
    // Simulate invalid scenarios (network-test should be here)
    const invalidScenarios = [
        {
            scenario: {
                label: 'network-test',
                url: 'http://localhost:5175/scenarios',
                selector: 'document'
            },
            reason: 'ECONNREFUSED',
            message: 'Connection refused - server not responding',
            validation: {
                valid: false,
                type: 'ECONNREFUSED',
                message: 'Connection refused - server not responding',
                severity: 'high'
            },
            matchedFilter: true  // This should match the filter
        }
    ];
    
    // Simulate config
    const config = {
        viewports: [
            {
                label: "Tablet_Landscape",
                width: 1024,
                height: 768
            }
        ],
        paths: {
            html_report: path.join(__dirname, 'test_output')
        }
    };
    
    const projectId = 'c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b';
    
    console.log('\n📊 Input data:');
    console.log(`   Existing tests: ${existingBackstopResult.tests.length}`);
    console.log(`   Invalid scenarios: ${invalidScenarios.length}`);
    console.log(`   Invalid scenario labels: ${invalidScenarios.map(s => s.scenario.label).join(', ')}`);
    
    // Test the enhancement function
    const enhancedResult = await appendInvalidScenariosToReport(
        projectId, 
        config, 
        invalidScenarios, 
        existingBackstopResult
    );
    
    console.log('\n🎯 Enhanced result:');
    console.log(`   Total tests: ${enhancedResult.tests.length}`);
    console.log(`   Network errors: ${enhancedResult.tests.filter(t => t.networkError).length}`);
    console.log(`   Has network errors: ${enhancedResult.hasNetworkErrors}`);
    console.log(`   Network error count: ${enhancedResult.networkErrorCount}`);
    
    // Check if network-test appears
    const networkTestResults = enhancedResult.tests.filter(t => 
        t.pair && t.pair.label === 'network-test'
    );
    
    console.log(`\n🔍 "network-test" in enhanced result: ${networkTestResults.length} found`);
    if (networkTestResults.length > 0) {
        networkTestResults.forEach(result => {
            console.log(`   ✅ Found: ${result.pair.label} (${result.pair.viewportLabel}) - Status: ${result.status}`);
            console.log(`   📄 Error: ${result.error}`);
            console.log(`   🏷️  Network Error: ${result.networkError}`);
            console.log(`   🎯 Matched Filter: ${result.matchedFilter}`);
        });
    } else {
        console.log(`   ❌ "network-test" NOT found in enhanced result!`);
    }
    
    console.log('\n✅ Test completed!');
}

testEnhancement().catch(console.error);
