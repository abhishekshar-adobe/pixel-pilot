const axios = require('axios');
const https = require('https');

// Test the specific Adobe AEM URL validation
async function testAdobeUrl() {
    const url = 'https://aem.enablementadobe.com/content/asset-share-commons/en/light/faqs.html';
    
    console.log(`\n🔍 Testing Adobe AEM URL: ${url}`);
    console.log('=' .repeat(80));
    
    // Test 1: Direct axios request with browser headers
    console.log('\n📍 Test 1: Direct axios request with browser headers');
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            maxRedirects: 10,
            validateStatus: (status) => status < 400,
            // Disable SSL verification for Adobe AEM URLs
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });
        console.log(`✅ SUCCESS - Status: ${response.status} ${response.statusText}`);
        console.log(`📄 Content-Type: ${response.headers['content-type'] || 'Not specified'}`);
        console.log(`📏 Content-Length: ${response.headers['content-length'] || 'Not specified'}`);
    } catch (error) {
        console.log(`❌ FAILED - ${error.code || error.message}`);
        console.log(`🔍 Error details:`, error.response?.status, error.response?.statusText);
    }
    
    // Test 2: Using the validateUrl function from server
    console.log('\n📍 Test 2: Using validateUrl function');
    
    // Copy the validateUrl function here for testing
    async function validateUrl(url) {
        try {
            console.log(`🔗 Validating URL: ${url}`);
            
            // Check if it's an Adobe AEM URL
            const isAdobeAEM = url.includes('aem.enablementadobe.com') || 
                              url.includes('aem-publish') || 
                              url.includes('/content/') ||
                              url.includes('adobe.com');
            
            const timeout = isAdobeAEM ? 15000 : 8000;
            const userAgent = isAdobeAEM ? 
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' :
                'PixelPilot-Bot/1.0';
            
            console.log(`📊 Adobe AEM detected: ${isAdobeAEM}`);
            console.log(`⏱️ Timeout: ${timeout}ms`);
            console.log(`🤖 User-Agent: ${userAgent}`);
            
            const validationPromise = axios.get(url, {
                timeout: timeout,
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                },
                maxRedirects: isAdobeAEM ? 10 : 5,
                validateStatus: (status) => status < 400,
                // Disable SSL verification for Adobe AEM URLs
                httpsAgent: isAdobeAEM ? new https.Agent({
                    rejectUnauthorized: false
                }) : undefined
            });
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Request timed out after ${timeout}ms`));
                }, timeout + 1000);
            });
            
            const response = await Promise.race([validationPromise, timeoutPromise]);
            
            console.log(`✅ URL is accessible - Status: ${response.status} ${response.statusText}`);
            return { valid: true, error: null, status: response.status, statusText: response.statusText };
        } catch (error) {
            let errorMessage;
            if (error.code === 'ENOTFOUND') {
                errorMessage = 'DNS resolution failed - domain not found';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused - server not responding';
            } else if (error.code === 'ETIMEDOUT' || error.message.includes('timed out')) {
                errorMessage = `Request timed out after ${error.timeout || '15000'}ms`;
            } else if (error.response) {
                errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
            } else {
                errorMessage = error.message || 'Unknown network error';
            }
            
            console.log(`❌ URL validation failed: ${errorMessage}`);
            return { valid: false, error: errorMessage };
        }
    }
    
    const result = await validateUrl(url);
    console.log('\n🎯 Final Result:', result);
    
    console.log('\n' + '='.repeat(80));
    console.log('🏁 Test completed');
}

// Run the test
testAdobeUrl().catch(console.error);
