const axios = require('axios');
const https = require('https');

async function quickTest() {
    const url = 'https://aem.enablementadobe.com/content/asset-share-commons/en/light/faqs.html';
    
    console.log(`Testing: ${url}`);
    
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            }),
            validateStatus: (status) => status < 400
        });
        
        console.log(`✅ SUCCESS! Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers['content-type'] || 'Not specified'}`);
        return true;
    } catch (error) {
        console.log(`❌ FAILED: ${error.code || error.message}`);
        if (error.response) {
            console.log(`Status: ${error.response.status} ${error.response.statusText}`);
        }
        return false;
    }
}

quickTest();
