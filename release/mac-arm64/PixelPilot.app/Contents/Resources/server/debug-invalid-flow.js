// Debug test to trace the filtering and invalid scenario flow
const axios = require('axios');

async function debugInvalidScenarios() {
    const testData = {
        filter: "asset-share-commons|network-test|details"
    };
    
    console.log('🧪 Testing invalid scenario flow with filter...');
    console.log(`Filter: ${testData.filter}`);
    
    try {
        const response = await axios.post('http://localhost:5000/api/projects/c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b/test', testData, {
            timeout: 30000
        });
        
        console.log('✅ Test completed successfully');
        console.log('📊 Result summary:', {
            success: response.data.success,
            hasNetworkErrors: response.data.hasNetworkErrors,
            networkErrorCount: response.data.networkErrorCount,
            totalTests: response.data.result?.tests?.length,
            networkErrors: response.data.result?.tests?.filter(t => t.networkError)?.length || 0
        });
        
        // Check if network-test scenario appears in results
        const networkTestResults = response.data.result?.tests?.filter(t => 
            t.pair?.label === 'network-test' || t.pair?.label?.includes('network-test')
        );
        
        console.log(`🔍 "network-test" scenario results: ${networkTestResults?.length || 0} found`);
        if (networkTestResults?.length > 0) {
            networkTestResults.forEach(result => {
                console.log(`   - ${result.pair?.label}: ${result.status} ${result.networkError ? '(Network Error)' : '(Normal Test)'}`);
                console.log(`     Error: ${result.error || 'None'}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
debugInvalidScenarios();
