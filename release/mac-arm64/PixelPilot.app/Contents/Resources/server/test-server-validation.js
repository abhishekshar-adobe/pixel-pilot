const axios = require('axios');

async function testServer() {
    try {
        console.log('🔍 Testing Adobe AEM URL validation through server...');
        
        // Test the specific URL that should now work
        const testUrl = 'https://aem.enablementadobe.com/content/asset-share-commons/en/light/faqs.html';
        
        // First, let's test if our server is running
        console.log('📡 Checking if server is running...');
        try {
            const healthCheck = await axios.get('http://localhost:3000/api/health', { timeout: 3000 });
            console.log('✅ Server is running');
        } catch (error) {
            console.log('❌ Server might not be running:', error.message);
            return;
        }
        
        console.log(`\n🌐 Testing URL validation: ${testUrl}`);
        
        // Create a minimal test project for validation
        const testData = {
            scenarios: [
                {
                    id: 'adobe-test',
                    label: 'Adobe AEM Test',
                    url: testUrl,
                    selectors: ['document'],
                    viewports: [{ label: 'desktop', width: 1280, height: 720 }]
                }
            ]
        };
        
        const response = await axios.post('http://localhost:3000/api/test-url-validation', testData, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('📊 Validation result:', response.data);
        
        if (response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            if (result.valid) {
                console.log('✅ SUCCESS: Adobe AEM URL is now accessible!');
            } else {
                console.log('❌ FAILED: URL still not accessible:', result.error);
            }
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

testServer();
