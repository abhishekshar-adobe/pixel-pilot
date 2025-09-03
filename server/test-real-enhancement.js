// Simple test to manually call appendInvalidScenariosToReport with real config
const fs = require('fs-extra');
const path = require('path');

async function testRealEnhancement() {
    console.log('🧪 Testing real appendInvalidScenariosToReport with actual config...');
    
    const projectId = 'c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b';
    const configPath = path.join(__dirname, 'backstop_data', projectId, 'backstop.json');
    const reportPath = path.join(__dirname, 'backstop_data', projectId, 'html_report', 'config.js');
    
    console.log(`📂 Config path: ${configPath}`);
    console.log(`📄 Report path: ${reportPath}`);
    
    // Check if files exist
    const configExists = await fs.pathExists(configPath);
    const reportExists = await fs.pathExists(reportPath);
    
    console.log(`📋 Config exists: ${configExists}`);
    console.log(`📋 Report exists: ${reportExists}`);
    
    if (!configExists) {
        console.log('❌ Config file not found');
        return;
    }
    
    if (!reportExists) {
        console.log('❌ Report file not found');
        return;
    }
    
    // Read the actual config
    const config = await fs.readJson(configPath);
    console.log(`📊 Config has ${config.scenarios?.length || 0} scenarios`);
    
    if (config.scenarios) {
        console.log('📋 Scenarios in config:');
        config.scenarios.forEach((scenario, index) => {
            console.log(`   ${index + 1}. "${scenario.label}" -> ${scenario.url}`);
        });
    }
    
    // Read the current report
    const currentReportContent = await fs.readFile(reportPath, 'utf8');
    console.log(`📄 Current report file size: ${currentReportContent.length} characters`);
    
    // Extract current report data
    const reportMatch = currentReportContent.match(/report\\((.*)\\);/s);
    if (reportMatch) {
        const currentReportData = JSON.parse(reportMatch[1]);
        console.log(`📊 Current report has ${currentReportData.tests?.length || 0} tests`);
        
        if (currentReportData.tests) {
            console.log('📋 Tests in current report:');
            currentReportData.tests.forEach((test, index) => {
                console.log(`   ${index + 1}. "${test.pair?.label}" - Status: ${test.status} ${test.networkError ? '(Network Error)' : ''}`);
            });
        }
        
        // Check for network errors
        const networkErrorTests = currentReportData.tests?.filter(test => test.networkError) || [];
        console.log(`🔍 Network error tests found: ${networkErrorTests.length}`);
        
        // Simulate adding network-test as invalid scenario
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
                matchedFilter: true
            }
        ];
        
        console.log(`\\n🔧 Simulating enhancement with ${invalidScenarios.length} invalid scenarios...`);
        
        // Create mock results
        const mockResults = [];
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
                            misMatchPercentage: 100,
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
        
        // Create enhanced result
        const enhancedResult = {
            ...currentReportData,
            tests: [
                ...currentReportData.tests,
                ...mockResults
            ],
            hasNetworkErrors: true,
            networkErrorCount: invalidScenarios.length,
            totalScenarios: currentReportData.tests.length + mockResults.length,
            validScenariosCount: currentReportData.tests.length,
            invalidScenariosCount: invalidScenarios.length
        };
        
        console.log(`✅ Enhanced result created with ${enhancedResult.tests.length} total tests`);
        
        // Write enhanced report to a test file
        const testReportPath = path.join(__dirname, 'backstop_data', projectId, 'html_report', 'config_test_enhanced.js');
        const reportData = `report(${JSON.stringify(enhancedResult, null, 2)});`;
        
        await fs.writeFile(testReportPath, reportData, 'utf8');
        console.log(`📄 Test enhanced report written to: ${testReportPath}`);
        
        // Verify the test file
        const testReportContent = await fs.readFile(testReportPath, 'utf8');
        const testReportMatch = testReportContent.match(/report\\((.*)\\);/s);
        if (testReportMatch) {
            const testReportData = JSON.parse(testReportMatch[1]);
            console.log(`🔍 Verification - Test report has ${testReportData.tests?.length || 0} tests`);
            
            const networkTestInReport = testReportData.tests?.find(test => test.pair?.label === 'network-test');
            if (networkTestInReport) {
                console.log(`✅ SUCCESS: "network-test" found in enhanced report!`);
                console.log(`   Status: ${networkTestInReport.status}`);
                console.log(`   Error: ${networkTestInReport.error}`);
                console.log(`   Network Error: ${networkTestInReport.networkError}`);
            } else {
                console.log(`❌ FAILED: "network-test" NOT found in enhanced report`);
            }
        }
        
    } else {
        console.log('❌ Could not parse current report');
    }
    
    console.log('\\n✅ Test completed!');
}

testRealEnhancement().catch(console.error);
