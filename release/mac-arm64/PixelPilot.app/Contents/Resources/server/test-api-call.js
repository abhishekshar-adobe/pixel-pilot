const axios = require('axios');

async function testInvalidScenariosAPI() {
    console.log('🧪 Testing API call to trigger invalid scenario debugging...');
    
    try {
        console.log('📡 Making API call...');
        
        const response = await axios.post('http://localhost:5000/api/projects/c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b/test', {
            filter: "asset-share-commons|network-test|details"
        }, {
            timeout: 120000 // 2 minutes timeout
        });
        
        console.log('✅ API call completed');
        console.log('📊 Response summary:', {
            success: response.data.success,
            hasNetworkErrors: response.data.hasNetworkErrors,
            networkErrorCount: response.data.networkErrorCount,
            totalTests: response.data.result?.tests?.length || 0
        });
        
        // Check specifically for network-test scenario
        if (response.data.result?.tests) {
            const networkTestResults = response.data.result.tests.filter(test => 
                test.pair?.label === 'network-test' || test.pair?.label?.includes('network-test')
            );
            
            console.log(`🔍 "network-test" scenarios in result: ${networkTestResults.length}`);
            if (networkTestResults.length > 0) {
                networkTestResults.forEach(result => {
                    console.log(`   ✅ Found: ${result.pair.label} - Status: ${result.status} - NetworkError: ${result.networkError}`);
                });
            } else {
                console.log(`   ❌ "network-test" scenario NOT found in API response`);
            }
        }
        
    } catch (error) {
        console.error('❌ API call failed:', error.response?.data || error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Server is not running. Please start the server first.');
        }
    }
}

// Give server time to start, then run test
setTimeout(() => {
    testInvalidScenariosAPI();
}, 2000);
