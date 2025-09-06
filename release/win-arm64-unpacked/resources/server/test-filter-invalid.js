const axios = require('axios');

async function testFilterWithInvalidScenario() {
  try {
    console.log('🧪 Testing filter with invalid network scenario...\n');
    
    const testData = {
      filter: "asset-share-commons|network-test|details"
    };
    
    console.log(`Sending POST request to: /api/projects/c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b/test`);
    console.log(`Filter: ${testData.filter}\n`);
    
    const response = await axios.post(
      'http://localhost:5000/api/projects/c9c8013e-99b6-4cd8-b8d7-c5ac04c4340b/test',
      testData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000 // 60 second timeout
      }
    );
    
    console.log('✅ Response received:');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Message:', response.data.message);
    console.log('Has Network Errors:', response.data.hasNetworkErrors);
    console.log('Network Error Count:', response.data.networkErrorCount);
    
    if (response.data.result && response.data.result.tests) {
      console.log(`\nTest Results: ${response.data.result.tests.length} tests`);
      response.data.result.tests.forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.pair.label} - Status: ${test.status}`);
      });
    }
    
    if (response.data.details) {
      console.log('\nInvalid Scenarios Details:');
      response.data.details.forEach((detail, index) => {
        console.log(`  ${index + 1}. ${detail.scenario} - ${detail.reason}: ${detail.message}`);
      });
    }
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('❌ Request timeout - server may be hanging during validation');
    } else if (error.response) {
      console.log('❌ Server response error:');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data.error);
      console.log('Message:', error.response.data.message);
      
      if (error.response.data.details) {
        console.log('\nDetails:');
        error.response.data.details.forEach((detail, index) => {
          console.log(`  ${index + 1}. ${detail.scenario} - ${detail.reason}: ${detail.message}`);
        });
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Run the test
testFilterWithInvalidScenario();
